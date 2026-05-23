const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const { exec } = require("child_process");

const fetch = global.fetch || require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   DATA
========================= */
let DOCS = [];
let VECTORS = [];
let CACHE = new Map();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

/* =========================
   NORMALIZE
========================= */
function normalize(t = "") {
  return t
    .toLowerCase()
    .replace(/[^\w가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   SPLIT TEXT
========================= */
function splitText(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 30);
}

/* =========================
   HTML CLEAN
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
   VIDEO → TEXT (Whisper)
========================= */
async function videoToText(videoPath) {
  const audioPath = videoPath + ".mp3";

  await new Promise((resolve, reject) => {
    exec(
      `ffmpeg -i "${videoPath}" -vn -acodec mp3 "${audioPath}"`,
      (err) => (err ? reject(err) : resolve())
    );
  });

  const formData = new FormData();
  formData.append("file", fs.createReadStream(audioPath));
  formData.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: formData
  });

  const data = await res.json();
  return data.text || "";
}

/* =========================
   LOAD FILES (MULTIMODAL INDEX)
========================= */
async function loadFiles() {
  DOCS = [];

  const files = fs.readdirSync(__dirname);

  for (const file of files) {
    const full = path.join(__dirname, file);

    /* HTML */
    if (file.endsWith(".html")) {
      const html = fs.readFileSync(full, "utf8");
      const clean = stripHtml(html);

      splitText(clean).forEach((t, i) => {
        DOCS.push({
          title: file,
          type: "html",
          text: t,
          url: `/${file}#s${i}`
        });
      });
    }

    /* PDF */
    if (file.endsWith(".pdf")) {
      const buf = fs.readFileSync(full);
      const pdf = await pdfParse(buf);

      splitText(pdf.text).forEach((t, i) => {
        DOCS.push({
          title: file,
          type: "pdf",
          text: t,
          url: `/${file}#p${i}`
        });
      });
    }

    /* IMAGE */
    if (file.match(/\.(png|jpg|jpeg)$/)) {
      const ocr = await Tesseract.recognize(full, "kor+eng");

      splitText(ocr.data.text).forEach((t, i) => {
        DOCS.push({
          title: file,
          type: "image",
          text: t,
          url: `/${file}#i${i}`
        });
      });
    }

    /* VIDEO */
    if (file.endsWith(".mp4")) {
      try {
        const text = await videoToText(full);

        splitText(text).forEach((t, i) => {
          DOCS.push({
            title: file,
            type: "video",
            text: t,
            url: `/${file}#t${i}`
          });
        });

        console.log("🎥 VIDEO INDEXED:", file);

      } catch (e) {
        console.log("VIDEO ERROR:", file, e.message);
      }
    }
  }

  console.log("📦 TOTAL DOCS:", DOCS.length);
}

/* =========================
   EMBEDDING
========================= */
async function embed(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
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
async function buildVectors() {
  VECTORS = [];

  for (const d of DOCS) {
    const v = await embed(d.text);
    VECTORS.push({ ...d, vector: v });
  }

  console.log("🧠 VECTOR READY:", VECTORS.length);
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
   SEARCH ENGINE (V14 CORE)
========================= */
async function search(query) {
  if (CACHE.has(query)) return CACHE.get(query);

  const qvec = await embed(query);

  let results = [];

  for (const d of VECTORS) {
    const score =
      cosine(qvec, d.vector) * 3 +
      (normalize(d.text).includes(normalize(query)) ? 2 : 0);

    results.push({ ...d, score });
  }

  results.sort((a, b) => b.score - a.score);

  /* DEDUP (URL 기반) */
  const seen = new Set();
  const final = [];

  for (const r of results) {
    if (seen.has(r.url)) continue;
    seen.add(r.url);
    final.push(r);
  }

  const top = final.slice(0, 10);

  CACHE.set(query, top);

  return top;
}

/* =========================
   API
========================= */
app.post("/api/chat", async (req, res) => {
  const q = req.body.message || "";

  const docs = await search(q);

  res.json({
    reply: "검색 완료 (V14)",
    results: docs.map(d => ({
      title: d.title,
      type: d.type,
      url: d.url,
      summary: d.text.slice(0, 140)
    }))
  });
});

/* =========================
   AUTO REINDEX
========================= */
fs.watch(__dirname, async () => {
  console.log("🔄 REINDEXING...");
  await loadFiles();
  await buildVectors();
});

/* =========================
   INIT
========================= */
(async () => {
  await loadFiles();
  await buildVectors();
})();

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("🚀 V14 MULTIMODAL GOOGLE RUNNING:", PORT);
});
