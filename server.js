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
let CLICK_LOG = [];

/* =========================
   MIDDLEWARE
========================= */
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
   SPLIT
========================= */
function splitText(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 50 && !isNoise(t));
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
function cosine(a,b) {
  if (!a?.length || !b?.length) return 0;

  let dot=0, ma=0, mb=0;

  for (let i=0;i<a.length;i++){
    dot += a[i]*b[i];
    ma += a[i]**2;
    mb += b[i]**2;
  }

  return dot / (Math.sqrt(ma)*Math.sqrt(mb)+1e-9);
}

/* =========================
   RETRIEVE (HYBRID)
========================= */
async function retrieve(query) {

  const qvec = await embed(query);
  const q = normalize(query);
  const keys = q.split(" ");

  const seen = new Set();

  return VECTOR_DB.map(d => {

    const key = d.title + d.text;
    if (seen.has(key)) return null;
    seen.add(key);

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

    // 타입 가중치
    if (d.type === "video") score += 0.8;
    if (d.type === "pdf") score += 0.4;

    return { ...d, score };
  })
  .filter(Boolean)
  .sort((a,b)=>b.score-a.score)
  .slice(0, 25);
}

/* =========================
   CLICK LEARNING
========================= */
function clickBoost(doc){
  const hits = CLICK_LOG.filter(c => c.title === doc.title).length;
  return hits * 1.8;
}

/* =========================
   RERANK (FINAL)
========================= */
function rerank(docs, query) {

  const q = normalize(query);

  return docs.map(d => {

    let score = d.score;

    if (normalize(d.title).includes(q)) score += 3;
    if (normalize(d.text).includes(q)) score += 1;

    // 클릭 학습
    score += clickBoost(d);

    // noise 제거
    if (isNoise(d.text)) score -= 5;

    return { ...d, score };
  })
  .sort((a,b)=>b.score-a.score)
  .slice(0, 6);
}

/* =========================
   SUMMARY
========================= */
function makeSummary(t="") {
  return t.replace(/\s+/g," ").slice(0,160);
}

/* =========================
   GROQ OPTIONAL RERANK
========================= */
async function groqRerank(query, docs) {

  if (!GROQ_API_KEY) return docs;

  try {

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${GROQ_API_KEY}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        model:"llama-3.1-70b-versatile",
        temperature:0,
        messages:[
          {
            role:"system",
            content:"Return ONLY JSON array of titles in best order."
          },
          {
            role:"user",
            content: JSON.stringify({
              query,
              docs: docs.map(d => ({
                title:d.title,
                score:d.score
              }))
            })
          }
        ]
      })
    });

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;

    const titles = JSON.parse(text);

    const map = new Map(docs.map(d => [d.title, d]));

    return titles
      .map(t => map.get(t))
      .filter(Boolean)
      .slice(0,6);

  } catch(e) {
    return docs;
  }
}

/* =========================
   ANSWER (OPENAI)
========================= */
async function answer(query, docs) {

  const context = docs
    .map(d => `${d.title}\n${d.text}`)
    .join("\n\n")
    .slice(0,6000);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "Authorization":`Bearer ${OPENAI_API_KEY}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      model:"gpt-4o-mini",
      messages:[
        {
          role:"system",
          content:"어린이 건강교육 AI. 5줄 이하로 설명."
        },
        {
          role:"user",
          content:`질문:${query}\n\n자료:${context}`
        }
      ],
      temperature:0.3,
      max_tokens:250
    })
  });

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "응답 없음";
}

/* =========================
   CLICK LOG API
========================= */
app.post("/api/click-log", (req,res)=>{

  const { title, url, type } = req.body;

  if (!title) return res.json({ok:false});

  CLICK_LOG.push({
    title,
    url,
    type,
    time:Date.now()
  });

  res.json({ok:true});
});

/* =========================
   CHAT API
========================= */
app.post("/api/chat", async (req,res)=>{

  const message = req.body.message || "";

  const retrieved = await retrieve(message);

  let ranked = GROQ_API_KEY
    ? await groqRerank(message, retrieved)
    : rerank(retrieved, message);

  if (!ranked.length) {
    return res.json({
      reply:"관련 자료 없음 😢",
      results:[]
    });
  }

  const reply = await answer(message, ranked);

  res.json({
    reply,
    results: ranked.map(r => ({
      title:r.title,
      summary:makeSummary(r.text),
      url:r.url,
      type:r.type
    }))
  });

});

/* =========================
   INIT
========================= */
(async ()=>{
  DOCUMENTS=[];
  await crawlSite();
  await loadPdfFiles();
  await rebuildVector();
})();

/* =========================
   START
========================= */
app.listen(PORT, ()=>{
  console.log("🔥 V11 SEARCH + GROQ + CLICK LEARNING RUNNING:", PORT);
});
