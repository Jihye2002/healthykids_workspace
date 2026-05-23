const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   AI KNOWLEDGE BASE (확장형)
========================= */
const DOCUMENTS = [
  { title: "위생안전", text: "손씻기 마스크 기침예절 세균 바이러스 예방", type: "category", url: "/video.html?type=hygiene" },
  { title: "손씻기 교육영상", text: "올바른 손씻기 6단계 방법", type: "video", url: "/video.mp4" },
  { title: "마스크 착용법", text: "올바른 마스크 착용 방법 설명", type: "video", url: "/mask.mp4" },
  { title: "위생 교육 PDF", text: "손씻기 및 위생 관리 자료", type: "pdf", url: "/files/hygiene.pdf" },
  { title: "감기 예방", text: "감기 예방 방법 면역력 생활습관", type: "category", url: "/video.html?type=cold" },
  { title: "기침 예절", text: "기침할 때 예절과 손 보호 방법", type: "guide", url: "/video.html?type=cough" }
];

/* =========================
   SAFE JSON PARSER
========================= */
function safeJSON(str, fallback) {
  try {
    if (!str) return fallback;
    str = str.replace(/```json|```/g, "").trim();
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/* =========================
   1. OPENAI - 의도 분석 (완전자동 핵심)
========================= */
async function analyze(query) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
너는 교육 검색 AI 분석기다.

사용자를 다음 형태로 변환:

{
 "keywords": ["핵심단어"],
 "type": "video|pdf|category|all",
 "intent": "hygiene|health|safety|general"
}

반드시 JSON만 출력
`
          },
          { role: "user", content: query }
        ]
      })
    });

    const data = await res.json();
    return safeJSON(data?.choices?.[0]?.message?.content, {
      keywords: [query],
      type: "all",
      intent: "general"
    });

  } catch {
    return { keywords: [query], type: "all", intent: "general" };
  }
}

/* =========================
   2. RAG SEARCH (의미 기반 확장)
========================= */
function search(ai) {
  const keywords = ai.keywords || [];

  let results = DOCUMENTS.map(doc => {
    let score = 0;

    keywords.forEach(k => {
      if (doc.title.includes(k)) score += 5;
      if (doc.text.includes(k)) score += 3;

      // 의미 확장 (자동 연관성)
      if (ai.intent === "hygiene" && doc.type === "category") score += 2;
      if (ai.type === "video" && doc.type === "video") score += 3;
      if (ai.type === "pdf" && doc.type === "pdf") score += 3;
    });

    return { ...doc, score };
  });

  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/* =========================
   3. GROQ FINAL RESPONSE
========================= */
async function generate(query, results) {
  try {

    const context = results.map(r =>
      `제목:${r.title}\n타입:${r.type}\n내용:${r.text}\nURL:${r.url}`
    ).join("\n\n");

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
너는 교육용 AI 검색 시스템이다.

출력 규칙:
반드시 JSON만 출력

{
 "reply": "짧은 설명",
 "results": [
   {
     "title": "",
     "description": "",
     "url": ""
   }
 ]
}

규칙:
- 설명은 1~2줄
- JSON 외 텍스트 금지
`
          },
          {
            role: "user",
            content: `질문:${query}\n\n데이터:\n${context}`
          }
        ]
      })
    });

    const data = await res.json();
    return safeJSON(data?.choices?.[0]?.message?.content, {
      reply: "검색 결과입니다",
      results
    });

  } catch {
    return {
      reply: "서버 오류",
      results: []
    };
  }
}

/* =========================
   PIPELINE (완전자동 핵심 흐름)
========================= */
async function pipeline(message) {
  const ai = await analyze(message);   // 1. 이해
  const results = search(ai);          // 2. 자동 검색
  return await generate(message, results); // 3. 생성
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req, res) => {

  const url = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  /* =========================
     API
  ========================= */
  if (url === "/api/chat") {

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "method not allowed" }));
    }

    let body = "";

    req.on("data", c => body += c);

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body || "{}");

        const result = await pipeline(message);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));

      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: true,
          reply: "서버 오류 발생"
        }));
      }
    });

    return;
  }

  /* =========================
     STATIC FILES
  ========================= */
  let filePath = url === "/" ? "index.html" : path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404");
    }

    const ext = path.extname(filePath);

    const mime = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".mp4": "video/mp4",
      ".pdf": "application/pdf"
    };

    res.writeHead(200, {
      "Content-Type": mime[ext] || "application/octet-stream"
    });

    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 FULL AUTO AI SEARCH RUNNING:", PORT);
});
