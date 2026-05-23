const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================
   DOCUMENTS
========================= */
const DOCUMENTS = [
  { id: 1, title: "질병예방", text: "감기 독감 바이러스 예방 면역 손씻기 기침예절", popularity: 8, url: "/video.html?type=precaution" },
  { id: 2, title: "위생안전", text: "손씻기 세균 마스크 개인위생 바이러스", popularity: 10, url: "/video.html?type=hygiene" },
  { id: 3, title: "실외안전", text: "횡단보도 교통 안전 사고 예방 길건너기", popularity: 7, url: "/video.html?type=crosswalk" },
  { id: 4, title: "생활건강", text: "식습관 영양 건강 음식 균형 성장", popularity: 6, url: "/video.html?type=foodsafety" }
];

/* =========================
   EMBEDDING (OPENAI)
========================= */
async function embed(text) {
  try {
    if (!OPENAI_API_KEY) return new Array(1536).fill(0);

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

    return data?.data?.[0]?.embedding || new Array(1536).fill(0);

  } catch {
    return new Array(1536).fill(0);
  }
}

/* =========================
   COSINE
========================= */
function cosine(a, b) {
  if (!a || !b) return 0;

  let dot = 0, ma = 0, mb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   VECTOR DB
========================= */
let VECTOR_DB = [];

async function buildDB() {
  VECTOR_DB = [];

  for (let doc of DOCUMENTS) {
    const vec = await embed(doc.title + " " + doc.text);
    VECTOR_DB.push({ ...doc, vector: vec });
  }

  console.log("✅ VECTOR DB READY");
}

/* =========================
   SEARCH
========================= */
async function search(query) {
  const qVec = await embed(query);

  return VECTOR_DB
    .map(doc => ({
      ...doc,
      score: cosine(qVec, doc.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   GROQ ANSWER
========================= */
async function generateAnswer(query, results) {
  try {
    const context = results.map(r => `
제목: ${r.title}
내용: ${r.text}
URL: ${r.url}
`).join("\n");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "system",
            content: "반드시 JSON으로만 답변: {\"reply\":\"\",\"results\":[]}"
          },
          {
            role: "user",
            content: `질문:${query}\n\n${context}`
          }
        ]
      })
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    try {
      return JSON.parse(content);
    } catch {
      return { reply: content || "검색 완료", results };
    }

  } catch {
    return { reply: "서버 오류 발생", results: [] };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(message) {
  const results = await search(message);
  return await generateAnswer(message, results);
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req, res) => {

  const url = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  /* =========================
     API
  ========================= */
  if (url === "/api/chat") {

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "method not allowed" }));
    }

    let body = "";

    req.on("data", c => body += c);

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body || "{}");

        const result = await pipeline(message);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));

      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: true,
          reply: "서버 오류 발생 😢",
          results: []
        }));
      }
    });

    return;
  }

  /* =========================
     STATIC FILES
  ========================= */
  let filePath = url === "/" ? "index.html" : path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404");
    }

    const ext = path.extname(filePath);

    const mime = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg"
    };

    res.writeHead(200, {
      "Content-Type": mime[ext] || "text/plain"
    });

    res.end(data);
  });
});

/* =========================
   START
========================= */
server.listen(PORT, async () => {
  console.log("🚀 SERVER RUNNING ON", PORT);
  await buildDB();
});
