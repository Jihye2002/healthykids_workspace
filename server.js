const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

let DOCUMENTS = [];
let VECTOR_DB = [];

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

/* =========================
   PARAGRAPH SPLIT
========================= */
function splitParagraphs(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 20);
}

/* =========================
   LOAD HTML
========================= */
async function loadSite() {
  DOCUMENTS = [];

  const indexHtml = fs.readFileSync("index.html", "utf-8");

  splitParagraphs(stripHtml(indexHtml)).forEach((p, i) => {
    DOCUMENTS.push({
      title: "홈페이지",
      text: p,
      url: "/",
      type: "html"
    });
  });

  console.log("📄 HTML LOADED");
}

/* =========================
   PDF LOAD (UPLOAD ONLY)
========================= */
async function loadPdfsFromUpload() {
  const dir = path.join(__dirname, "files");
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (!file.endsWith(".pdf")) continue;

    const buffer = fs.readFileSync(path.join(dir, file));
    const parsed = await pdfParse(buffer);

    const paragraphs = splitParagraphs(parsed.text);

    paragraphs.forEach((p, i) => {
      DOCUMENTS.push({
        title: file,
        text: p,
        url: `/files/${file}`,
        type: "pdf"
      });
    });
  }

  console.log("📄 PDF UPLOAD LOADED");
}

/* =========================
   EMBEDDING
========================= */
async function embed(text) {
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
}

/* =========================
   VECTOR BUILD
========================= */
async function rebuildVector() {
  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const v = await embed(d.text);
    VECTOR_DB.push({ ...d, vector: v });
  }

  console.log("🧠 VECTOR READY");
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
   SEARCH
========================= */
async function search(query) {
  const q = await embed(query);

  return VECTOR_DB
    .map(d => ({
      ...d,
      score: cosine(q, d.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/* =========================
   AI SUMMARY (아동용 쉬운 요약)
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
너는 5~7세 어린이를 위한 AI다.

규칙:
- 매우 쉬운 말로 설명
- 2~3줄 요약
- 반드시 JSON 출력
- URL은 반드시 그대로 사용

형식:
{
 "reply": "",
 "results": [
   {
     "title": "",
     "summary": "",
     "url": ""
   }
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

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      reply: "찾은 내용을 쉽게 정리했어요!",
      results
    };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(msg) {
  const results = await search(msg);
  return await summarize(msg, results);
}

/* =========================
   FILE UPLOAD (PDF ONLY)
========================= */
async function addFile(file) {
  if (!file.name.endsWith(".pdf")) {
    return { error: "PDF만 허용됩니다" };
  }

  const buffer = Buffer.from(file.content, "base64");
  const parsed = await pdfParse(buffer);

  const paragraphs = splitParagraphs(parsed.text);

  paragraphs.forEach((p) => {
    DOCUMENTS.push({
      title: file.name,
      text: p,
      url: `/files/${file.name}`,
      type: "pdf"
    });
  });

  await rebuildVector();
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

  /* UPLOAD */
  if (url === "/api/upload") {
    let body = "";

    req.on("data", c => body += c);

    req.on("end", async () => {
      const file = JSON.parse(body);
      const result = await addFile(file);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result || { ok: true }));
    });

    return;
  }

  /* STATIC */
  const filePath = url === "/" ? "index.html" : path.join(__dirname, url);

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
   INIT
========================= */
(async () => {
  await loadSite();
  await loadPdfsFromUpload();
  await rebuildVector();
})();

server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING:", PORT);
});
