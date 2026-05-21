const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = 3000;

/* =========================
   1. 저장소 (RAG DB 역할)
========================= */
let DOCUMENTS = [];

/* =========================
   2. 기본 문서 (초기 데이터)
========================= */
function addDoc(id, title, text, url) {
  DOCUMENTS.push({ id, title, text, url });
}

/* =========================
   3. TF-IDF
========================= */
function tokenize(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function tf(tokens) {
  const m = {};
  tokens.forEach(t => m[t] = (m[t] || 0) + 1);
  return m;
}

function idf(docs) {
  const df = {};
  docs.forEach(d => {
    [...new Set(d.tokens)].forEach(t => {
      df[t] = (df[t] || 0) + 1;
    });
  });

  const res = {};
  const N = docs.length;

  Object.keys(df).forEach(t => {
    res[t] = Math.log(N / (df[t] + 1));
  });

  return res;
}

function vector(tfMap, idfMap) {
  const v = {};
  Object.keys(tfMap).forEach(k => {
    v[k] = tfMap[k] * (idfMap[k] || 0);
  });
  return v;
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
   4. 인덱싱
========================= */
let vectors = [];

function rebuildIndex() {
  const processed = DOCUMENTS.map(d => {
    const tokens = tokenize(d.text + " " + d.title);
    return { ...d, tokens };
  });

  const idfMap = idf(processed);

  vectors = processed.map(d => ({
    ...d,
    vec: vector(tf(d.tokens), idfMap)
  }));
}

/* =========================
   5. 검색
========================= */
function search(query) {
  if (!vectors.length) return [];

  const qTokens = tokenize(query);
  const idfMap = {};

  vectors.forEach(v => {
    Object.keys(v.vec).forEach(k => {
      idfMap[k] = idfMap[k] || 1;
    });
  });

  const qVec = vector(tf(qTokens), idfMap);

  return vectors
    .map(v => ({
      ...v,
      score: cosine(qVec, v.vec)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   6. PDF 업로드 처리
========================= */
async function indexPDF(filePath, filename) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  DOCUMENTS.push({
    id: filename,
    title: filename,
    text: data.text,
    url: `/uploads/${filename}`
  });

  rebuildIndex();
}

/* =========================
   7. uploads 폴더 생성
========================= */
if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}

/* =========================
   8. 파일 감시 (자동 RAG)
========================= */
fs.watch("./uploads", (event, file) => {
  if (file && file.endsWith(".pdf")) {
    console.log("PDF 감지:", file);
    indexPDF(`./uploads/${file}`, file);
  }
});

/* =========================
   9. 초기 문서
========================= */
addDoc("hygiene", "위생안전", "손씻기 마스크 기침 위생 감기 예방", "/video.html");
addDoc("foodsafety", "식습관", "영양 편식 건강 음식 비만 예방", "/video.html");
addDoc("precaution", "질병예방", "감기 독감 바이러스 예방 면역", "/video.html");
addDoc("outdoor", "실외안전", "횡단보도 교통 도로 안전", "/video.html");
addDoc("guide", "가이드", "사이트 사용 방법 안내", "/notice.html");

rebuildIndex();

/* =========================
   10. 서버
========================= */
const server = http.createServer((req, res) => {

  console.log(req.method, req.url); // 👈 디버깅 필수
     /* 업로드 API */
     if (req.url === "/api/search" && req.method === "POST") {
     let body = "";
   
     req.on("data", chunk => body += chunk);
     req.on("end", () => {
       try {
         const { query } = JSON.parse(body);
   
         const results = search(query);
   
         res.writeHead(200, {
           "Content-Type": "application/json"
         });
   
         res.end(JSON.stringify(results));
       } catch (e) {
         res.writeHead(500);
         res.end(JSON.stringify({ error: "server error" }));
       }
     });
   
     return; // ⭐⭐⭐ 이거 없으면 HTML로 떨어짐
   }

  /* 검색 API */
  if (req.url === "/api/search" && req.method === "POST") {
    let body = "";

    req.on("data", c => body += c);
    req.on("end", () => {
      const { query } = JSON.parse(body);

      const results = search(query);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(results));
    });

    return;
  }

  /* static */
  let filePath = req.url === "/" ? "index.html" : "." + req.url;

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
    }
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("RAG Server running → http://localhost:" + PORT);
});
