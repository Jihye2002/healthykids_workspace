const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const multer = require("multer");
const Tesseract = require("tesseract.js");

const fetch = global.fetch || require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   CONFIG
========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================
   DATA STORE
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

const upload = multer({ dest: "uploads/" });

/* =========================
   NORMALIZE
========================= */
function normalize(t = "") {
  return t
    .toLowerCase()
    .replace(/[^\w가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   CLEAN HTML
========================= */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   SPLIT
========================= */
function splitText(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 30);
}

/* =========================
   LOAD FILES (AUTO INDEX)
========================= */
async function loadFiles() {
  DOCS = [];

  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    const full = path.join(__dirname, file);

    if (file.endsWith(".html")) {
      const html = fs.readFileSync(full, "utf8");
      const clean = stripHtml(html);

      splitText(clean).forEach(t => {
        DOCS.push({
          title: file,
          text: t,
          url: "/" + file,
          type: "html"
        });
      });
    }

    if (file.endsWith(".pdf")) {
      const buf = fs.readFileSync(full);
      const pdf = await pdfParse(buf);

      splitText(pdf.text).forEach(t => {
        DOCS.push({
          title: file,
          text: t,
          url: "/" + file,
          type: "pdf"
        });
      });
    }

    if (file.match(/\.(png|jpg|jpeg)$/)) {
      const ocr = await Tesseract.recognize(full, "kor+eng");

      splitText(ocr.data.text).forEach(t => {
        DOCS.push({
          title: file,
          text: t,
          url: "/" + file,
          type: "image"
        });
      });
    }
  }

  console.log("📦 INDEXED DOCS:", DOCS.length);
}

/* =========================
   EMBEDDING
========================= */
async function embed(text) {
  if (!OPENAI_API_KEY) return [];

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
  return data?.data?.[0]?.embedding || [];
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
   BM25 LIGHT
========================= */
function bm25(query, text) {
  const q = normalize(query).split(" ");
  const t = normalize(text);

  let score = 0;

  for (const w of q) {
    if (t.includes(w)) score += 1;
  }

  return score;
}

/* =========================
   SEARCH ENGINE V11 CORE
========================= */
async function search(query) {

  if (CACHE.has(query)) return CACHE.get(query);

  const qvec = await embed(query);

  let results = [];

  for (const d of VECTORS) {

    const vecScore = cosine(qvec, d.vector);
    const bmScore = bm25(query, d.text);

    let score =
      vecScore * 2.2 +
      bmScore * 1.5;

    // title boost
    if (normalize(d.title).includes(normalize(query))) {
      score += 2;
    }

    results.push({ ...d, score });
  }

  results.sort((a, b) => b.score - a.score);

  /* =========================
     SEMANTIC DEDUP (핵심)
  ========================= */
  const seen = new Set();
  const dedup = [];

  for (const r of results) {
    const key = normalize(r.text).slice(0, 40);

    if (seen.has(key)) continue;
    seen.add(key);

    dedup.push(r);
  }

  const top = dedup.slice(0, 8);

  CACHE.set(query, top);

  return top;
}

/* =========================
   ANSWER (GPT)
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
          content: "너는 Google + ChatGPT 검색 AI. 결과를 5줄 이내로 쉽게 설명"
        },
        {
          role: "user",
          content: `질문:${query}\n\n자료:${context}`
        }
      ],
      temperature: 0.3
    })
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "검색 실패";
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
      url: d.url,
      type: d.type,
      summary: d.text.slice(0, 120)
    }))
  });
});

/* =========================
   AUTO UPDATE INDEX
========================= */
fs.watch(__dirname, async () => {
  console.log("🔄 REINDEXING...");
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
  console.log("🚀 V11 GOOGLE-CHAT SEARCH RUNNING:", PORT);
});
