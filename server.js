const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = 3000;

/* =========================
   1. RAG DATABASE
========================= */
let DOCUMENTS = [];

/* =========================
   2. TOKENIZE
========================= */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/* =========================
   3. TF-IDF
========================= */
function tf(tokens) {
  const map = {};
  tokens.forEach(t => (map[t] = (map[t] || 0) + 1));
  return map;
}

function idf(docs) {
  const df = {};
  docs.forEach(d => {
    new Set(d.tokens).forEach(t => {
      df[t] = (df[t] || 0) + 1;
    });
  });

  const res = {};
  const N = docs.length;

  Object.keys(df).forEach(t => {
    res[t] = Math.log((N + 1) / (df[t] + 1));
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

  for (let k in a) {
    dot += (a[k] || 0) * (b[k] || 0);
    ma += (a[k] || 0) ** 2;
  }

  for (let k in b) {
    mb += (b[k] || 0) ** 2;
  }

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   4. INDEX
========================= */
let VECTORS = [];
let IDF_MAP = {};

function rebuild() {
  const processed = DOCUMENTS.map(d => {
    const tokens = tokenize(d.text + " " + d.title);
    return { ...d, tokens };
  });

  IDF_MAP = idf(processed);

  VECTORS = processed.map(d => ({
    ...d,
    vec: vector(tf(d.tokens), IDF_MAP)
  }));
}

/* =========================
   5. SEARCH (RAG CORE)
========================= */
function search(query) {
  if (!query || !VECTORS.length) return [];

  const qTokens = tokenize(query);
  const qVec = vector(tf(qTokens), IDF_MAP);

  return VECTORS
    .map(d => ({
      id: d.id,
      title: d.title,
      url: d.url,
      score: cosine(qVec, d.vec)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   6. PDF INDEXING
========================= */
async function addPDF(filePath, filename) {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    DOCUMENTS.push({
      id: filename,
      title: filename,
      text: data.text,
      url: "/uploads/" + filename
    });

    rebuild();

    console.log("PDF indexed:", filename);
  } catch (e) {
    console.error("PDF error:", e);
  }
}

/* =========================
   7. INIT DATA (GUIDE + VIDEO)
========================= */
DOCUMENTS.push(
  {
    id: "guide",
    title: "📌 헬시키즈 이용 가이드",
    text: "이 사이트는 위생 안전 식습관 질병예방 실외안전 교육 영상과 PDF 자료를 제공합니다",
    url: "/notice.html#guide"
  },
  {
    id: "hygiene",
    title: "위생안전",
    text: "손씻기 마스크 기침 감기 예방 위생",
    url: "/video.html?type=hygiene"
  },
  {
    id: "food",
    title: "식습관",
    text: "영양 편식 건강 음식 비만 예방",
    url: "/video.html?type=foodsafety"
  },
  {
    id: "disease",
    title: "질병예방",
    text: "감기 독감 바이러스 면역 예방",
    url: "/video.html?type=precaution"
  },
  {
    id: "safe",
    title: "실외안전",
    text: "횡단보도 교통 안전 사고 예방",
    url: "/video.html?type=crosswalk"
  }
);

rebuild();

/* =========================
   8. UPLOAD FOLDER
========================= */
const UPLOAD_DIR = "./uploads";
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

/* auto index pdf */
fs.watch(UPLOAD_DIR, (event, file) => {
  if (file && file.endsWith(".pdf")) {
    addPDF(path.join(UPLOAD_DIR, file), file);
  }
});

/* =========================
   9. SERVER
========================= */
const server = http.createServer((req, res) => {

  console.log(req.method, req.url);

  /* =====================
     CORS SAFE HEADER
  ===================== */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  /* =====================
     INIT MESSAGE (중요)
     → chat 첫 화면 안내
  ===================== */
  if (req.url === "/api/init") {
    res.writeHead(200, { "Content-Type": "application/json" });

    return res.end(JSON.stringify({
      messages: [
        "👋 안녕하세요! 헬시키즈 AI입니다.",
        "🔎 위생, 식습관, 질병예방을 검색해보세요.",
        "📌 '헬시키즈 이용 가이드'를 눌러 사용법을 확인할 수 있어요."
      ],
      guide: "/notice.html#guide"
    }));
  }

  /* =====================
     SEARCH API
  ===================== */
  if (req.url === "/api/search" && req.method === "POST") {

    let body = "";

    req.on("data", c => body += c);

    req.on("end", () => {
      try {
        const { query } = JSON.parse(body || "{}");

        const results = search(query);

        res.writeHead(200, {
          "Content-Type": "application/json"
        });

        return res.end(JSON.stringify(results));
      } catch (e) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: "server error" }));
      }
    });

    return;
  }

  /* =====================
     UPLOAD PDF
  ===================== */
  if (req.url === "/upload" && req.method === "POST") {

    const filename = "file_" + Date.now() + ".pdf";
    const filePath = path.join(UPLOAD_DIR, filename);

    const write = fs.createWriteStream(filePath);
    req.pipe(write);

    req.on("end", () => {
      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({ ok: true, file: filename }));
    });

    return;
  }

  /* =====================
     STATIC FILES
  ===================== */
  let filePath = req.url === "/" ? "index.html" : "." + req.url;

  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".pdf": "application/pdf"
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }

    res.writeHead(200, {
      "Content-Type": types[ext] || "text/plain"
    });

    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 RAG SERVER RUNNING → http://localhost:" + PORT);
});
