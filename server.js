import express from "express";
import cors from "cors";
import { SITE_MAP } from "./siteMap.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("."));

/* =========================
   1. 텍스트 정제
========================= */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/* =========================
   2. TF 계산
========================= */
function tf(tokens) {
  const tfMap = {};
  tokens.forEach(t => {
    tfMap[t] = (tfMap[t] || 0) + 1;
  });

  const len = tokens.length;
  Object.keys(tfMap).forEach(k => {
    tfMap[k] = tfMap[k] / len;
  });

  return tfMap;
}

/* =========================
   3. IDF 계산 (SITE_MAP 전체 기준)
========================= */
function buildIDF(docs) {
  const idf = {};
  const N = docs.length;

  docs.forEach(doc => {
    const words = new Set(tokenize(doc.content));

    words.forEach(w => {
      idf[w] = (idf[w] || 0) + 1;
    });
  });

  Object.keys(idf).forEach(k => {
    idf[k] = Math.log(N / (idf[k] + 1));
  });

  return idf;
}

const IDF = buildIDF(SITE_MAP);

/* =========================
   4. TF-IDF 벡터 생성
========================= */
function vectorize(text) {
  const tokens = tokenize(text);
  const tfMap = tf(tokens);

  const vec = {};

  Object.keys(tfMap).forEach(k => {
    vec[k] = tfMap[k] * (IDF[k] || 0);
  });

  return vec;
}

/* =========================
   5. cosine similarity
========================= */
function cosine(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  keys.forEach(k => {
    const av = a[k] || 0;
    const bv = b[k] || 0;

    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  });

  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-9);
}

/* =========================
   6. RAG 검색 엔진
========================= */
function ragSearch(query) {
  const qVec = vectorize(query);

  const scored = SITE_MAP.map(item => {
    const dVec = vectorize(item.content);
    const score = cosine(qVec, dVec);

    return { ...item, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   7. API
========================= */
app.post("/api/chat", (req, res) => {
  const { text } = req.body;

  let results = ragSearch(text);

  const guide = SITE_MAP.find(i => i.id === "guide");

  if (!results.find(r => r.id === "guide")) {
    results.unshift(guide);
  }

  res.json({
    reply: "관련 정보를 찾아봤어요 😊",
    menus: results.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url
    }))
  });
});

app.listen(3000, () => {
  console.log("TF-IDF RAG running on http://localhost:3000");
});
