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
   1. PURE SEMANTIC ANALYSIS (핵심)
========================= */
async function semanticAnalyze(query) {

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `
너는 "검색 의도 분석 AI"다.

사용자 질문을 아래 3개로 변환하라:

1. intent (의도 한줄)
2. topic (핵심 주제 1개)
3. exclude (관련 없어야 할 것)

⚠️ 매우 중요:
- 억지 연결 금지
- 의미 기반 판단
- 손씻기는 항상 자동 포함하지 말 것

JSON ONLY:
{
  "intent":"",
  "topic":"",
  "exclude":[]
}
`
          },
          { role: "user", content: query }
        ]
      })
    }
  );

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      intent: query,
      topic: query,
      exclude: []
    };
  }
}

/* =========================
   2. AI DOCUMENT SELECTOR (핵심)
========================= */
async function aiSelectDocuments(query, analysis) {

  const context = DOCUMENTS.map(d => `
ID:${d.id}
TITLE:${d.title}
CONTENT:${d.content}
URL:${d.url}
`).join("\n");

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `
너는 "초정밀 검색 엔진"이다.

규칙:
- topic 기준으로 가장 관련 있는 것만 선택
- 최대 3개
- 무관하면 제외
- 억지 추천 금지
- 손씻기는 위생 관련일 때만 선택

출력 JSON:
{
  "results":[
    {
      "title":"",
      "description":"",
      "url":"",
      "reason":"왜 선택했는지"
    }
  ]
}
`
          },
          {
            role: "user",
            content: `
질문: ${query}

분석 결과:
${JSON.stringify(analysis)}

문서:
${context}
`
          }
        ]
      })
    }
  );

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {
      results: []
    };
  }
}

/* =========================
   3. FINAL SUMMARY AI (가벼운 설명)
========================= */
async function summarize(query, results) {

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `
너는 어린이 건강교육 설명 AI다.
짧고 쉽게 설명해라 (3~4줄).
`
          },
          {
            role: "user",
            content: `
질문: ${query}
추천 결과: ${JSON.stringify(results)}
`
          }
        ]
      })
    }
  );

  const data = await res.json();

  return data.choices?.[0]?.message?.content || "검색 결과입니다.";
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
     AI SEARCH PIPELINE v4
  ========================= */
  if (cleanUrl === "/api/chat" && req.method === "POST") {

    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {

      try {

        const { message } = JSON.parse(body);

        // 1️⃣ 의도 분석 (핵심 업그레이드)
        const analysis = await semanticAnalyze(message);

        // 2️⃣ AI 문서 선택 (정밀 필터링)
        const selected = await aiSelectDocuments(message, analysis);

        // 3️⃣ 설명 생성
        const reply = await summarize(message, selected.results || []);

        res.end(JSON.stringify({
          reply,
          results: selected.results || [],
          debug: analysis
        }));

      } catch (err) {

        console.error(err);

        res.writeHead(500);
        res.end(JSON.stringify({
          error: "AI SEARCH ERROR"
        }));
      }
    });

    return;
  }

  /* =========================
     STATIC
  ========================= */
  let filePath =
    cleanUrl === "/"
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
  console.log("🚀 AI SEMANTIC SEARCH ENGINE v4 (FINAL) RUNNING");
});
