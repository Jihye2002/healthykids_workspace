const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const app = express();
const PORT = process.env.PORT || 3000;

const fetch = global.fetch || require("node-fetch");

/* =========================
   KEYS
========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DATA
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];
let CLICK_LOG = [];

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

/* =========================
   CLEAN / NORMALIZE
========================= */
function normalize(t = "") {
  return t
    .toLowerCase()
    .replace(/[^\w가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   INTENT CLASSIFIER (핵심)
========================= */
function classifyIntent(q) {
  q = q.toLowerCase();

  if (q.includes("손") || q.includes("위생") || q.includes("씻")) return "hygiene";
  if (q.includes("감기") || q.includes("열") || q.includes("건강")) return "health";
  if (q.includes("횡단") || q.includes("교통")) return "safety";

  return "general";
}

/* =========================
   NOISE FILTER
========================= */
const NOISE = ["로그인","회원가입","버튼","nav","footer","메뉴"];

function isNoise(t = "") {
  return NOISE.some(n => t.toLowerCase().includes(n));
}

/* =========================
   HTML CLEAN
========================= */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
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
    .filter(t => t.length > 40 && !isNoise(t));
}

/* =========================
   LOAD HTML
========================= */
function crawlSite() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".html"));

  for (const file of files) {
    const html = fs.readFileSync(path.join(__dirname, file), "utf-8");

    const clean = stripHtml(html);

    splitText(clean).forEach(t => {
      DOCUMENTS.push({
        title: file,
        text: t,
        url: "/" + file
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

  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const v = await embed(d.text);
    VECTOR_DB.push({ ...d, vector: v });
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
   BM25 (light version)
========================= */
function bm25(query, doc) {
  const q = normalize(query).split(" ");
  const text = normalize(doc.text);

  let score = 0;

  for (const token of q) {
    if (text.includes(token)) score += 1;
  }

  return score;
}

/* =========================
   RETRIEVE (HYBRID + INTENT FILTER)
========================= */
async function retrieve(query) {

  const intent = classifyIntent(query);
  const qvec = await embed(query);

  const filtered = DOCUMENTS.filter(d => {

    // 🚨 HARD FILTER (핵심)
    if (intent !== "general") {
      const t = d.text.toLowerCase();

      if (intent === "hygiene" && !t.includes("손") && !t.includes("씻")) return false;
      if (intent === "health" && !t.includes("감기") && !t.includes("건강")) return false;
      if (intent === "safety" && !t.includes("횡단") && !t.includes("도로")) return false;
    }

    return true;
  });

  const scored = filtered.map(d => {

    const vec = VECTOR_DB.find(v => v.text === d.text)?.vector || [];

    const bm = bm25(query, d);
    const vecScore = cosine(qvec, vec);

    let score = bm * 1.5 + vecScore * 2;

    // title boost
    if (normalize(d.title).includes(normalize(query))) {
      score += 3;
    }

    return { ...d, score, intent };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

/* =========================
   GROQ RERANK (핵심 추가)
========================= */
async function groqRerank(query, docs) {

  if (!GROQ_API_KEY) return docs;

  try {

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: "Return JSON array of best document indices only."
          },
          {
            role: "user",
            content: JSON.stringify({
              query,
              docs: docs.map((d, i) => ({
                i,
                title: d.title,
                score: d.score
              }))
            })
          }
        ]
      })
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;

    const order = JSON.parse(text);

    return order
      .map(i => docs[i])
      .filter(Boolean);

  } catch (e) {
    return docs;
  }
}

/* =========================
   RERANK (click boost)
========================= */
function rerank(docs, query) {

  return docs.map(d => {

    let score = d.score;

    const clicks = CLICK_LOG.filter(c => c.title === d.title).length;
    score += clicks * 1.8;

    if (d.intent === classifyIntent(query)) {
      score += 2;
    }

    return { ...d, score };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 6);
}

/* =========================
   ANSWER (OPENAI)
========================= */
async function answer(query, docs) {

  const context = docs
    .map(d => `${d.title}\n${d.text}`)
    .join("\n\n")
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
          content: "너는 어린이 건강 교육 AI야. 5줄 이하로 쉽게 설명해."
        },
        {
          role: "user",
          content: `질문:${query}\n\n자료:\n${context}`
        }
      ],
      temperature: 0.3,
      max_tokens: 250
    })
  });

  const data = await res.json();

  return data?.choices?.[0]?.message?.content
    || "관련 내용을 찾지 못했어요 😢";
}

/* =========================
   CHAT API
========================= */
app.post("/api/chat", async (req, res) => {

  const message = req.body.message || "";

  let docs = await retrieve(message);

  docs = await groqRerank(message, docs);

  docs = rerank(docs, message);

  const reply = await answer(message, docs);

  res.json({
    reply,
    results: docs.map(d => ({
      title: d.title,
      summary: d.text.slice(0, 120),
      url: d.url
    }))
  });
});

/* =========================
   INIT
========================= */
(async () => {
  DOCUMENTS = [];
  crawlSite();
  await buildVectors();
})();

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 V3.5 SEARCH ENGINE RUNNING:", PORT);
});
