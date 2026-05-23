const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================
   DB
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(__dirname));

const upload = multer({ dest: "uploads/" });

/* =========================
   CLEAN (안 지우고 필터링 중심)
========================= */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
   CHUNK (핵심 개선)
   👉 문단 단위 유지
========================= */
function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/g)
    .map(t => t.trim())
    .filter(t =>
      t.length > 40 &&
      !t.includes("로그인") &&
      !t.includes("회원가입") &&
      !t.includes("메뉴") &&
      !t.includes("공지")
    );
}

/* =========================
   TITLE
========================= */
function getTitle(html, file) {
  const m = html.match(/<title>(.*?)<\/title>/i);
  return m?.[1]?.trim() || file;
}

/* =========================
   LOAD DATA
========================= */
async function crawlSite() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".html"));

  for (const file of files) {
    const html = fs.readFileSync(path.join(__dirname, file), "utf-8");

    const clean = stripHtml(html);
    const title = getTitle(html, file);

    splitParagraphs(clean).forEach(p => {
      DOCUMENTS.push({
        title,
        text: p,
        url: "/" + file,
        type: "html"
      });
    });
  }
}

async function loadPdfFiles() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".pdf"));

  for (const file of files) {
    const buffer = fs.readFileSync(path.join(__dirname, file));
    const parsed = await pdfParse(buffer);

    splitParagraphs(parsed.text).forEach(p => {
      DOCUMENTS.push({
        title: file.replace(".pdf", ""),
        text: p,
        url: "/" + file,
        type: "pdf"
      });
    });
  }
}

/* =========================
   EMBEDDING
========================= */
async function embed(text) {
  if (!OPENAI_API_KEY) return [];

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
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
async function rebuildVector() {
  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const vector = await embed(d.text);
    VECTOR_DB.push({ ...d, vector });
  }

  console.log("VECTOR SIZE:", VECTOR_DB.length);
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
   RETRIEVE (20개 확장)
========================= */
async function retrieve(query) {
  const qvec = await embed(query);
  const keywords = normalize(query).split(" ");

  return VECTOR_DB.map(d => {
    let score = 0;

    if (qvec.length && d.vector.length) {
      score += cosine(qvec, d.vector);
    }

    const text = normalize(d.text);

    for (const k of keywords) {
      if (k && text.includes(k)) score += 0.5;
    }

    if (normalize(d.title).includes(normalize(query))) {
      score += 1.5;
    }

    return { ...d, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

/* =========================
   RERANK (🔥 핵심 개선)
========================= */
function rerank(docs, query) {
  const q = normalize(query);

  return docs
    .map(d => {
      let s = d.score;

      const text = normalize(d.text);
      const title = normalize(d.title);

      if (title.includes(q)) s += 2;

      if (text.includes(q)) s += 1;

      // 길이 패널티 제거 (이전 문제 수정)
      if (d.text.length < 30) s -= 1;

      // noise 제거
      if (
        text.includes("로그인") ||
        text.includes("메뉴")
      ) s -= 3;

      return { ...d, score: s };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   SUMMARY FIX
========================= */
function makeSummary(text) {
  if (!text) return "내용 없음";
  return text.replace(/\s+/g, " ").slice(0, 140);
}

/* =========================
   GPT RESPONSE
========================= */
async function generateAIResponse(query, docs) {
  const context = docs
    .map(d => `${d.title}\n${d.text}`)
    .join("\n\n")
    .slice(0, 6000);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "어린이 건강교육 AI. 5줄 이하로 핵심만 설명."
        },
        {
          role: "user",
          content: `질문:${query}\n\n자료:${context}`
        }
      ],
      temperature: 0.3,
      max_tokens: 250
    })
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "응답 없음";
}

/* =========================
   API
========================= */
app.post("/api/chat", async (req, res) => {
  const message = req.body.message || "";

  const retrieved = await retrieve(message);
  const ranked = rerank(retrieved, message);

  if (!ranked.length) {
    return res.json({
      reply: "관련 자료 없음 😢",
      results: []
    });
  }

  const reply = await generateAIResponse(message, ranked);

  res.json({
    reply,
    results: ranked.map(r => ({
      title: r.title || "제목 없음",
      summary: makeSummary(r.text),
      url: r.url,
      type: r.type
    }))
  });
});

/* =========================
   INIT
========================= */
(async () => {
  DOCUMENTS = [];
  await crawlSite();
  await loadPdfFiles();
  await rebuildVector();
})();

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("V8 SEARCH ENGINE RUNNING:", PORT);
});
