const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DATA
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   CLEAN HTML
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
   BETTER PARAGRAPH SPLIT (핵심 개선)
========================= */
function splitParagraphs(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 25); // 너무 짧은 것 제거 (정확도 핵심)
}

/* =========================
   LINK EXTRACT
========================= */
function extractLinks(html) {
  const regex = /href="([^"#]+)"/g;
  const links = new Set();
  let m;

  while ((m = regex.exec(html))) {
    const url = m[1];
    if (!url.startsWith("http") && !url.startsWith("mailto:")) {
      links.add(url.split("?")[0]);
    }
  }

  return [...links];
}

/* =========================
   LOAD SITE (HTML → 문단)
========================= */
async function loadSite() {
  DOCUMENTS = [];

  const indexHtml = fs.readFileSync("index.html", "utf-8");
  const links = extractLinks(indexHtml);

  const homeParagraphs = splitParagraphs(stripHtml(indexHtml));

  homeParagraphs.forEach((p, i) => {
    DOCUMENTS.push({
      title: "홈페이지",
      text: p,
      url: "/",
      type: "html",
      id: `home-${i}`
    });
  });

  for (const link of links) {
    const filePath = path.join(__dirname, link);
    if (!fs.existsSync(filePath)) continue;

    const html = fs.readFileSync(filePath, "utf-8");
    const paragraphs = splitParagraphs(stripHtml(html));

    paragraphs.forEach((p, i) => {
      DOCUMENTS.push({
        title: link,
        text: p,
        url: "/" + link,
        type: "html",
        id: `${link}-${i}`
      });
    });
  }

  console.log("📄 HTML PARAGRAPH LOADED:", DOCUMENTS.length);
}

/* =========================
   LOAD PDF (문단 기반)
========================= */
async function loadPdfs() {
  const pdfDir = path.join(__dirname, "files");
  if (!fs.existsSync(pdfDir)) return;

  const files = fs.readdirSync(pdfDir);

  for (const file of files) {
    if (!file.endsWith(".pdf")) continue;

    const buffer = fs.readFileSync(path.join(pdfDir, file));
    const parsed = await pdfParse(buffer);

    const paragraphs = splitParagraphs(parsed.text);

    paragraphs.forEach((p, i) => {
      DOCUMENTS.push({
        title: file,
        text: p,
        url: `/files/${file}`,
        type: "pdf",
        id: `${file}-${i}`,
        page: i + 1
      });
    });
  }

  console.log("📄 PDF PARAGRAPH LOADED:", files.length);
}

/* =========================
   EMBEDDING (안정화)
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
  } catch (e) {
    return [];
  }
}

/* =========================
   VECTOR BUILD
========================= */
async function rebuildVector() {
  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const v = await embed(d.text);
    if (!v.length) continue;

    VECTOR_DB.push({ ...d, vector: v });
  }

  console.log("🧠 VECTOR READY:", VECTOR_DB.length);
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
   SEARCH (Top 6)
========================= */
async function search(query) {
  const qVec = await embed(query);
  if (!qVec.length) return [];

  return VECTOR_DB
    .map(d => ({
      ...d,
      score: cosine(qVec, d.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/* =========================
   AI SUMMARY (JSON 안정화)
========================= */
async function summarize(query, results) {

  const context = results.slice(0, 5).map(r => `
[문단]
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
너는 어린이용 검색 AI이다.

반드시 JSON만 출력한다.
설명 금지.

형식:
{
  "reply": "쉬운 설명",
  "results": [
    {
      "title": "",
      "summary": "",
      "url": ""
    }
  ]
}

규칙:
- URL은 반드시 제공된 것만 사용
- 문단 기반으로만 요약
- 과장 금지
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
  } catch (e) {
    return {
      reply: "검색 결과를 찾았어요",
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
  if (url === "/api/chat" && req.method === "POST") {
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
  await loadPdfs();
  await rebuildVector();
})();

server.listen(PORT, () => {
  console.log("🚀 RUNNING:", PORT);
});
