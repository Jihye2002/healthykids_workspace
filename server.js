const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const ffmpeg = require("fluent-ffmpeg");

const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

let DOCS = [];

/* =========================
   HTML CLEAN (NAV 제거)
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
  const regex = /href="(.*?)".*?>(.*?)<\/a>/g;
  const links = [];

  let m;
  while ((m = regex.exec(html))) {
    links.push({
      url: m[1],
      label: m[2].replace(/<[^>]+>/g, "").trim()
    });
  }

  return links;
}

/* =========================
   FILE LOAD (mp4 포함)
========================= */
async function loadFiles() {
  DOCS = [];

  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    const full = path.join(__dirname, file);

    /* HTML */
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

    /* PDF */
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

    /* IMAGE OCR */
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

    /* =========================
       🎥 MP4 VIDEO 처리 (핵심)
    ========================= */
    if (file.endsWith(".mp4")) {
      const audioPath = full + ".wav";

      await new Promise((resolve) => {
        ffmpeg(full)
          .noVideo()
          .audioCodec("pcm_s16le")
          .save(audioPath)
          .on("end", resolve);
      });

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1"
      });

      fs.unlinkSync(audioPath);

      DOCS.push({
        type: "video",
        title: file,
        text: transcription.text,
        links: [],
        url: `/${file}`
      });
    }
  }

  console.log("DOCS LOADED:", DOCS.length);
}

/* =========================
   SEARCH (의미 기반)
========================= */
function search(query) {
  const q = query.toLowerCase();

  return DOCS
    .map(d => {
      let score = 0;

      if (d.text.toLowerCase().includes(q)) score += 2;

      q.split(" ").forEach(k => {
        if (d.text.toLowerCase().includes(k)) score += 0.5;
      });

      return { ...d, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/* =========================
   AI RESPONSE (교육용)
========================= */
async function generateAI(query, docs) {

  const context = docs.map(d => `
TYPE: ${d.type}
URL: ${d.url}
TEXT:
${d.text.slice(0, 600)}
`).join("\n\n");

  const prompt = `
너는 5~7세 어린이를 위한 교육 AI이다.

규칙:
- 쉬운 말만 사용
- 영상/문서 내용을 이해해서 설명
- nav/footer 금지
- 반드시 개념 기반 버튼 생성

출력:
{
  "answer": "쉬운 설명 1~2문장",
  "buttons": [
    { "label": "연관 개념", "url": "링크" }
  ]
}

연관 개념 예:
감기 → 손씻기 / 마스크 / 기침예절 / 병원 / 독감

질문:
${query}

문서:
${context}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Return ONLY JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  });

  try {
    return JSON.parse(res.choices[0].message.content);
  } catch {
    return { answer: "이해 실패", buttons: [] };
  }
}

/* =========================
   API
========================= */
app.post("/api/chat", async (req, res) => {

  const q = req.body.message;

  const docs = search(q);
  const ai = await generateAI(q, docs);

  res.json({
    answer: ai.answer,
    buttons: ai.buttons,
    sources: docs
  });
});

/* =========================
   INIT
========================= */
(async () => {
  await loadFiles();
})();

app.listen(PORT, () => {
  console.log("AI ENGINE RUNNING:", PORT);
});
