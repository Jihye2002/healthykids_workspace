const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");

const fetch = global.fetch || require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   DATA
========================= */
let DOCS = [];
let CACHE = new Map();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

/* =========================
   HTML CLEAN (본문용)
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
   LINK EXTRACT (nav 포함)
========================= */
function extractLinks(html) {
  const links = [];
  const regex = /href="(.*?)".*?>(.*?)<\/a>/g;

  let match;
  while ((match = regex.exec(html))) {
    const url = match[1];
    const label = match[2].replace(/<[^>]+>/g, "").trim();

    if (url && label) {
      links.push({ url, label });
    }
  }

  return links;
}

/* =========================
   TEXT SPLIT
========================= */
function splitText(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 25);
}

/* =========================
   LOAD FILES (MULTIMODAL)
========================= */
async function loadFiles() {
  DOCS = [];

  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    const full = path.join(__dirname, file);

    /* ================= HTML ================= */
    if (file.endsWith(".html")) {
      const html = fs.readFileSync(full, "utf8");

      const links = extractLinks(html);
      const clean = cleanHTML(html);

      DOCS.push({
        type: "html",
        title: file,
        text: clean,
        links,
        url: `/${file}`
      });
    }

    /* ================= PDF ================= */
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

    /* ================= IMAGE ================= */
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
  }

  console.log("📦 DOCS LOADED:", DOCS.length);
}

/* =========================
   SIMPLE RETRIEVAL (AI용 컨텍스트)
========================= */
function search(query) {
  const q = query.toLowerCase();

  return DOCS
    .map(d => {
      const score = d.text.toLowerCase().includes(q) ? 2 : 0;
      return { ...d, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/* =========================
   AI GENERATION (핵심)
========================= */
async function generateAI(query, docs) {

  const context = docs.map(d => `
TYPE: ${d.type}
TITLE: ${d.title}
URL: ${d.url}

CONTENT:
${d.text.slice(0, 400)}

AVAILABLE LINKS:
${(d.links || []).map(l => `- ${l.label} → ${l.url}`).join("\n")}
`).join("\n\n");

  const prompt = `
너는 "웹사이트 이해형 AI 검색 엔진"이다.

절대 규칙:
- nav, footer, menu 같은 구조 설명은 출력 금지
- 오직 "사용자에게 의미 있는 정보"만 출력
- URL은 반드시 제공된 링크 중에서만 선택

해야 할 것:
1. 질문 핵심 요약
2. 연관 개념 3~6개 생성
3. 각 개념은 버튼 형태로 출력
4. 버튼은 반드시 URL 포함

출력 형식 (JSON):
{
  "answer": "...",
  "buttons": [
    { "label": "...", "url": "..." }
  ]
}

사용자 질문:
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
        { role: "system", content: "Return ONLY valid JSON. No extra text." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    return {
      answer: "AI 생성 실패",
      buttons: []
    };
  }
}

/* =========================
   API
========================= */
app.post("/api/chat", async (req, res) => {

  const q = req.body.message || "";

  if (CACHE.has(q)) {
    return res.json(CACHE.get(q));
  }

  const docs = search(q);
  const ai = await generateAI(q, docs);

  const result = {
    query: q,
    answer: ai.answer,
    buttons: ai.buttons,
    results: docs.map(d => ({
      type: d.type,
      title: d.title,
      url: d.url,
      preview: d.text.slice(0, 120)
    }))
  };

  CACHE.set(q, result);

  res.json(result);
});

/* =========================
   INIT
========================= */
(async () => {
  await loadFiles();
})();

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 V18 AI WEB UNDERSTANDING ENGINE RUNNING:", PORT);
});
