const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DOCUMENTS (AI 검색 대상)
========================= */
let DOCUMENTS = [
  {
    title: "😷 질병예방",
    text: "감기 독감 바이러스 기침예절 면역 예방",
    description: "감기와 독감 예방 교육",
    url: "/video.html?type=precaution"
  },
  {
    title: "🧼 위생안전",
    text: "손씻기 개인위생 마스크 세균 예방",
    description: "손씻기와 위생 교육",
    url: "/video.html?type=hygiene"
  },
  {
    title: "🚦 실외안전",
    text: "횡단보도 교통안전 길건너기 안전수칙",
    description: "교통안전 교육",
    url: "/video.html?type=crosswalk"
  },
  {
    title: "🥗 생활건강",
    text: "식습관 영양 건강 음식 편식 예방",
    description: "건강한 식습관 교육",
    url: "/video.html?type=foodsafety"
  }
];

/* =========================
   SIMPLE VECTOR SEARCH
========================= */
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function search(query) {
  const qTokens = tokenize(query);

  return DOCUMENTS.map(doc => {
    const docTokens = tokenize(doc.title + " " + doc.text);

    let score = 0;

    qTokens.forEach(q => {
      if (docTokens.includes(q)) score++;
    });

    return { ...doc, score };
  })
  .filter(d => d.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);
}

/* =========================
   GROQ API CALL
========================= */
async function askGroq(question, context) {

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
너는 어린이 건강교육 AI다.
반드시 쉬운 말로 설명해라.
`
        },
        {
          role: "user",
          content: `
질문: ${question}

관련 자료:
${context}
`
        }
      ]
    })
  });

  const data = await response.json();

  return data.choices?.[0]?.message?.content || "답변 실패";
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req, res) => {

  const cleanUrl = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  /* =========================
     CHAT API
  ========================= */
  if (cleanUrl === "/api/chat" && req.method === "POST") {

    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", async () => {

      try {

        const { message } = JSON.parse(body);

        const results = search(message);

        const context = results
          .map(r => `${r.title}: ${r.text}`)
          .join("\n");

        const reply = await askGroq(message, context);

        res.writeHead(200, {
          "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
          reply,
          results
        }));

      } catch (err) {

        console.error(err);

        res.writeHead(500);

        res.end(JSON.stringify({
          error: "SERVER ERROR"
        }));
      }
    });

    return;
  }

  /* =========================
     STATIC FILE
  ========================= */
  let filePath = cleanUrl === "/"
    ? "index.html"
    : cleanUrl;

  filePath = path.join(__dirname, filePath);

  fs.readFile(filePath, (err, data) => {

    if (err) {
      res.writeHead(404);
      return res.end("404");
    }

    const ext = path.extname(filePath);

    const MIME = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".png": "image/png",
      ".jpg": "image/jpeg"
    };

    res.writeHead(200, {
      "Content-Type": MIME[ext] || "text/plain"
    });

    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 GROQ AI SERVER RUNNING");
});
