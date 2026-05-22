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
    content: "감기 독감 바이러스 예방 면역 기침예절 손씻기",
    url: "/video.html?type=precaution"
  },
  {
    id: 2,
    title: "🧼 위생안전",
    content: "손씻기 세균 마스크 개인위생 바이러스 예방",
    url: "/video.html?type=hygiene"
  },
  {
    id: 3,
    title: "🚦 실외안전",
    content: "횡단보도 교통 안전 사고 예방 길건너기",
    url: "/video.html?type=crosswalk"
  },
  {
    id: 4,
    title: "🥗 생활건강",
    content: "식습관 영양 건강 음식 균형 성장",
    url: "/video.html?type=foodsafety"
  }
];

/* =========================
   1. QUERY EXPANSION (AI)
========================= */
async function expandQuery(query) {

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
너는 검색어 확장 AI다.

사용자 질문을 검색 키워드 6~10개로 변환해라.

JSON 배열만 출력:
["키워드1","키워드2","키워드3"]
`
        },
        {
          role: "user",
          content: query
        }
      ]
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return query.split(" ");
  }
}

/* =========================
   2. HYBRID SCORING (핵심)
========================= */
function score(doc, keywords) {

  let keywordScore = 0;
  let semanticScore = 0;

  for (let k of keywords) {

    if (doc.title.includes(k)) keywordScore += 5;
    if (doc.content.includes(k)) keywordScore += 2;
  }

  for (let k of keywords) {
    if (doc.content.includes(k)) semanticScore += 1;
  }

  return keywordScore * 0.6 + semanticScore * 0.4;
}

/* =========================
   3. SEARCH ENGINE CORE
========================= */
function search(query, keywords) {

  return DOCUMENTS
    .map(doc => ({
      ...doc,
      score: score(doc, keywords)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   4. AI RESPONSE GENERATION
========================= */
async function generateAnswer(query, results) {

  const context = results.map(r => `
제목: ${r.title}
내용: ${r.content}
URL: ${r.url}
`).join("\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
너는 Google 검색 AI다.

규칙:
1. 자연스럽게 설명
2. 결과 기반으로 답변
3. JSON 출력

형식:
{
  "reply":"설명",
  "results":[
    {"title":"","description":"","url":""}
  ]
}
`
        },
        {
          role: "user",
          content: `질문:${query}\n\n검색결과:\n${context}`
        }
      ]
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      reply: "검색 결과를 찾았어요",
      results
    };
  }
}

/* =========================
   API
========================= */
const server = http.createServer(async (req, res) => {

  const url = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (url === "/api/chat" && req.method === "POST") {

    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {

      const { message } = JSON.parse(body);

      // 1. query expand
      const keywords = await expandQuery(message);

      // 2. search
      const results = search(message, keywords);

      // 3. AI generate
      const answer = await generateAnswer(message, results);

      res.end(JSON.stringify(answer));
    });

    return;
  }

  /* STATIC */
  let filePath = url === "/"
    ? "index.html"
    : path.join(__dirname, url);

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
  console.log("🚀 GOOGLE-STYLE SEARCH ENGINE RUNNING");
});
