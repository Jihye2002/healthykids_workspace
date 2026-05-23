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
   OPENAI QUERY PARSER (핵심)
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
사용자 문장을 검색 최적 키워드 3개로 변환해라.
JSON으로만 출력:
{"keywords":[""]}
            `
          },
          { role: "user", content: query }
        ]
      })
    });

    const data = await res.json();
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { keywords: [query] };
  }
}

/* =========================
   RAG SEARCH
========================= */
function search(keywords) {
  return DOCUMENTS.map(doc => {
    let score = 0;

    keywords.forEach(k => {
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
   GROQ FINAL RESPONSE
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
반드시 JSON으로만 출력:
{
 "reply":"",
 "summary":"",
 "results":[]
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
    return JSON.parse(data.choices[0].message.content);

  } catch {
    return {
      reply: "검색 완료",
      results
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

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (url === "/api/chat") {
    if (req.method !== "POST") {
      res.writeHead(405);
      return res.end(JSON.stringify({ error: "method not allowed" }));
    }

    let body = "";
    req.on("data", c => body += c);

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body || "{}");

        const result = await pipeline(message);

        res.writeHead(200);
        res.end(JSON.stringify(result));

      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: true }));
      }
    });

    return;
  }

  let filePath = url === "/" ? "index.html" : path.join(__dirname, url);

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
  console.log("🚀 SERVER RUNNING:", PORT);
});
