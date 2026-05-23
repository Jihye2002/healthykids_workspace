const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   FETCH
========================= */
const fetch = global.fetch || require("node-fetch");

/* =========================
   KEYS
========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================
   MEMORY DB
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(__dirname));

/* =========================
   VERY STRICT NOISE FILTER
   (핵심 개선)
========================= */
const NOISE_KEYWORDS = [
  "로그인","회원가입","회원탈퇴","관리자",
  "메뉴","nav","header","footer","버튼","공지",
  "cookie","광고","약관","설정"
];

function isNoise(text = "") {
  const t = text.toLowerCase();
  return NOISE_KEYWORDS.some(n => t.includes(n));
}

/* =========================
   CLEAN HTML (강화)
========================= */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "")
    .replace(/<input[\s\S]*?>/gi, "")
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
    .replace(/[^\w가-힣\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   SPLIT (더 정확하게)
========================= */
function splitText(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t =>
      t.length > 60 &&
      !isNoise(t)
    );
}

/* =========================
   TITLE
========================= */
function getTitle(html, file) {
  const m = html.match(/<title>(.*?)<\/title>/i);
  return m?.[1] || file;
}

/* =========================
   LOAD HTML
========================= */
async function crawlSite() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".html"));

  for (const file of files) {
    const html = fs.readFileSync(path.join(__dirname, file), "utf-8");

    const clean = stripHtml(html);
    const title = getTitle(html, file);

    splitText(clean).forEach(t => {
      DOCUMENTS.push({
        title,
        text: t,
        url: "/" + file,
        type: "html"
      });
    });
  }
}

/* =========================
   LOAD PDF
========================= */
async function loadPdfFiles() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".pdf"));

  for (const file of files) {
    const buffer = fs.readFileSync(path.join(__dirname, file));

    try {
      const parsed = await pdfParse(buffer);

      splitText(parsed.text).forEach(t => {
        DOCUMENTS.push({
          title: file.replace(".pdf",""),
          text: t,
          url: "/" + file,
          type: "pdf"
        });
      });

    } catch (e) {
      console.log("PDF ERROR:", file);
    }
  }
}

/* =========================
   EMBEDDING SAFE
========================= */
async function embed(text) {
  if (!OPENAI_API_KEY) return [];

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
    return data?.data?.[0]?.embedding || [];

  } catch {
    return [];
  }
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

  console.log("VECTOR READY:", VECTOR_DB.length);
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
   RETRIEVE (STRICT FILTER)
========================= */
async function retrieve(query) {

  const qvec = await embed(query);
  const q = normalize(query);
  const keys = q.split(" ");

  return VECTOR_DB.map(d => {

    let score = 0;

    const text = normalize(d.text);
    const title = normalize(d.title);

    // embedding similarity
    if (qvec.length && d.vector?.length) {
      score += cosine(qvec, d.vector) * 2;
    }

    // keyword match
    for (const k of keys) {
      if (text.includes(k)) score += 0.8;
      if (title.includes(k)) score += 1.5;
    }

    // HARD FILTER (핵심)
    if (!text.includes(q) && !title.includes(q) && score < 0.8) {
      score -= 5; // 거의 제거
    }

    return { ...d, score };
  })
  .filter(d => d.score > 0.7)   // 🔥 중요: 관련 없는 데이터 제거
  .sort((a, b) => b.score - a.score)
  .slice(0, 8);
}

/* =========================
   RERANK
========================= */
function rerank(docs) {

  return docs
    .map(d => ({
      ...d,
      score: d.score
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   GPT ANSWER (SAFE)
========================= */
async function answer(query, docs) {

  if (!OPENAI_API_KEY) {
    return "API 키가 설정되지 않았어요";
  }

  const context = docs
    .map(d => `${d.title}: ${d.text}`)
    .join("\n")
    .slice(0, 4000);

  try {

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
            content:
              "너는 어린이 건강 교육 AI야. 반드시 5줄 이하로 쉽고 정확하게 설명해."
          },
          {
            role: "user",
            content: `질문: ${query}\n\n자료:\n${context}`
          }
        ],
        temperature: 0.2,
        max_tokens: 250
      })
    });

    const data = await res.json();

    return data?.choices?.[0]?.message?.content ||
      "관련 내용을 찾지 못했어요 😢";

  } catch (e) {
    return "AI 서버 오류 😢";
  }
}

/* =========================
   API
========================= */
app.post("/api/chat", async (req, res) => {

  const message = req.body.message || "";

  const retrieved = await retrieve(message);

  if (!retrieved.length) {
    return res.json({
      reply: "관련된 내용을 찾지 못했어요 😢",
      results: []
    });
  }

  const ranked = rerank(retrieved);
  const reply = await answer(message, ranked);

  res.json({
    reply,
    results: ranked.map(r => ({
      title: r.title,
      summary: r.text.slice(0, 100),
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
  console.log("🚀 FINAL SEARCH SERVER V12 RUNNING:", PORT);
});
