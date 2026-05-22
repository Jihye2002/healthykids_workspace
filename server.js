const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DOCUMENTS
========================= */
const DOCUMENTS = [
  {
    id: 1,
    title: "😷 질병예방",
    description: "감기, 독감, 바이러스 예방 교육",
    url: "/video.html?type=precaution",
    keywords: ["감기","독감","바이러스","예방","면역"]
  },
  {
    id: 2,
    title: "🧼 위생안전",
    description: "손씻기, 기침예절, 개인위생",
    url: "/video.html?type=hygiene",
    keywords: ["손씻기","위생","세균","마스크","기침"]
  },
  {
    id: 3,
    title: "🚦 실외안전",
    description: "횡단보도 교통안전",
    url: "/video.html?type=crosswalk",
    keywords: ["횡단보도","교통","안전","길"]
  },
  {
    id: 4,
    title: "🥗 생활건강",
    description: "식습관, 영양관리",
    url: "/video.html?type=foodsafety",
    keywords: ["식습관","영양","음식","건강"]
  }
];

/* =========================
   STEP 1: 의미 점수 계산
========================= */
function scoreDoc(query, doc) {

  const qTokens = query.toLowerCase().split(/\s+/);

  let score = 0;

  for (let q of qTokens) {
    for (let k of doc.keywords) {
      if (k.includes(q)) score += 2;
      if (q.includes(k)) score += 1;
    }
  }

  if (doc.title.includes(query)) score += 5;

  return score;
}

/* =========================
   STEP 2: 후보 추출
========================= */
function getCandidates(query) {

  return DOCUMENTS
    .map(doc => ({
      ...doc,
      score: scoreDoc(query, doc)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/* =========================
   STEP 3: AI 재정렬 (Groq)
========================= */
async function aiRank(query, candidates) {

  const context = candidates.map(c => `
ID:${c.id}
제목:${c.title}
설명:${c.description}
URL:${c.url}
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
너는 검색 결과를 "정확도 순으로 정렬"하는 AI다.

반드시 JSON으로만 출력:

[
  {
    "title": "...",
    "description": "...",
    "url": "...",
    "reason": "짧은 이유"
  }
]

절대 문서 외 결과 생성 금지
`
        },
        {
          role: "user",
          content: `
질문: ${query}

후보 문서:
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
    return candidates.slice(0, 3);
  }
}

/* =========================
   API
========================= */
const server = http.createServer(async (req, res) => {

  const cleanUrl = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (cleanUrl === "/api/chat" && req.method === "POST") {

    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {

      const { message } = JSON.parse(body);

      const candidates = getCandidates(message);

      const results = await aiRank(message, candidates);

      const reply = `“${message}” 관련 가장 정확한 정보를 찾았어요 😊`;

      res.end(JSON.stringify({
        reply,
        results
      }));
    });

    return;
  }

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
  console.log("🚀 AI SEARCH ENGINE v2 RUNNING");
});
