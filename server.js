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
   MEMORY
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
   CLEAN TEXT
========================= */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(t = "") {
  return t.toLowerCase().replace(/\s+/g, " ").trim();
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
   LOAD HTML FILES
========================= */
function loadHTML() {
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
   BUILD VECTOR DB
========================= */
async function buildVectors() {
  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const vector = await embed(d.text);
    VECTOR_DB.push({ ...d, vector });
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
   RETRIEVE (PURE AI SEMANTIC)
========================= */
async function retrieve(query) {

  const qvec = await embed(query);

  const scored = VECTOR_DB.map(d => {
    const sim = cosine(qvec, d.vector);

    return {
      ...d,
      score: sim
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}

/* =========================
   GROQ RERANK (OPTIONAL AI SORT)
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
            content: "Return JSON array of indices sorted by relevance."
          },
          {
            role: "user",
            content: JSON.stringify({
              query,
              docs: docs.map((d, i) => ({
                i,
                title: d.title,
                text: d.text.slice(0, 200),
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

  } catch (e) {
    return docs;
  }
}

/* =========================
   LLM FINAL RERANK (핵심 AI 판단)
========================= */
async function llmRerank(query, docs) {

  if (!OPENAI_API_KEY) return docs.slice(0, 6);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
너는 검색 결과 랭킹 AI다.
주어진 문서 중 질문과 가장 관련 높은 순서대로 index 배열로만 반환해라.
설명 금지. JSON만 출력.
          `
        },
        {
          role: "user",
          content: JSON.stringify({
            query,
            docs: docs.map((d, i) => ({
              i,
              title: d.title,
              text: d.text
            }))
          })
        }
      ]
    })
  });

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;

  try {
    const order = JSON.parse(text);
    return order.map(i => docs[i]).filter(Boolean);
  } catch {
    return docs;
  }
}

/* =========================
   REMOVE DUPLICATES (핵심)
========================= */
function dedupe(docs) {
  const seen = new Set();

  return docs.filter(d => {
    const key = normalize(d.title + d.text.slice(0, 80));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* =========================
   CHAT API
========================= */
app.post("/api/chat", async (req, res) => {

  const query = req.body.message || "";

  // 1. semantic search
  let docs = await retrieve(query);

  // 2. remove duplicates
  docs = dedupe(docs);

  // 3. Groq rerank (optional)
  docs = await groqRerank(query, docs);

  // 4. LLM final rerank (AI 판단)
  docs = await llmRerank(query, docs);

  docs = docs.slice(0, 6);

  // 5. answer generation
  const context = docs.map(d => `${d.title}\n${d.text}`).join("\n\n").slice(0, 6000);

  const answerRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
          content: "너는 어린이 교육 AI. 5줄 이하로 설명."
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

  const data = await answerRes.json();

  const reply =
    data?.choices?.[0]?.message?.content ||
    "관련 내용을 찾지 못했어요 😢";

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
  DOCUMENTS = [];
  loadHTML();
  await buildVectors();
})();

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 V7 AI SEARCH ENGINE RUNNING:", PORT);
});
