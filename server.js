const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdf = require("pdf-parse");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

let DOCUMENTS = [];

function tokenize(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function buildVectors(docs) {
  const df = {};
  docs.forEach(d => new Set(d.tokens).forEach(t => df[t] = (df[t] || 0) + 1));

  const N = docs.length;
  const idf = {};

  Object.keys(df).forEach(t => {
    idf[t] = Math.log(N / (df[t] + 1));
  });

  return docs.map(doc => {
    const tf = {};
    doc.tokens.forEach(t => tf[t] = (tf[t] || 0) + 1);

    const vec = {};
    Object.keys(tf).forEach(k => {
      vec[k] = tf[k] * (idf[k] || 0);
    });

    return { ...doc, vec };
  });
}

function cosine(a, b) {
  let dot = 0, ma = 0, mb = 0;

  Object.keys(a).forEach(k => {
    dot += (a[k] || 0) * (b[k] || 0);
    ma += (a[k] || 0) ** 2;
  });

  Object.keys(b).forEach(k => {
    mb += (b[k] || 0) ** 2;
  });

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   PDF 업로드 → 자동 RAG 등록
========================= */
app.post("/upload", upload.single("file"), async (req, res) => {
  const buffer = fs.readFileSync(req.file.path);
  const data = await pdf(buffer);

  const doc = {
    id: Date.now().toString(),
    title: req.file.originalname,
    text: data.text,
    url: "/uploads/" + req.file.filename,
    tokens: tokenize(data.text)
  };

  DOCUMENTS.push(doc);
  DOCUMENTS = buildVectors(DOCUMENTS);

  res.json({ ok: true, count: DOCUMENTS.length });
});

/* =========================
   RAG SEARCH API
========================= */
app.post("/search", (req, res) => {
  const query = req.body.query;

  const qTokens = tokenize(query);
  const qVec = {};
  qTokens.forEach(t => qVec[t] = (qVec[t] || 0) + 1);

  const results = DOCUMENTS
    .map(d => ({
      ...d,
      score: cosine(qVec, d.vec)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  res.json(results);
});

app.listen(3000, () => {
  console.log("RAG server running → http://localhost:3000");
});
