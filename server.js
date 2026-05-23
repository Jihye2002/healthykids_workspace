const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

let DOCUMENTS = [];
let VECTOR_DB = [];

const UPLOAD_THRESHOLD = 0.72;

/* =========================
   UTIL
========================= */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 50 && t.length < 1200);
}

/* =========================
   LOAD SITE
========================= */
async function loadSite() {
  DOCUMENTS = [];

  const html = fs.readFileSync("index.html", "utf-8");

  splitParagraphs(stripHtml(html)).forEach((p, i) => {
    DOCUMENTS.push({
      title: `홈페이지 ${i + 1}`,
      text: p,
      url: "/index.html",
      type: "html"
    });
  });

  console.log("HTML LOADED");
}

/* =========================
   EMBEDDING
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
   VECTOR
========================= */
async function rebuildVector() {
  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const v = await embed(d.text);
    if (!v.length) continue;

    VECTOR_DB.push({ ...d, vector: v });
  }

  console.log("VECTOR READY:", VECTOR_DB.length);
}

/* =========================
   COSINE
========================= */
function cosine(a, b) {
  let dot = 0, ma = 0, mb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] ** 2;
    mb += b[i] ** 2;
  }

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   SEARCH (score 제거)
========================= */
async function search(query) {
  const q = await embed(query);
  if (!q.length) return [];

  return VECTOR_DB
    .map(d => ({
      title: d.title,
      text: d.text,
      url: d.url,
      type: d.type,
      score: cosine(q, d.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score, ...rest }) => rest);
}

/* =========================
   SAFE JSON PARSE
========================= */
function safeJSON(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    try {
      return JSON.parse(match[0]);
    } catch {
      return fallback;
    }
  }
}

/* =========================
   SUMMARY
========================= */
async function summarize(query, results) {

  const context = results.map(r => `
[문서]
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
너는 어린이 AI이다.
- 4~6줄 설명
- JSON만 출력

형식:
{
 "reply": "",
 "results": [
   { "title": "", "summary": "", "url": "", "type": "" }
 ]
}
`
        },
        {
          role: "user",
          content: `질문: ${query}\n\n${context}`
        }
      ]
    })
  });

  const data = await res.json();

  return safeJSON(data?.choices?.[0]?.message?.content, {
    reply: "검색 결과",
    results
  });
}

/* =========================
   PIPELINE
========================= */
async function pipeline(msg) {
  const results = await search(msg);
  return await summarize(msg, results);
}

/* =========================
   VIDEO SUPPORT (진짜 파일 서빙)
========================= */
function serveFile(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404");
    }
    res.writeHead(200);
    res.end(data);
  });
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req, res) => {

  const url = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  /* CHAT */
  if (url === "/api/chat") {
    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {
      const { message } = JSON.parse(body || "{}");
      const result = await pipeline(message);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    });
    return;
  }

  /* UPLOAD (PDF/VIDEO 구분) */
  if (url === "/api/upload") {
    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {
      const file = JSON.parse(body);

      if (file.name.endsWith(".pdf")) {
        const buffer = Buffer.from(file.content, "base64");
        const parsed = await pdfParse(buffer);

        splitParagraphs(parsed.text).forEach((p, i) => {
          DOCUMENTS.push({
            title: `${file.name}-${i}`,
            text: p,
            url: `/files/${file.name}`,
            type: "pdf"
          });
        });

      } else if (file.name.endsWith(".mp4")) {
        DOCUMENTS.push({
          title: file.name,
          text: `영상: ${file.name}`,
          url: `/files/${file.name}`,
          type: "video"
        });
      }

      await rebuildVector();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    return;
  }

  /* FILE SERVER (핵심!) */
  if (url.startsWith("/files/")) {
    return serveFile(req, res, path.join(__dirname, url));
  }

  /* STATIC */
  const filePath = url === "/" ? "index.html" : path.join(__dirname, url);
  serveFile(req, res, filePath);
});

/* =========================
   INIT
========================= */
(async () => {
  await loadSite();
  await rebuildVector();
})();

server.listen(PORT, () => {
  console.log("RUN:", PORT);
});
