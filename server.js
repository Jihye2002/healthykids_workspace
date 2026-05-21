const http = require("http");
const fs = require("fs");

const PORT = 3000;

const documents = JSON.parse(fs.readFileSync("./documents.json", "utf-8"));

/* =========================
   TEXT PROCESS
========================= */
function tokenize(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function tf(tokens) {
  const map = {};
  tokens.forEach(t => map[t] = (map[t] || 0) + 1);
  return map;
}

function idf(docs) {
  const df = {};
  docs.forEach(d => {
    new Set(d.tokens).forEach(t => {
      df[t] = (df[t] || 0) + 1;
    });
  });

  const idfMap = {};
  const N = docs.length;

  Object.keys(df).forEach(t => {
    idfMap[t] = Math.log(N / (df[t] + 1));
  });

  return idfMap;
}

function vectorize(tfMap, idfMap) {
  const vec = {};
  Object.keys(tfMap).forEach(k => {
    vec[k] = tfMap[k] * (idfMap[k] || 0);
  });
  return vec;
}

function cosine(a, b) {
  let dot = 0, ma = 0, mb = 0;

  Object.keys(a).forEach(k => {
    dot += (a[k] || 0) * (b[k] || 0);
    ma += a[k] ** 2;
  });

  Object.keys(b).forEach(k => {
    mb += b[k] ** 2;
  });

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   PREPROCESS
========================= */
const processed = documents.map(d => {
  const tokens = tokenize(d.title + " " + d.text);
  return { ...d, tokens };
});

const idfMap = idf(processed);

const vectors = processed.map(d => ({
  ...d,
  vec: vectorize(tf(d.tokens), idfMap)
}));

/* =========================
   SEARCH (RAG CORE)
========================= */
function search(query) {
  const qTokens = tokenize(query);
  const qVec = vectorize(tf(qTokens), idfMap);

  let results = vectors.map(d => ({
    ...d,
    score: cosine(qVec, d.vec)
  }));

  results.sort((a, b) => b.score - a.score);

  // guide 우선 강화
  results = results.sort((a, b) => {
    if (a.type === "guide") return -1;
    if (b.type === "guide") return 1;
    return 0;
  });

  return results.slice(0, 5);
}

/* =========================
   SERVER
========================= */
const server = http.createServer((req, res) => {

  if (req.url === "/api/search" && req.method === "POST") {
    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", () => {
      const { query } = JSON.parse(body);

      const results = search(query);

      const menus = results.map(r => ({
        id: r.id,
        title: r.title,
        description: r.type,
        url: r.url
      }));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        reply: "검색 결과입니다",
        menus,
        related: results.map(r => r.title)
      }));
    });

    return;
  }

  // static file
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
  console.log("http://localhost:" + PORT);
});
