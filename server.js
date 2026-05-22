const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let DOCUMENTS = [];

/* =========================
   TOKENIZE
========================= */
function tokenize(text) {

  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/* =========================
   VECTOR SEARCH
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

let VECTORS = [];
let IDF_MAP = {};

function rebuild() {

  const processed = DOCUMENTS.map(doc => {

    const tokens = tokenize(
      `${doc.title} ${doc.text}`
    );

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
}

function search(query) {

  if (!query) return [];

  const qTokens = tokenize(query);

  const qVec = vector(
    tf(qTokens),
    IDF_MAP
  );

  return VECTORS
    .map(doc => ({
      ...doc,
      score: cosine(qVec, doc.vec)
    }))
    .filter(doc => doc.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   DOCUMENTS
========================= */
DOCUMENTS.push(
  {
    title:"😷 질병예방",
    text:"감기 독감 바이러스 기침예절 예방 면역",
    description:"감기와 독감 예방 교육",
    url:"/video.html?type=precaution"
  },

  {
    title:"🧼 위생안전",
    text:"손씻기 개인위생 마스크 세균 위생",
    description:"손씻기와 마스크 착용, 기침예절 교육",
    url:"/video.html?type=hygiene"
  },

  {
    title:"🚦 실외안전",
    text:"횡단보도 교통안전 길건너기",
    description:"교통안전 교육",
    url:"/video.html?type=crosswalk"
  },

  {
    title:"🥗 생활건강",
    text:"식습관 영양관리 건강 음식",
    description:"건강한 식습관 교육",
    url:"/video.html?type=foodsafety"
  }
);

rebuild();

/* =========================
   SERVER
========================= */
const MIME = {
  ".html":"text/html",
  ".css":"text/css",
  ".js":"text/javascript",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".pdf":"application/pdf",
  ".mp4":"video/mp4"
};

const server = http.createServer(async (req, res) => {

  const cleanUrl = req.url.split("?")[0];

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {

    res.writeHead(204);

    return res.end();
  }

  /* =========================
     CHAT API
  ========================= */
  if (
    cleanUrl === "/api/chat" &&
    req.method === "POST"
  ) {

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", async () => {

      try {

        const parsed = JSON.parse(body);

        const message = parsed.message || "";

        const results = search(message);

        const context = results
          .map(r => `
제목:${r.title}
설명:${r.description}
내용:${r.text}
`)
          .join("\n");

        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method:"POST",

            headers:{
              "Content-Type":"application/json",
              "Authorization":
                `Bearer ${OPENAI_API_KEY}`
            },

            body: JSON.stringify({

              model:"gpt-4.1-mini",

              messages:[
                {
                  role:"system",
                  content:`
너는 어린이 건강교육 AI 챗봇이다.

검색 결과를 기반으로
정확하고 자연스럽게 설명해라.
`
                },

                {
                  role:"user",
                  content:`
사용자 질문:
${message}

검색 자료:
${context}
`
                }
              ]
            })
          }
        );

        const aiData = await response.json();

        const reply =
          aiData.choices?.[0]?.message?.content
          || "답변 생성 실패";

        res.writeHead(200, {
          "Content-Type":"application/json"
        });

        res.end(JSON.stringify({
          reply,
          results
        }));

      } catch (err) {

        console.error(err);

        res.writeHead(500, {
          "Content-Type":"application/json"
        });

        res.end(JSON.stringify({
          error:"SERVER ERROR"
        }));
      }
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

      res.writeHead(404);

      return res.end("404");
    }

    const ext = path.extname(filePath);

    res.writeHead(200, {
      "Content-Type":
        MIME[ext] || "text/plain"
    });

    res.end(data);
  });
});

server.listen(PORT, () => {

  console.log("SERVER RUNNING");
});
