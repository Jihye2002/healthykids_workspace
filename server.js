const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

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

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

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
    .filter(t => t.length > 30);
}

/* =========================
   LOAD HTML DOCS
========================= */
function loadDocs() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".html"));

  for (const file of files) {
    const html = fs.readFileSync(path.join(__dirname, file), "utf-8");
    const clean = stripHtml(html);

    splitText(clean).forEach(t => {
      DOCUMENTS.push({
        title: file,
        text: t,
        url: "/" + file,
        type: "html"
      });
    });
  }

  console.log("DOCS LOADED:", DOCUMENTS.length);
}

/* =========================
   EMBEDDING
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
async function buildVectors() {
  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const v = await embed(d.text);
    VECTOR_DB.push({ ...d, vector: v });
  }

  console.log("VECTOR READY:", VECTOR_DB.length);
}

/* =========================
   COSINE SIM
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
   BM25 SIMPLE
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
   RETRIEVE (CORE v4)
========================= */
async function retrieve(query) {

  const qvec = await embed(query);

  const scored = VECTOR_DB.map(d => {

    const vecScore = cosine(qvec, d.vector || []);
    const bm = bm25(query, d);

    const score = vecScore * 0.75 + bm * 0.25;

    return { ...d, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

/* =========================
   GROQ RERANK (SAFE)
========================= */
async function groqRerank(query, docs) {

  if (!GROQ_API_KEY || docs.length === 0) return docs;

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
            content: "Return ONLY valid JSON array of indices."
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

    return order.map(i => docs[i]).filter(Boolean);

  } catch {
    return docs;
  }
}

/* =========================
   FINAL RERANK
========================= */
function rerank(docs) {
  return docs.slice(0, 6);
}

/* =========================
   GPT ANSWER + SUMMARY
========================= */
async function answer(query, docs) {

  const context = docs
    .map(d => `${d.title}: ${d.text}`)
    .join("\n\n")
    .slice(0, 6000);

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
            content: "너는 어린이용 건강 교육 AI야. 5줄 이하로 쉽게 설명해."
          },
          {
            role: "user",
            content: `질문: ${query}\n\n자료:\n${context}`
          }
        ],
        temperature: 0.3,
        max_tokens: 250
      })
    });

    const data = await res.json();

    return data?.choices?.[0]?.message?.content
      || "관련 내용을 찾지 못했어요 😢";

  } catch {
    return "AI 오류 😢";
  }
}

/* =========================
   CHAT API
========================= */
app.post("/api/chat", async (req, res) => {

  const message = req.body.message || "";

  let docs = await retrieve(message);

  docs = await groqRerank(message, docs);

  docs = rerank(docs);

  if (!docs.length) {
    return res.json({
      reply: "관련 내용을 찾지 못했어요 😢",
      results: []
    });
  }

  const reply = await answer(message, docs);

  res.json({
    reply,
    results: docs.map(d => ({
      title: d.title,
      summary: d.text.slice(0, 120),
      url: d.url,
      type: d.type
    }))
  });
});

/* =========================
   INIT
========================= */
(async () => {
  loadDocs();
  await buildVectors();
})();

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 SEARCH ENGINE V4 READY:", PORT);
});
