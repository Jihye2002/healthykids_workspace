const http = require("http");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const PORT = 3000;

/* =========================
   RAG DATABASE
========================= */
let DOCUMENTS = [];
let VECTORS = [];

/* =========================
   TOKENIZER
========================= */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/* =========================
   TF-IDF
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

  const res = {};
  const N = docs.length;

  Object.keys(df).forEach(t => {
    res[t] = Math.log(N / (df[t] + 1));
  });

  return res;
}

function vector(tfMap, idfMap) {
  const v = {};
  for (let k in tfMap) {
    v[k] = tfMap[k] * (idfMap[k] || 0);
  }
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
   INDEX BUILD
========================= */
function rebuild() {
  const processed = DOCUMENTS.map(d => {
    const tokens = tokenize(d.title + " " + d.text);
    return { ...d, tokens };
  });

  const idfMap = idf(processed);

  VECTORS = processed.map(d => ({
    ...d,
    vec: vector(tf(d.tokens), idfMap)
  }));
}

/* =========================
   SEARCH
========================= */
function search(query) {
  if (!VECTORS.length) return [];

  const qTokens = tokenize(query);

  const idfMap = {};
  VECTORS.forEach(v => {
    Object.keys(v.vec).forEach(k => {
      idfMap[k] = 1;
    });
  });

  const qVec = vector(tf(qTokens), idfMap);

  return VECTORS
    .map(v => ({
      id: v.id,
      title: v.title,
      text: v.text,
      url: v.url,
      score: cosine(qVec, v.vec)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   PDF INDEXER
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
    console.error("PDF ERROR:", e);
  }
}

/* =========================
   INITIAL DATA
========================= */
DOCUMENTS.push(
  { id: "hygiene", title: "위생안전", text: "손씻기 마스크 기침 감기 예방", url: "/video.html?type=hygiene" },
  { id: "food", title: "생활건강", text: "영양 식습관 편식 건강 음식", url: "/video.html?type=foodsafety" },
  { id: "disease", title: "질병예방", text: "감기 독감 바이러스 면역 예방", url: "/video.html?type=precaution" },
  { id: "safe", title: "실외안전", text: "횡단보도 교통 안전 도로", url: "/video.html?type=crosswalk" },
  { id: "guide", title: "이용가이드", text: "사이트 사용 방법 안내", url: "/notice.html#guide" }
);

rebuild();

/* =========================
   UPLOAD FOLDER
========================= */
if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}

/* =========================
   WATCH PDF UPLOADS
========================= */
fs.watch("./uploads", (event, file) => {
  if (file && file.endsWith(".pdf")) {
    console.log("New PDF detected:", file);
    addPDF("./uploads/" + file, file);
  }
});

/* =========================
   SERVER
========================= */
const server = http.createServer((req, res) => {

  console.log(req.method, req.url);

  /* =========================
     API: SEARCH (RAG)
  ========================= */
  if (req.url === "/api/search" && req.method === "POST") {

    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", () => {
      try {
        const { query } = JSON.parse(body || "{}");

        const results = search(query || "");

        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8"
        });

        return res.end(JSON.stringify(results));

      } catch (err) {
        console.error(err);

        res.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8"
        });

        return res.end(JSON.stringify({ error: "server error" }));
      }
    });

    return;
  }

  /* =========================
     UPLOAD PAGE
  ========================= */
  if (req.url === "/upload" && req.method === "GET") {
    const html = fs.readFileSync("./upload.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }

  /* =========================
     FILE UPLOAD (PDF)
  ========================= */
  if (req.url === "/upload" && req.method === "POST") {

    const filename = "file_" + Date.now() + ".pdf";
    const filePath = "./uploads/" + filename;

    const writeStream = fs.createWriteStream(filePath);

    req.pipe(writeStream);

    writeStream.on("finish", () => {
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8"
      });

      res.end(JSON.stringify({
        ok: true,
        file: filename
      }));
    });

    writeStream.on("error", () => {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false }));
    });

    return;
  }

  /* =========================
     STATIC FILES
  ========================= */
  let filePath = req.url === "/" ? "index.html" : "." + req.url;

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return res.end("404 NOT FOUND");
    }
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 RAG SERVER RUNNING → http://localhost:" + PORT);
});
