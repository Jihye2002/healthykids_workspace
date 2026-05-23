const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   LIVE RAG DATABASE
========================= */
let DOCUMENTS = [
  { title: "위생안전", text: "손씻기 마스크 기침예절 세균 예방", url: "/video.html" },
  { title: "손씻기", text: "손 씻는 6단계 방법", url: "/video.mp4" }
];

let VECTOR_DB = [];

/* =========================
   OPENAI EMBEDDING
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
    return data.data?.[0]?.embedding || [];
  } catch {
    return [];
  }
}

/* =========================
   REBUILD VECTOR DB (REALTIME)
========================= */
async function rebuild() {
  VECTOR_DB = [];

  for (const doc of DOCUMENTS) {
    const vector = await embed(doc.title + " " + doc.text);
    VECTOR_DB.push({ ...doc, vector });
  }

  console.log("🔄 VECTOR DB UPDATED:", DOCUMENTS.length);
}

rebuild();

/* =========================
   COSINE SIMILARITY
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
   SEMANTIC SEARCH
========================= */
async function search(query) {
  const qVec = await embed(query);

  return VECTOR_DB
    .map(d => ({
      ...d,
      score: cosine(qVec, d.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   GROQ ANSWER
========================= */
async function generate(query, results) {
  const context = results.map(r =>
`제목:${r.title}
내용:${r.text}
URL:${r.url}`
  ).join("\n\n");

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
            content: "반드시 JSON으로 {reply:'', results:[]}"
          },
          {
            role: "user",
            content: `질문:${query}\n\n자료:\n${context}`
          }
        ]
      })
    });

    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);

  } catch {
    return {
      reply: "검색 완료",
      results
    };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(msg) {
  const results = await search(msg);
  return await generate(msg, results);
}

/* =========================
   FILE UPLOAD → REALTIME UPDATE
========================= */
async function addFile(file) {
  const buffer = Buffer.from(file.content, "base64");

  let text = "";

  if (file.name.endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
  } else {
    text = buffer.toString("utf-8");
  }

  DOCUMENTS.push({
    title: file.name,
    text,
    url: "/uploaded"
  });

  await rebuild(); // 🔥 핵심: 업로드 즉시 반영
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

  /* CHAT */
  if (url === "/api/chat" && req.method === "POST") {
    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body);
        const result = await pipeline(message);

        res.writeHead(200);
        res.end(JSON.stringify(result));

      } catch {
        res.writeHead(500);
        res.end(JSON.stringify({ error: true }));
      }
    });

    return;
  }

  /* UPLOAD */
  if (url === "/api/upload" && req.method === "POST") {
    let body = "";

    req.on("data", c => body += c);

    req.on("end", async () => {
      try {
        const file = JSON.parse(body);

        await addFile(file);

        res.writeHead(200);
        res.end(JSON.stringify({
          ok: true,
          message: "업로드 완료 + 즉시 반영됨"
        }));

      } catch {
        res.writeHead(500);
        res.end(JSON.stringify({ error: true }));
      }
    });

    return;
  }

  /* STATIC */
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

server.listen(PORT, () => {
  console.log("🚀 AI RAG SERVER RUNNING:", PORT);
});
