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
   TEXT CLEAN
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
   LINK PARSER
========================= */
function extractLinks(html) {
  const regex = /href="([^"#]+)"/g;
  const set = new Set();
  let m;

  while ((m = regex.exec(html))) {
    const link = m[1];
    if (!link.startsWith("http") && !link.startsWith("mailto:")) {
      set.add(link.split("?")[0]);
    }
  }

  return [...set];
}

/* =========================
   PDF → PARAGRAPH SPLIT
========================= */
function splitParagraph(text) {
  return text
    .split(/\n\s*\n/)
    .map(t => t.replace(/\s+/g, " ").trim())
    .filter(t => t.length > 30);
}

/* =========================
   LOAD SITE
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
}

/* =========================
   LOAD PDF (PARAGRAPH BASED)
========================= */
async function loadPdfs() {
  const dir = path.join(__dirname, "files");
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (!file.endsWith(".pdf")) continue;

    const buffer = fs.readFileSync(path.join(dir, file));
    const parsed = await pdfParse(buffer);

    const paragraphs = splitParagraph(parsed.text);

    paragraphs.forEach((p, i) => {
      DOCUMENTS.push({
        title: file + ` (p${i})`,
        text: p,
        url: "/files/" + file
      });
    });
  }
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
async function rebuild() {
  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const v = await embed(d.title + " " + d.text);
    VECTOR_DB.push({ ...d, vector: v });
  }
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
async function search(q) {
  const qv = await embed(q);

  return VECTOR_DB
    .map(d => ({
      ...d,
      score: cosine(qv, d.vector)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   AI RESPONSE (CHILD FRIENDLY)
========================= */
async function askAI(query, results) {

  const context = results.map(r =>
`제목: ${r.title}
내용: ${r.text}
URL: ${r.url}`).join("\n\n");

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
너는 5~7세 어린이와 선생님을 위한 교육용 AI다.

반드시 JSON만 출력:

{
 "reply": "아주 쉽고 친절한 설명",
 "results": [
   {
     "title": "",
     "summary": "",
     "url": ""
   }
 ]
}

규칙:
- 무조건 쉬운 말
- 친절한 말투
- URL은 제공된 것만 사용
- 추측 금지
          `
        },
        {
          role: "user",
          content: `질문: ${query}\n\n문서:\n${context}`
        }
      ]
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      reply: "찾은 내용을 쉽게 정리했어요 😊",
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

(async () => {
  await loadSite();
  await loadPdfs();
  await rebuild();
})();

server.listen(PORT, () => {
  console.log("🚀 RUNNING:", PORT);
});
