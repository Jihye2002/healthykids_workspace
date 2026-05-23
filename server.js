const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   KEYS
========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DB
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(__dirname));

const upload = multer({ dest: "uploads/" });

/* =========================
   NOISE FILTER
========================= */
const NOISE = [
  "로그인","회원가입","회원탈퇴","관리자",
  "메뉴","nav","header","footer","공지","버튼"
];

function isNoise(t="") {
  const x = t.toLowerCase();
  return NOISE.some(n => x.includes(n));
}

/* =========================
   CLEAN HTML
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
function normalize(t="") {
  return t
    .toLowerCase()
    .replace(/[^\w가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   CHUNK (semantic 유지)
========================= */
function splitText(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 50 && !isNoise(t));
}

/* =========================
   EMBEDDING (OpenAI)
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
   LOAD DATA
========================= */
function getTitle(html, file) {
  const m = html.match(/<title>(.*?)<\/title>/i);
  return m?.[1] || file;
}

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

async function loadPdfFiles() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".pdf"));

  for (const file of files) {
    const buffer = fs.readFileSync(path.join(__dirname, file));
    const parsed = await pdfParse(buffer);

    splitText(parsed.text).forEach(t => {
      DOCUMENTS.push({
        title: file.replace(".pdf",""),
        text: t,
        url: "/" + file,
        type: "pdf"
      });
    });
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
   RETRIEVE
========================= */
async function retrieve(query) {
  const qvec = await embed(query);
  const q = normalize(query);
  const keys = q.split(" ");

  return VECTOR_DB.map(d => {
    let score = 0;

    if (qvec.length && d.vector.length) {
      score += cosine(qvec, d.vector);
    }

    const text = normalize(d.text);
    const title = normalize(d.title);

    for (const k of keys) {
      if (text.includes(k)) score += 0.6;
    }

    if (title.includes(q)) score += 2;

    return { ...d, score };
  })
  .sort((a,b)=>b.score-a.score)
  .slice(0, 25);
}

/* =========================
   GROQ RERANK (🔥 핵심)
========================= */
async function groqRerank(query, docs) {
  if (!GROQ_API_KEY) return docs;

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
          content:
            "너는 검색 결과를 가장 관련성 높은 순서로 정렬하는 AI다. JSON 배열로만 출력해라."
        },
        {
          role: "user",
          content: JSON.stringify({
            query,
            docs: docs.map(d => ({
              title: d.title,
              text: d.text,
              score: d.score
            }))
          })
        }
      ]
    })
  });

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    return parsed.slice(0, 6);
  } catch {
    return docs;
  }
}

/* =========================
   FALLBACK RERANK
========================= */
function fallbackRerank(docs, query) {
  const q = normalize(query);

  return docs
    .map(d => {
      let s = d.score;

      if (normalize(d.text).includes(q)) s += 1;
      if (normalize(d.title).includes(q)) s += 2;

      if (isNoise(d.text)) s -= 5;

      return { ...d, score: s };
    })
    .sort((a,b)=>b.score-a.score)
    .slice(0, 6);
}

/* =========================
   SUMMARY (영상 포함 개선)
========================= */
function makeSummary(text="") {
  return text.replace(/\s+/g, " ").slice(0, 160);
}

/* =========================
   GPT ANSWER
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
          content:
            "너는 어린이 건강교육 AI. 5줄 이하로 쉽게 설명."
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

  let ranked;

  if (GROQ_API_KEY) {
    ranked = await groqRerank(message, retrieved);
  } else {
    ranked = fallbackRerank(retrieved, message);
  }

  if (!ranked.length) {
    return res.json({
      reply: "관련 자료 없음 😢",
      results: []
    });
  }

  const reply = await answer(message, ranked);

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
  console.log("🔥 V10 GROQ + OPENAI RAG RUNNING:", PORT);
});
