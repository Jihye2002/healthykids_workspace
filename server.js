const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DOCUMENTS (확장 가능 구조)
========================= */
const DOCUMENTS = [
  {
    id: 1,
    title: "😷 질병예방",
    content: "감기 독감 바이러스 예방 면역 기침예절",
    url: "/video.html?type=precaution"
  },
  {
    id: 2,
    title: "🧼 위생안전",
    content: "손씻기 세균 위생 마스크 개인위생",
    url: "/video.html?type=hygiene"
  },
  {
    id: 3,
    title: "🚦 실외안전",
    content: "횡단보도 교통 안전 길건너기 사고예방",
    url: "/video.html?type=crosswalk"
  },
  {
    id: 4,
    title: "🥗 생활건강",
    content: "식습관 영양 건강 음식 균형",
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

사용자 질문을 의미 기반 키워드 5~8개로 확장해라.

JSON으로만 출력:
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
   2. SEMANTIC SCORE
========================= */
function score(doc, keywords) {

  let s = 0;

  for (let k of keywords) {
    if (doc.content.includes(k)) s += 3;
    if (doc.title.includes(k)) s += 5;
  }

  return s;
}

/* =========================
   3. CANDIDATES
========================= */
function getCandidates(keywords) {

  return DOCUMENTS
    .map(d => ({
      ...d,
      score: score(d, keywords)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/* =========================
   4. FINAL AI RANKING + SUMMARY
========================= */
async function finalAI(query, candidates) {

  const context = candidates.map(c => `
ID:${c.id}
제목:${c.title}
내용:${c.content}
URL:${c.url}
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
너는 Google 스타일 검색 AI다.

1. 가장 관련 높은 3개만 선택
2. 자연스럽게 설명 생성
3. 반드시 JSON 출력

형식:
{
  "reply":"요약 설명",
  "results":[
    {
      "title":"",
      "description":"",
      "url":""
    }
  ]
}
`
        },
        {
          role: "user",
          content: `
질문: ${query}

후보:
${context}
`
        }
      ]
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      reply: "검색 결과를 생성했어요",
      results: candidates.slice(0, 3)
    };
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

  /* =========================
     AI SEARCH (3단계 핵심)
  ========================= */
  if (cleanUrl === "/api/chat" && req.method === "POST") {

    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {

      const { message } = JSON.parse(body);

      // 1️⃣ query expansion
      const keywords = await expandQuery(message);

      // 2️⃣ 후보 검색
      const candidates = getCandidates(keywords);

      // 3️⃣ AI 최종 정렬 + 설명 생성
      const result = await finalAI(message, candidates);

      res.end(JSON.stringify(result));
    });

    return;
  }

  /* =========================
     STATIC
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
  console.log("🚀 AI SEARCH ENGINE v3 (GOOGLE-LIKE) RUNNING");
});
