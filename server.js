const http = require("http");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const PORT = 3000;

/* =========================
   RAG DB
========================= */
let DOCUMENTS = [];

/* =========================
   토큰화
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
  const m = {};
  tokens.forEach(t => m[t] = (m[t] || 0) + 1);
  return m;
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
   RAG INDEX
========================= */
let VECTORS = [];

function rebuild() {
  const processed = DOCUMENTS.map(d => {
    const tokens = tokenize(d.text + " " + d.title);
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
  const qTokens = tokenize(query);
  const tempDocs = VECTORS;

  if (!tempDocs.length) return [];

  const idfMap = {};
  tempDocs.forEach(d => {
    Object.keys(d.vec).forEach(k => idfMap[k] = 1);
  });

  const qVec = vector(tf(qTokens), idfMap);

  return tempDocs
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
   PDF 업로드
========================= */
async function addPDF(filePath, filename) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  DOCUMENTS.push({
    id: filename,
    title: filename,
    text: data.text,
    url: "/uploads/" + filename
  });

  rebuild();
}

/* =========================
   기본 데이터
========================= */
DOCUMENTS.push(
  { id: "hygiene", title: "위생", text: "손씻기 마스크 감기 예방", url: "/video.html" },
  { id: "food", title: "식습관", text: "영양 편식 건강 음식", url: "/video.html" },
  { id: "disease", title: "질병예방", text: "감기 독감 바이러스 면역", url: "/video.html" },
  { id: "safe", title: "실외안전", text: "횡단보도 교통 안전", url: "/video.html" }
);

rebuild();

/* =========================
   uploads
========================= */
if (!fs.existsSync("./uploads")) {
  fs.mkdirSync("./uploads");
}

fs.watch("./uploads", (e, file) => {
  if (file && file.endsWith(".pdf")) {
    addPDF("./uploads/" + file, file);
  }
});

/* =========================
   SERVER
========================= */
const server = http.createServer((req, res) => {

  console.log(req.method, req.url);

  /* ================= API ================= */
  if (req.url === "/api/search" && req.method === "POST") {

    let body = "";

    req.on("data", c => body += c);

    req.on("end", () => {
      const { query } = JSON.parse(body || "{}");
      const results = search(query);

      res.writeHead(200, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify(results));
    });

    return;
  }

  /* ================= UPLOAD PAGE ================= */
  if (req.url === "/upload" && req.method === "GET") {
    const html = fs.readFileSync("./upload.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }

  /* ================= FILE UPLOAD ================= */
  if (req.url === "/upload" && req.method === "POST") {

    const filename = "file_" + Date.now() + ".pdf";
    const filePath = "./uploads/" + filename;

    const write = fs.createWriteStream(filePath);

    req.pipe(write);

    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });

    return;
  }

  /* ================= STATIC ================= */
  let filePath = req.url === "/" ? "index.html" : "." + req.url;

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404");
    }
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("RAG SERVER RUN → http://localhost:" + PORT);
});
