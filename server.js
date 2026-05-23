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
  { title: "손씻기", text: "손 씻는 방법 6단계", url: "/video.mp4" },
  { title: "마스크", text: "올바른 마스크 착용법", url: "/mask.mp4" }
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
    return data?.data?.[0]?.embedding || [];
  } catch {
    return [];
  }
}

/* =========================
   VECTOR BUILD
========================= */
async function rebuild() {
  VECTOR_DB = [];

  for (const doc of DOCUMENTS) {
    const vector = await embed(doc.title + " " + doc.text);
    VECTOR_DB.push({ ...doc, vector });
  }

  console.log("✅ VECTOR DB READY:", VECTOR_DB.length);
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
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   SEMANTIC SEARCH (RAG)
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
   SAFE JSON PARSER
========================= */
function safeJSON(text) {
  if (!text) return null;

  try {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/* =========================
   GROQ AI RESPONSE
========================= */
async function askAI(query, results) {
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
            content: `
너는 어린이 교육용 AI 검색 엔진이다.

반드시 JSON만 출력:

{
  "reply": "짧은 설명",
  "results": [
    {
      "title": "",
      "text": "",
      "url": ""
    }
  ]
}

설명, 코드블럭, 텍스트 절대 금지.
            `
          },
          {
            role: "user",
            content: `질문: ${query}\n\n검색결과:\n${context}`
          }
        ]
      })
    });

    const data = await res.json();

    const raw = data?.choices?.[0]?.message?.content || "";

    const parsed = safeJSON(raw);

    if (parsed) return parsed;

    return {
      reply: raw,
      results
    };

  } catch (e) {
    console.error(e);
    return {
      reply: "검색 완료",
      results
    };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(message) {
  const results = await search(message);
  return await askAI(message, results);
}

/* =========================
   FILE UPLOAD (LIVE INDEX)
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

  await rebuild();

  console.log("📁 NEW FILE INDEXED:", file.name);
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  /* CORS */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  /* =========================
     CHAT API
  ========================= */
  if (url === "/api/chat" && req.method === "POST") {
    let body = "";

    req.on("data", c => body += c);

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body || "{}");

        const result = await pipeline(message);

        res.writeHead(200, {
          "Content-Type": "application/json"
        });

        res.end(JSON.stringify(result));

      } catch (e) {
        console.error("CHAT ERROR:", e);

        res.writeHead(500, {
          "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
          error: true,
          reply: "서버 오류"
        }));
      }
    });

    return;
  }

  /* =========================
     UPLOAD API
  ========================= */
  if (url === "/api/upload" && req.method === "POST") {
    let body = "";

    req.on("data", c => body += c);

    req.on("end", async () => {
      try {
        const file = JSON.parse(body || "{}");

        if (!file?.name || !file?.content) {
          res.writeHead(400);
          return res.end(JSON.stringify({ error: "invalid file" }));
        }

        await addFile(file);

        res.writeHead(200, {
          "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
          ok: true,
          message: "업로드 + 실시간 반영 완료"
        }));

      } catch (e) {
        console.error("UPLOAD ERROR:", e);

        res.writeHead(500);
        res.end(JSON.stringify({ error: true }));
      }
    });

    return;
  }

  /* =========================
     STATIC FILES
  ========================= */
  const filePath = url === "/" ? "index.html" : path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404 NOT FOUND");
    }

    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING ON PORT:", PORT);
});
