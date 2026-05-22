const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

/* =========================
   DOCUMENTS (지식 베이스)
========================= */
const DOCUMENTS = [
  {
    title: "😷 질병예방",
    description: "감기, 독감, 바이러스 예방 교육",
    url: "/video.html?type=precaution",
    keywords: "감기 독감 바이러스 예방 면역"
  },
  {
    title: "🧼 위생안전",
    description: "손씻기, 기침예절, 개인위생",
    url: "/video.html?type=hygiene",
    keywords: "손씻기 위생 세균 기침 마스크"
  },
  {
    title: "🚦 실외안전",
    description: "횡단보도, 교통안전",
    url: "/video.html?type=crosswalk",
    keywords: "횡단보도 교통 안전 길 건너기"
  },
  {
    title: "🥗 생활건강",
    description: "식습관, 영양관리",
    url: "/video.html?type=foodsafety",
    keywords: "식습관 음식 영양 건강"
  }
];

/* =========================
   GROQ API KEY
========================= */
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   AI SEARCH (완전 의미 기반)
========================= */
async function aiSearch(query) {

  const context = DOCUMENTS.map(d => `
제목: ${d.title}
설명: ${d.description}
키워드: ${d.keywords}
URL: ${d.url}
`).join("\n");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
너는 의미 기반 검색 AI다.

사용자의 질문을 분석해서
가장 관련 높은 2~3개 문서를 선택해라.

반드시 JSON으로만 출력:

[
  {
    "title": "...",
    "description": "...",
    "url": "...",
    "reason": "짧은 이유"
  }
]

문서 외에는 절대 생성하지 마라.
`
        },
        {
          role: "user",
          content: `
사용자 질문:
${query}

문서 목록:
${context}
`
        }
      ],
      temperature: 0.2
    })
  });

  const data = await response.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch (e) {
    return [];
  }
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req, res) => {

  const cleanUrl = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  /* =========================
     CHAT API (핵심)
  ========================= */
  if (cleanUrl === "/api/chat" && req.method === "POST") {

    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", async () => {

      try {

        const { message } = JSON.parse(body);

        const results = await aiSearch(message);

        // AI가 답변도 생성
        const reply = `말씀하신 "${message}"와 관련된 결과를 찾았어요 😊`;

        res.writeHead(200);
        res.end(JSON.stringify({
          reply,
          results
        }));

      } catch (err) {

        console.error(err);

        res.writeHead(500);
        res.end(JSON.stringify({
          error: "AI SEARCH FAILED"
        }));
      }
    });

    return;
  }

  /* =========================
     STATIC FILE
  ========================= */
  let filePath = cleanUrl === "/"
    ? path.join(__dirname, "index.html")
    : path.join(__dirname, cleanUrl);

  fs.readFile(filePath, (err, data) => {

    if (err) {
      res.writeHead(404);
      return res.end("404");
    }

    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 AI SEARCH SERVER RUNNING");
});
