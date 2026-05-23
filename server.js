const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DATA STORE
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   HTML CLEANER
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
   LINK EXTRACTOR
========================= */
function extractLinks(html) {
  const regex = /href="([^"#]+)"/g;
  const links = new Set();
  let match;

  while ((match = regex.exec(html))) {
    const url = match[1];
    if (!url.startsWith("http") && !url.startsWith("mailto:")) {
      links.add(url.split("?")[0]);
    }
  }

  return [...links];
}

/* =========================
   LOAD SITE AUTO INDEX
========================= */
async function loadSite() {
  DOCUMENTS = [];

  const indexHtml = fs.readFileSync(path.join(__dirname, "index.html"), "utf-8");
  const links = extractLinks(indexHtml);

  DOCUMENTS.push({
    title: "홈",
    text: stripHtml(indexHtml),
    url: "/"
  });

  for (const link of links) {
    const filePath = path.join(__dirname, link);
    if (!fs.existsSync(filePath)) continue;

    const html = fs.readFileSync(filePath, "utf-8");

    DOCUMENTS.push({
      title: link,
      text: stripHtml(html),
      url: "/" + link
    });
  }

  console.log("📦 DOCS:", DOCUMENTS.length);
}

/* =========================
   OPENAI EMBEDDING
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

  for (const doc of DOCUMENTS) {
    const vector = await embed(doc.title + " " + doc.text);
    VECTOR_DB.push({ ...doc, vector });
  }

  console.log("🧠 VECTOR READY");
}

/* =========================
   COSINE SIM
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
   AI RESPONSE
========================= */
async function askAI(query, results) {
  const context = results.map(r =>
`제목:${r.title}
내용:${r.text.slice(0, 250)}
URL:${r.url}`
  ).join("\n\n");

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
너는 웹 검색 AI다.
반드시 JSON만 출력:

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

URL은 반드시 제공된 것만 사용
          `
        },
        {
          role: "user",
          content: `질문:${query}\n\n문서:\n${context}`
        }
      ]
    })
  });

  const data = await res.json();

  try {
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
  return await askAI(msg, results);
}

/* =========================
   FILE UPLOAD
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

  await rebuildVector();
}

/* =========================
   AUTO RELOAD WATCHER (핵심)
========================= */
fs.watch(__dirname, async () => {
  console.log("🔄 FILE CHANGED → REINDEX");
  await loadSite();
  await rebuildVector();
});

/* =========================
   INIT
========================= */
(async () => {
  await loadSite();
  await rebuildVector();
})();

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

  if (url === "/api/upload" && req.method === "POST") {
    let body = "";

    req.on("data", c => body += c);

    req.on("end", async () => {
      const file = JSON.parse(body);
      await addFile(file);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    return;
  }

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

server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING:", PORT);
});
