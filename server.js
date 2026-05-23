const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");

const fetch = global.fetch || require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CONFIG
========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================
   DATA
========================= */
let DOCS = [];
let VECTORS = [];
let CACHE = new Map();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

/* =========================
   UTILS
========================= */
function normalize(t = "") {
  return t
    .toLowerCase()
    .replace(/[^\w가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitText(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 10); // 🔥 핵심: 짧은 문장 유지
}

/* =========================
   EMBEDDING
========================= */
async function embed(text) {
  if (!OPENAI_API_KEY) return Array(1536).fill(0);

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    });

    const data = await res.json();
    return data?.data?.[0]?.embedding || Array(1536).fill(0);

  } catch {
    return Array(1536).fill(0);
  }
}

/* =========================
   LOAD FILES (MULTI-MODAL INDEX)
========================= */
async function loadFiles() {
  DOCS = [];

  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    const full = path.join(__dirname, file);

    /* HTML */
    if (file.endsWith(".html")) {
      const html = fs.readFileSync(full, "utf8");
      const clean = stripHtml(html);

      splitText(clean).forEach(t => {
        DOCS.push({
          type: "html",
          title: file,
          text: t,
          url: "/" + file
        });
      });
    }

    /* PDF */
    if (file.endsWith(".pdf")) {
      const buf = fs.readFileSync(full);
      const pdf = await pdfParse(buf);

      splitText(pdf.text).forEach(t => {
        DOCS.push({
          type: "pdf",
          title: file,
          text: t,
          url: "/" + file
        });
      });
    }

    /* IMAGE OCR */
    if (file.match(/\.(png|jpg|jpeg)$/)) {
      try {
        const ocr = await Tesseract.recognize(full, "kor+eng");

        splitText(ocr.data.text).forEach(t => {
          DOCS.push({
            type: "image",
            title: file,
            text: t,
            url: "/" + file
          });
        });
      } catch {}
    }

    /* VIDEO (SAFE META ONLY) */
    if (file.endsWith(".mp4")) {
      DOCS.push({
        type: "video",
        title: file,
        text: file.replace(".mp4", "") + " 영상 콘텐츠",
        url: "/" + file
      });
    }
  }

  console.log("📦 DOCS INDEXED:", DOCS.length);
}

/* =========================
   VECTOR BUILD
========================= */
async function buildVectors() {
  VECTORS = [];

  for (const d of DOCS) {
    const v = await embed(d.text);
    VECTORS.push({ ...d, vector: v });
  }

  console.log("🧠 VECTOR READY:", VECTORS.length);
}

/* =========================
   COSINE
========================= */
function cosine(a, b) {
  if (!a?.length || !b?.length) return 0;

  let dot = 0, ma = 0, mb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] ** 2;
    mb += b[i] ** 2;
  }

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   BM25 LIGHT (강화 버전)
========================= */
function bm25(query, text) {
  const q = normalize(query).split(" ");
  const t = normalize(text);

  let score = 0;

  for (const w of q) {
    if (t.includes(w)) score += 2; // 🔥 강화
  }

  return score;
}

/* =========================
   SEARCH CORE (핵심)
========================= */
async function search(query) {

  if (CACHE.has(query)) return CACHE.get(query);

  const qvec = await embed(query);

  let results = [];

  for (const d of VECTORS) {

    const vecScore = cosine(qvec, d.vector);
    const bmScore = bm25(query, d.text);

    let score =
      vecScore * 2.5 +
      bmScore * 2.0;

    if (normalize(d.title).includes(normalize(query))) {
      score += 2;
    }

    results.push({ ...d, score });
  }

  results.sort((a, b) => b.score - a.score);

  /* =========================
     DEDUP (강력)
  ========================= */
  const seen = new Set();
  const dedup = [];

  for (const r of results) {
    const key = normalize(r.text).slice(0, 50);

    if (seen.has(key)) continue;
    seen.add(key);

    dedup.push(r);
  }

  let top = dedup.slice(0, 8);

  /* =========================
     FALLBACK (검색 실패 방지)
  ========================= */
  if (top.length === 0) {
    top = DOCS.slice(0, 5);
  }

  CACHE.set(query, top);

  return top;
}

/* =========================
   GPT ANSWER
========================= */
async function answer(query, docs) {

  const context = docs
    .map(d => `${d.title}: ${d.text}`)
    .join("\n")
    .slice(0, 6000);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "너는 어린이 교육 검색 AI야. 5줄 이내로 쉽게 설명해."
        },
        {
          role: "user",
          content: `질문: ${query}\n\n자료:\n${context}`
        }
      ],
      temperature: 0.3
    })
  });

  const data = await res.json();

  return data?.choices?.[0]?.message?.content || "검색 결과를 찾을 수 없습니다.";
}

/* =========================
   API
========================= */
app.post("/api/chat", async (req, res) => {

  const q = req.body.message || "";

  const docs = await search(q);
  const reply = await answer(q, docs);

  res.json({
    reply,
    results: docs.map(d => ({
      title: d.title,
      type: d.type,
      url: d.url,
      summary: d.text.slice(0, 120)
    }))
  });
});

/* =========================
   AUTO REINDEX
========================= */
fs.watch(__dirname, async () => {
  console.log("🔄 REINDEX");
  await loadFiles();
  await buildVectors();
});

/* =========================
   INIT
========================= */
(async () => {
  await loadFiles();
  await buildVectors();
})();

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 V12 STABLE SEARCH ENGINE RUNNING:", PORT);
});
