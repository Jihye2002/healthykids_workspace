const express = require("express");
const multer = require("multer");
const fs = require("fs");
const pdf = require("pdf-parse");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

/* =========================
   1. 파일 저장 설정
========================= */
const upload = multer({ dest: "uploads/" });

/* =========================
   2. 문서 DB (메모리형)
   → 실제 서비스는 DB 사용
========================= */
let DOCUMENTS = [];

/* =========================
   3. 텍스트 전처리
========================= */
function tokenize(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

/* =========================
   4. TF-IDF (간단 버전)
========================= */
function buildVectors(docs) {
  const df = {};

  docs.forEach(doc => {
    new Set(doc.tokens).forEach(t => {
      df[t] = (df[t] || 0) + 1;
    });
  });

  const N = docs.length;

  const idf = {};
  Object.keys(df).forEach(t => {
    idf[t] = Math.log(N / (df[t] + 1));
  });

  return docs.map(doc => {
    const tf = {};
    doc.tokens.forEach(t => {
      tf[t] = (tf[t] || 0) + 1;
    });

    const vec = {};
    Object.keys(tf).forEach(k => {
      vec[k] = tf[k] * (idf[k] || 0);
    });

    return { ...doc, vec };
  });
}

/* =========================
   5. cosine similarity
========================= */
function cosine(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  Object.keys(a).forEach(k => {
    dot += (a[k] || 0) * (b[k] || 0);
    magA += (a[k] || 0) ** 2;
  });

  Object.keys(b).forEach(k => {
    magB += (b[k] || 0) ** 2;
  });

  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-9);
}

/* =========================
   6. PDF 업로드 API
========================= */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);

    const text = pdfData.text;

    const doc = {
      id: Date.now().toString(),
      title: req.file.originalname,
      text,
      tokens: tokenize(text),
      url: "/uploads/" + req.file.filename
    };

    DOCUMENTS.push(doc);
    DOCUMENTS = buildVectors(DOCUMENTS);

    res.json({
      message: "업로드 성공",
      docCount: DOCUMENTS.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   7. 검색 API (RAG)
========================= */
app.post("/search", (req, res) => {
  const query = req.body.query;

  const qTokens = tokenize(query);

  const qVec = {};
  qTokens.forEach(t => {
    qVec[t] = (qVec[t] || 0) + 1;
  });

  const results = DOCUMENTS.map(doc => {
    return {
      ...doc,
      score: cosine(qVec, doc.vec)
    };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

  res.json(results);
});

/* =========================
   8. 서버 실행
========================= */
app.listen(PORT, () => {
  console.log("RAG Server running on http://localhost:" + PORT);
});
