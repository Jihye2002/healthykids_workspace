const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   MEMORY
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   RULE
========================= */
const UPLOAD_THRESHOLD = 0.72;

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
   SPLIT (개선)
========================= */
function splitParagraphs(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 50 && t.length < 1200);
}

/* =========================
   LOAD SITE (구조 개선)
========================= */
async function loadSite() {
  DOCUMENTS = [];

  const indexHtml = fs.readFileSync("index.html", "utf-8");

  const sections = splitParagraphs(stripHtml(indexHtml));

  sections.forEach((p, i) => {
    DOCUMENTS.push({
      title: `홈페이지 콘텐츠 ${i + 1}`,
      text: p,
      url: "/index.html",
      type: "html"
    });
  });

  console.log("📄 HTML LOADED:", DOCUMENTS.length);
}

/* =========================
   PDF LOAD
========================= */
async function loadPdfsFromUpload() {
  const dir = path.join(__dirname, "files");
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (!file.endsWith(".pdf")) continue;

    const buffer = fs.readFileSync(path.join(dir, file));
    const parsed = await pdfParse(buffer);

    splitParagraphs(parsed.text).forEach((p, i) => {
      DOCUMENTS.push({
        title: `${file} - 섹션 ${i + 1}`,
        text: p,
        url: `/files/${file}`,
        type: "pdf"
      });
    });
  }

  console.log("📄 PDF LOADED:", files.length);
}

/* =========================
   VIDEO LOAD (NEW)
========================= */
function addVideoFile(file) {
  DOCUMENTS.push({
    title: file.name.replace(".mp4", ""),
    text: `이 영상은 "${file.name}"에 대한 학습 영상입니다. 내용은 해당 주제 설명 영상입니다.`,
    url: `/files/${file.name}`,
    type: "video"
  });
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
    .map(({ score, ...rest }) => rest); // ⭐ score 제거
}

/* =========================
   AI SUMMARY (자유형)
========================= */
async function summarize(query, results) {

  const context = results.map(r => `
[문서]
제목: ${r.title}
내용: ${r.text}
URL: ${r.url}
`).join("\n");

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
너는 어린이 학습 AI이다.

- 자유롭게 설명
- 4~6줄 정도
- 형식 강제 없음
- 쉽게 설명
- JSON 출력

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
    return JSON.parse(data.choices[0].message.content);

  } catch {
    return {
      reply: "검색 결과를 쉽게 정리했어요!",
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
   FILE UPLOAD
========================= */
async function addFile(file) {
  try {

    if (file.name.endsWith(".pdf")) {
      const buffer = Buffer.from(file.content, "base64");
      const parsed = await pdfParse(buffer);

      splitParagraphs(parsed.text).forEach((p, i) => {
        DOCUMENTS.push({
          title: `${file.name} - ${i + 1}`,
          text: p,
          url: `/files/${file.name}`,
          type: "pdf"
        });
      });

    } else if (file.name.endsWith(".mp4")) {
      addVideoFile(file);
    } else {
      return { error: "PDF / MP4만 업로드 가능" };
    }

    await rebuildVector();

    return {
      ok: true,
      message: "업로드 완료"
    };

  } catch (e) {
    return { error: "업로드 실패" };
  }
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

  if (url === "/api/upload") {
    let body = "";

    req.on("data", c => body += c);

    req.on("end", async () => {
      const file = JSON.parse(body);
      const result = await addFile(file);

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
