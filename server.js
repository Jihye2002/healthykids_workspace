const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DOCUMENTS
========================= */
const DOCUMENTS = [
  {
    id: 1,
    title: "질병예방",
    text: "감기 독감 바이러스 예방 면역 손씻기 기침예절",
    popularity: 8,
    url: "/video.html?type=precaution"
  },
  {
    id: 2,
    title: "위생안전",
    text: "손씻기 세균 마스크 개인위생 바이러스",
    popularity: 10,
    url: "/video.html?type=hygiene"
  },
  {
    id: 3,
    title: "실외안전",
    text: "횡단보도 교통 안전 사고 예방 길건너기",
    popularity: 7,
    url: "/video.html?type=crosswalk"
  },
  {
    id: 4,
    title: "생활건강",
    text: "식습관 영양 건강 음식 균형 성장",
    popularity: 6,
    url: "/video.html?type=foodsafety"
  }
];

/* =========================
   1. EMBEDDING
========================= */
async function embed(text) {

  const res = await fetch("https://api.groq.com/openai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-embedding",
      input: text
    })
  });

  const data = await res.json();

  return data.data[0].embedding;
}

/* =========================
   2. COSINE
========================= */
function cosine(a, b) {

  let dot = 0;
  let ma = 0;
  let mb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   3. VECTOR DB
========================= */
let VECTOR_DB = [];

async function buildDB() {

  for (let doc of DOCUMENTS) {

    const vec = await embed(doc.title + " " + doc.text);

    VECTOR_DB.push({
      ...doc,
      vector: vec
    });
  }

  console.log("✅ VECTOR DB READY");
}

buildDB();

/* =========================
   4. QUERY INTENT ANALYSIS (AI)
========================= */
async function analyzeIntent(query) {

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
          content: `
너는 검색 의도 분석기다.

출력 JSON:
{
  "keywords":["..."],
  "category":"health|safety|hygiene|etc"
}
`
        },
        {
          role: "user",
          content: query
        }
      ]
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      keywords: query.split(" "),
      category: "general"
    };
  }
}

/* =========================
   5. HYBRID SEARCH (핵심)
========================= */
async function search(query, keywords) {

  const qVec = await embed(query);

  const scored = VECTOR_DB.map(doc => {

    let vectorScore = cosine(qVec, doc.vector);

    let keywordScore = keywords.reduce((acc, k) => {
      return acc +
        (doc.text.includes(k) ? 2 : 0) +
        (doc.title.includes(k) ? 4 : 0);
    }, 0);

    let popularityScore = doc.popularity / 10;

    let finalScore =
      vectorScore * 0.7 +
      keywordScore * 0.2 +
      popularityScore * 0.1;

    return {
      ...doc,
      score: finalScore
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   6. AI RERANK + ANSWER
========================= */
async function generateAnswer(query, results) {

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
          content: `
너는 Google 검색 AI다.

규칙:
1. 결과 기반 설명
2. 자연스럽게 요약
3. JSON 출력

{
 "reply":"설명",
 "results":[{"title":"","description":"","url":""}]
}
`
        },
        {
          role: "user",
          content: `질문:${query}\n\n결과:\n${context}`
        }
      ]
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      reply: "검색 결과를 찾았습니다",
      results
    };
  }
}

/* =========================
   API
========================= */
const server = http.createServer(async (req, res) => {

  const url = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (url === "/api/chat" && req.method === "POST") {

    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {

      const { message } = JSON.parse(body);

      // 1. intent analysis
      const intent = await analyzeIntent(message);

      // 2. hybrid search
      const results = await search(message, intent.keywords);

      // 3. AI answer
      const answer = await generateAnswer(message, results);

      res.end(JSON.stringify(answer));
    });

    return;
  }

  /* STATIC */
  let filePath = url === "/"
    ? "index.html"
    : path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404");
    }

    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 v3 PRODUCTION SEARCH ENGINE RUNNING");
});
