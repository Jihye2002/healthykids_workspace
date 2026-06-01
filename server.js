const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const fetch = global.fetch || require("node-fetch");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));

/* =========================
   DATA
========================= */
let DOCS = [];
let CACHE = new Map();

/* =========================
   HTML CLEAN
========================= */
function cleanHTML(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   LINK EXTRACT
========================= */
function extractLinks(html) {
  const links = [];
  const regex = /href="(.*?)".*?>(.*?)<\/a>/g;

  let match;
  while ((match = regex.exec(html))) {
    links.push({
      url: match[1],
      label: match[2].replace(/<[^>]+>/g, "").trim()
    });
  }

  return links;
}

/* =========================
   LOAD DOCS
========================= */
async function loadFiles() {
  DOCS = [];
  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    const full = path.join(__dirname, file);

    if (file.endsWith(".html")) {
      const html = fs.readFileSync(full, "utf8");

      DOCS.push({
        type: "html",
        title: file,
        text: cleanHTML(html),
        links: extractLinks(html),
        url: `/${file}`
      });
    }

    if (file.endsWith(".pdf")) {
      const buf = fs.readFileSync(full);
      const pdf = await pdfParse(buf);

      DOCS.push({
        type: "pdf",
        title: file,
        text: pdf.text,
        links: [],
        url: `/${file}`
      });
    }

    if (file.match(/\.(png|jpg|jpeg)$/)) {
      const ocr = await Tesseract.recognize(full, "kor+eng");

      DOCS.push({
        type: "image",
        title: file,
        text: ocr.data.text,
        links: [],
        url: `/${file}`
      });
    }

    // mp4는 "파일 정보만"
    if (file.endsWith(".mp4")) {
      DOCS.push({
        type: "video",
        title: file,
        text: "VIDEO_FILE_AVAILABLE",
        links: [],
        url: `/${file}`
      });
    }
  }

  console.log("DOCS LOADED:", DOCS.length);
}

/* =========================
   SIMPLE SEARCH
========================= */
function search(query) {
  const q = query.toLowerCase();

  return DOCS
    .map(d => ({
      ...d,
      score: d.text.toLowerCase().includes(q) ? 2 : 0
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/* =========================
   AI CORE (핵심)
========================= */
async function generateAI(query, docs) {

  const context = docs.map(d => `
TYPE: ${d.type}
TITLE: ${d.title}
URL: ${d.url}

CONTENT:
${d.text.slice(0, 500)}

LINKS:
${(d.links || []).map(l => `- ${l.label} → ${l.url}`).join("\n")}
`).join("\n\n");

  const prompt = `
너는 "AI 교육 검색 엔진"이다 (5~7세 대상).

규칙:
- 메뉴/nav/footer 절대 출력 금지
- 오직 의미 있는 정보만 사용
- 결과는 반드시 버튼으로 제공
- 버튼은 반드시 URL 포함

특별 규칙:
- video 타입이면 "영상 요약도 함께 생성"
- 감정 표현 없이 짧고 명확하게

출력 JSON:
{
  "answer": "",
  "buttons": [
    { "label": "", "url": "" }
  ]
}

질문:
${query}

문서:
${context}
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { answer: "처리 실패", buttons: [] };
  }
}

// [수정] 경로 앞에 슬래시(/)를 확인하세요
app.get("/api/config", (req, res) => {
    console.log("Config requested!"); // 서버 로그에 찍히는지 확인용
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL || "NOT_SET",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "NOT_SET"
    });
});

/* =========================
   API
========================= */
app.post("/api/chat", async (req, res) => {

  const q = req.body.message || "";

  if (CACHE.has(q)) return res.json(CACHE.get(q));

  const docs = search(q);
  const ai = await generateAI(q, docs);

  const result = {
    query: q,
    answer: ai.answer,
    buttons: ai.buttons,
    results: docs
  };

  CACHE.set(q, result);
  res.json(result);
});

app.use(express.static(__dirname));

/* =========================
   START
========================= */
(async () => {
  await loadFiles();
})();

app.listen(PORT, () => {
  console.log("AI ENGINE RUNNING:", PORT);
});
