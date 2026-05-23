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

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 20);
}

/* =========================
   LOAD SITE
========================= */
function loadSite() {
  DOCUMENTS = [];

  const html = fs.readFileSync("index.html", "utf-8");

  splitParagraphs(stripHtml(html)).forEach((p, i) => {
    DOCUMENTS.push({
      title: `헬시키즈 메인 홈페이지 ${i + 1}`,
      text: p,
      url: "/index.html",
      type: "html"
    });
  });

  console.log("사이트 로딩 완료:", DOCUMENTS.length);
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
    VECTOR_DB.push({ ...d, vector: v || [] });
  }

  console.log("벡터 준비 완료:", VECTOR_DB.length);
}

/* =========================
   COSINE
========================= */
function cosine(a, b) {
  if (!a.length || !b.length) return 0;

  let dot = 0, ma = 0, mb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] ** 2;
    mb += b[i] ** 2;
  }

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   SEARCH (안정 + 키워드 보강)
========================= */
async function search(query) {
  const q = await embed(query);

  return DOCUMENTS.map(d => {
    let score = 0;

    if (q.length && d.vector.length) {
      score = cosine(q, d.vector);
    }

    if (d.text.includes(query)) score += 0.3;

    return { ...d, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ score, ...r }) => r);
}

/* =========================
   SAFE JSON
========================= */
function safeJSON(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return fallback;
    try {
      return JSON.parse(m[0]);
    } catch {
      return fallback;
    }
  }
}

/* =========================
   CHILD FRIENDLY SUMMARY (핵심 수정)
========================= */
async function summarize(query, results) {

  const context = results.map(r => `
[자료]
제목: ${r.title}
내용: ${r.text}
링크: ${r.url}
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
너는 5~7세 아이들과 선생님을 위한 아주 친절한 교육 AI야.

반드시 아래 규칙을 지켜:

1. 말투는 아주 부드럽고 따뜻하게
2. 설명은 5~7줄 정도로 조금 자세하게
3. 어려운 단어는 쉽게 풀어서 설명
4. 친근한 예시를 포함
5. JSON만 출력

출력 형식:
{
 "reply": "",
 "results": [
   {
     "title": "",
     "summary": "",
     "url": "",
     "type": ""
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

    return safeJSON(data?.choices?.[0]?.message?.content, {
      reply: "잠깐만 기다려주세요 😊",
      results
    });

  } catch {
    return {
      reply: "내용을 정리했어요 😊",
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

  if (file.name.endsWith(".pdf")) {
    const buffer = Buffer.from(file.content, "base64");
    const parsed = await pdfParse(buffer);

    splitParagraphs(parsed.text).forEach((p, i) => {
      DOCUMENTS.push({
        title: `📄 ${file.name} ${i + 1}`,
        text: p,
        url: "/files/" + file.name,
        type: "pdf"
      });
    });
  }

  if (file.name.endsWith(".mp4")) {
    DOCUMENTS.push({
      title: `🎬 ${file.name}`,
      text: "이 영상은 쉽고 재미있는 학습 영상이에요",
      url: "/files/" + file.name,
      type: "video"
    });
  }

  await rebuildVector();
  return { ok: true };
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
      const file = JSON.parse(body || "{}");
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
      return res.end("페이지를 찾을 수 없어요");
    }
    res.writeHead(200);
    res.end(data);
  });
});

(async () => {
  loadSite();
  await rebuildVector();
})();

server.listen(PORT, () => {
  console.log("헬시키즈 서버 실행:", PORT);
});
