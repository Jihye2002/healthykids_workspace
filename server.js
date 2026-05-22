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

  tokens.forEach(t => {
    map[t] = (map[t] || 0) + 1;
  });

  return map;
}

function idf(docs) {
  const df = {};

  docs.forEach(d => {
    new Set(d.tokens).forEach(t => {
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

function vector(tfMap, idfMap) {
  const v = {};

  for (let k in tfMap) {
    v[k] = tfMap[k] * (idfMap[k] || 0);
  }

  return v;
}

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
   4. VECTOR INDEX
========================= */
let VECTORS = [];
let IDF_MAP = {};

function rebuild() {

  const processed = DOCUMENTS.map(d => {

    const tokens = tokenize(d.text + " " + d.title);

    return {
      ...d,
      tokens
    };
  });

  IDF_MAP = idf(processed);

  VECTORS = processed.map(d => ({
    ...d,
    vec: vector(tf(d.tokens), IDF_MAP)
  }));

  console.log("✅ VECTOR REBUILD:", VECTORS.length);
}

/* =========================
   5. SEARCH
========================= */
function search(query) {

  if (!query || !VECTORS.length) {
    return [];
  }

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
   6. PDF INDEX
========================= */
async function addPDF(filePath, filename) {

  try {

    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    DOCUMENTS.push({
      id: filename,
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
   7. INITIAL DATA
========================= */
DOCUMENTS.push(
  {
    id: "guide",
    title: "📌 헬시키즈 이용 가이드",
    text: "위생 식습관 질병예방 실외안전 교육 사이트입니다",
    url: "/notice.html#guide"
  },

  {
    id: "hygiene",
    title: "위생안전",
    text: "손씻기 마스크 기침 감기 예방",
    url: "/video.html?type=hygiene"
  },

  {
    id: "food",
    title: "생활건강",
    text: "영양 편식 건강 음식",
    url: "/video.html?type=foodsafety"
  },

  {
    id: "disease",
    title: "질병예방",
    text: "감기 독감 바이러스 면역",
    url: "/video.html?type=precaution"
  },

  {
    id: "safe",
    title: "실외안전",
    text: "횡단보도 교통 안전",
    url: "/video.html?type=crosswalk"
  }
);

rebuild();

/* =========================
   8. PDF FOLDER
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
   9. MIME TYPES
========================= */
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

/* =========================
   10. SERVER
========================= */
const server = http.createServer((req, res) => {

  console.log("REQ:", req.method, req.url);

  /* CORS */
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
  if (req.url === "/api/init" && req.method === "GET") {

    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
      messages: [
        "👋 안녕하세요! 헬시키즈 AI입니다.",
        "🔎 위생 / 질병예방 / 생활건강을 검색해보세요."
      ]
    }));
  }

  /* =========================
     SEARCH API
  ========================= */
  if (req.url.startsWith("/api/")) {

     res.writeHead(404, {
       "Content-Type": "application/json"
     });
   
     return res.end(JSON.stringify({
       error: "API NOT FOUND"
     }));
   }

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => {

      try {

        const parsed = body ? JSON.parse(body) : {};
        const query = parsed.query || "";

        console.log("🔍 QUERY:", query);

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
          error: "server error"
        }));
      }
    });

    return;
  }

  /* =========================
     METHOD ERROR
  ========================= */
  if (req.url.startsWith("/api/search") && req.method !== "POST") {

    res.writeHead(405, {
      "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
      error: "POST method required"
    }));
  }

  /* =========================
     STATIC FILE
  ========================= */
  const cleanUrl = req.url.split("?")[0];

   if (cleanUrl === "/") {
     filePath = path.join(__dirname, "index.html");
   } else {
     filePath = path.join(__dirname, cleanUrl);
   }

  fs.readFile(filePath, (err, data) => {

    if (err) {

      res.writeHead(404, {
        "Content-Type": "text/plain"
      });

      return res.end("404 Not Found");
    }

    const ext = path.extname(filePath);

    res.writeHead(200, {
      "Content-Type": MIME[ext] || "text/plain"
    });

    res.end(data);
  });
});

/* =========================
   START
========================= */
server.listen(PORT, () => {
  console.log(`🚀 SERVER RUNNING → http://localhost:${PORT}`);
});
