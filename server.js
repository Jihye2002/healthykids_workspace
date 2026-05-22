const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

/* =========================
   1. DOCUMENT DATABASE
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
   3. TF
========================= */
function tf(tokens) {
  const map = {};

  tokens.forEach(t => {
    map[t] = (map[t] || 0) + 1;
  });

  return map;
}

/* =========================
   4. IDF
========================= */
function idf(docs) {
  const df = {};

  docs.forEach(doc => {
    new Set(doc.tokens).forEach(t => {
      df[t] = (df[t] || 0) + 1;
    });
  });

  const result = {};
  const N = docs.length;

  Object.keys(df).forEach(t => {
    result[t] = Math.log((N + 1) / (df[t] + 1));
  });

  return result;
}

/* =========================
   5. VECTOR
========================= */
function vector(tfMap, idfMap) {
  const v = {};

  for (let k in tfMap) {
    v[k] = tfMap[k] * (idfMap[k] || 0);
  }

  return v;
}

/* =========================
   6. COSINE
========================= */
function cosine(a, b) {

  let dot = 0;
  let ma = 0;
  let mb = 0;

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
   7. VECTOR INDEX
========================= */
let VECTORS = [];
let IDF_MAP = {};

function rebuild() {

  const processed = DOCUMENTS.map(doc => {

    const tokens = tokenize(doc.title + " " + doc.text);

    return {
      ...doc,
      tokens
    };
  });

  IDF_MAP = idf(processed);

  VECTORS = processed.map(doc => ({
    ...doc,
    vec: vector(tf(doc.tokens), IDF_MAP)
  }));

  console.log("✅ VECTOR REBUILD:", VECTORS.length);
}

/* =========================
   8. SEARCH
========================= */
function search(query) {

  if (!query || !VECTORS.length) {
    return [];
  }

  const qTokens = tokenize(query);
  const qVec = vector(tf(qTokens), IDF_MAP);

  return VECTORS
    .map(doc => ({
      title: doc.title,
      text: doc.text,
      url: doc.url,
      score: cosine(qVec, doc.vec)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   9. PDF INDEX
========================= */
async function addPDF(filePath, filename) {

  try {

    const buffer = fs.readFileSync(filePath);

    const data = await pdfParse(buffer);

    DOCUMENTS.push({
      title: "📄 " + filename,
      text: data.text,
      url: "/uploads/" + filename
    });

    rebuild();

    console.log("✅ PDF INDEX:", filename);

  } catch (err) {

    console.error("❌ PDF ERROR:", err);
  }
}

/* =========================
   10. INITIAL DOCUMENTS
========================= */
DOCUMENTS.push(

  {
    title: "📌 헬시키즈 이용 가이드",
    text:
      "헬시키즈는 어린이 건강 교육 플랫폼입니다. 위생안전 실외안전 생활건강 질병예방 영상을 제공합니다.",
    url: "/notice.html#guide"
  },

  {
    title: "🧼 위생안전",
    text:
      "손씻기 마스크착용 기침예절 감기예방 개인위생 교육 영상입니다.",
    url: "/video.html?type=hygiene"
  },

  {
    title: "🚦 실외안전",
    text:
      "횡단보도 교통안전 길건너기 실외 안전수칙 교육입니다.",
    url: "/video.html?type=crosswalk"
  },

  {
    title: "🥗 생활건강",
    text:
      "올바른 식습관 편식예방 영양관리 건강한 음식 교육입니다.",
    url: "/video.html?type=foodsafety"
  },

  {
    title: "😷 질병예방",
    text:
      "감기 독감 바이러스 예방 면역 건강관리 교육입니다.",
    url: "/video.html?type=precaution"
  }

);

rebuild();

/* =========================
   11. PDF FOLDER
========================= */
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}

fs.watch(UPLOAD_DIR, (event, file) => {

  if (file && file.endsWith(".pdf")) {

    addPDF(path.join(UPLOAD_DIR, file), file);
  }
});

/* =========================
   12. MIME TYPES
========================= */
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4"
};

/* =========================
   13. SERVER
========================= */
const server = http.createServer((req, res) => {

  console.log("REQ:", req.method, req.url);

  const cleanUrl = req.url.split("?")[0];

  /* =========================
     CORS
  ========================= */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {

    res.writeHead(204);

    return res.end();
  }

  /* =========================
     INIT API
  ========================= */
  if (cleanUrl === "/api/init" && req.method === "GET") {

    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
      messages: [
        "👋 안녕하세요! 헬시키즈 AI입니다.",
        "🔎 원하는 건강 교육 내용을 검색해보세요.",
        "📌 예시: 손씻기 / 감기예방 / 횡단보도 / 식습관"
      ],
      guide: "/notice.html#guide"
    }));
  }

  /* =========================
     SEARCH API
  ========================= */
  if (cleanUrl === "/api/search" && req.method === "POST") {

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {

      try {

        const parsed = JSON.parse(body || "{}");

        const query = parsed.query || "";

        console.log("🔍 SEARCH:", query);

        const results = search(query);

        res.writeHead(200, {
          "Content-Type": "application/json"
        });

        return res.end(JSON.stringify(results));

      } catch (err) {

        console.error("❌ SEARCH ERROR:", err);

        res.writeHead(500, {
          "Content-Type": "application/json"
        });

        return res.end(JSON.stringify({
          error: "SERVER ERROR"
        }));
      }
    });

    return;
  }

  /* =========================
     WRONG METHOD
  ========================= */
  if (cleanUrl === "/api/search" && req.method !== "POST") {

    res.writeHead(405, {
      "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
      error: "POST REQUIRED"
    }));
  }

  /* =========================
     UPLOAD FILE SERVE
  ========================= */
  if (cleanUrl.startsWith("/uploads/")) {

    const uploadPath = path.join(__dirname, cleanUrl);

    fs.readFile(uploadPath, (err, data) => {

      if (err) {

        res.writeHead(404, {
          "Content-Type": "text/plain"
        });

        return res.end("UPLOAD FILE NOT FOUND");
      }

      const ext = path.extname(uploadPath);

      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream"
      });

      res.end(data);
    });

    return;
  }

  /* =========================
     STATIC FILE
  ========================= */
  let filePath;

  if (cleanUrl === "/") {
    filePath = path.join(__dirname, "index.html");
  } else {
    filePath = path.join(__dirname, cleanUrl);
  }

  fs.readFile(filePath, (err, data) => {

    if (err) {

      console.log("❌ FILE NOT FOUND:", filePath);

      res.writeHead(404, {
        "Content-Type": "text/plain"
      });

      return res.end("404 NOT FOUND");
    }

    const ext = path.extname(filePath);

    res.writeHead(200, {
      "Content-Type": MIME[ext] || "text/plain"
    });

    res.end(data);
  });
});

/* =========================
   START SERVER
========================= */
server.listen(PORT, () => {

  console.log("🚀 SERVER RUNNING");
  console.log(`🌐 http://localhost:${PORT}`);
});
