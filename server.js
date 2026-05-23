const http = require("http");
const fs = require("fs");
const path = require("path");

/* =========================
   ENV
========================= */
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
   EMBEDDING (OPENAI SAFE)
========================= */
async function embed(text) {
  try {
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

    if (!data?.data?.[0]?.embedding) {
      console.log("❌ EMBED FAIL:", data);
      return new Array(1536).fill(0);
    }

    return data.data[0].embedding;

  } catch (err) {
    console.log("❌ EMBED ERROR:", err);
    return new Array(1536).fill(0);
  }
}

/* =========================
   COSINE SIMILARITY
========================= */
function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

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
   VECTOR DB
========================= */
let VECTOR_DB = [];

async function buildDB() {
  try {
    VECTOR_DB = [];

    for (let doc of DOCUMENTS) {
      const vec = await embed(doc.title + " " + doc.text);

      VECTOR_DB.push({
        ...doc,
        vector: vec
      });
    }

    console.log("✅ VECTOR DB READY:", VECTOR_DB.length);

  } catch (err) {
    console.log("❌ buildDB ERROR:", err);
  }
}

/* =========================
   INTENT ANALYSIS (GROQ)
========================= */
async function analyzeIntent(query) {
  try {
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
            content: `너는 검색 의도 분석기다. JSON만 출력:
{"keywords":[""],"category":""}`
          },
          { role: "user", content: query }
        ]
      })
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) throw new Error("no intent");

    return JSON.parse(content);

  } catch (err) {
    return {
      keywords: query.split(" "),
      category: "general"
    };
  }
}

/* =========================
   SEARCH ENGINE
========================= */
async function search(query, keywords) {
  const qVec = await embed(query);

  const scored = VECTOR_DB.map(doc => {
    const vectorScore = cosine(qVec, doc.vector);

    const keywordScore = keywords.reduce((acc, k) => {
      return acc +
        (doc.text.includes(k) ? 2 : 0) +
        (doc.title.includes(k) ? 4 : 0);
    }, 0);

    const popularityScore = doc.popularity / 10;

    return {
      ...doc,
      score: vectorScore * 0.7 + keywordScore * 0.2 + popularityScore * 0.1
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
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
            content: "너는 검색 결과 기반 AI다. JSON으로 답변해라."
          },
          {
            role: "user",
            content: `질문:${query}\n\n결과:\n${context}`
          }
        ]
      })
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return { reply: "검색 결과를 찾았습니다", results };
    }

    try {
      return JSON.parse(content);
    } catch {
      return { reply: content, results };
    }

  } catch (err) {
    return { reply: "서버 오류", results: [] };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(message) {
  const intent = await analyzeIntent(message);
  const results = await search(message, intent.keywords);
  return await generateAnswer(message, results);
}

/* =========================
   SERVER
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
    req.on("data", chunk => body += chunk);

    req.on("end", async () => {
      const { message } = JSON.parse(body);

      const result = await pipeline(message);

      res.end(JSON.stringify(result));
    });

    return;
  }

  /* STATIC FILES */
  let filePath = url === "/" ? "index.html" : path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404");
    }

    res.writeHead(200);
    res.end(data);
  });
});

/* =========================
   START (SAFE)
========================= */
server.listen(PORT, async () => {
  console.log("🚀 SERVER STARTING...");

  await buildDB();

  console.log("🚀 READY ON PORT", PORT);
});
