const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   RAG DATABASE
========================= */
const DOCUMENTS = [
  { title: "위생안전", text: "손씻기 마스크 기침예절 세균 예방", type: "category", url: "/video.html?type=hygiene" },
  { title: "손씻기 영상", text: "손 씻는 방법 단계별 설명", type: "video", url: "/video.mp4" },
  { title: "마스크 착용법", text: "올바른 마스크 착용", type: "video", url: "/mask.mp4" },
  { title: "위생 PDF", text: "위생 교육 자료 PDF", type: "pdf", url: "/files/hygiene.pdf" }
];

/* =========================
   SAFE JSON PARSER (핵심)
========================= */
function safeJSONParse(str, fallback = {}) {
  try {
    if (!str) return fallback;

    // ```json 제거
    str = str.replace(/```json|```/g, "").trim();

    return JSON.parse(str);
  } catch (e) {
    return fallback;
  }
}

/* =========================
   OPENAI QUERY REFINER
========================= */
async function refineQuery(query) {
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
너는 검색 쿼리 변환기다.
반드시 JSON만 출력:
{"keywords":["단어1","단어2","단어3"]}
`
          },
          { role: "user", content: query }
        ]
      })
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    return safeJSONParse(content, { keywords: [query] });

  } catch {
    return { keywords: [query] };
  }
}

/* =========================
   RAG SEARCH
========================= */
function search(keywords = []) {
  return DOCUMENTS
    .map(doc => {
      let score = 0;

      keywords.forEach(k => {
        if (!k) return;
        if (doc.text.includes(k)) score += 3;
        if (doc.title.includes(k)) score += 5;
      });

      return { ...doc, score };
    })
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

/* =========================
   GROQ FINAL ANSWER
========================= */
async function generateAnswer(query, results) {
  try {
    const context = results.map(r =>
      `제목:${r.title}\n내용:${r.text}\n타입:${r.type}\nURL:${r.url}`
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
너는 교육용 검색 AI다.

반드시 JSON만 출력:
{
  "reply": "짧은 설명",
  "results": []
}

rules:
- 절대 마크다운 금지
- 절대 설명 문장 금지
- JSON만 출력
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
    const content = data?.choices?.[0]?.message?.content;

    return safeJSONParse(content, {
      reply: "검색 결과를 찾았습니다",
      results
    });

  } catch {
    return {
      reply: "서버 오류가 발생했어요",
      results: []
    };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(message) {
  const refined = await refineQuery(message);
  const results = search(refined.keywords);
  return await generateAnswer(message, results);
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req, res) => {

  const url = req.url.split("?")[0];

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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

    req.on("data", chunk => body += chunk);

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body || "{}");

        const result = await pipeline(message);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(result));

      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: true,
          reply: "서버 처리 오류"
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
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 NOT FOUND");
    }

    const ext = path.extname(filePath);

    const types = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".mp4": "video/mp4",
      ".pdf": "application/pdf"
    };

    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream"
    });

    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING:", PORT);
});
