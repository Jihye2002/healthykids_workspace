const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DOCUMENTS
========================= */
const DOCUMENTS = [
  { id: 1, title: "질병예방", text: "감기 독감 바이러스 예방 면역 손씻기 기침예절", url: "/video.html?type=precaution" },
  { id: 2, title: "위생안전", text: "손씻기 세균 마스크 개인위생 바이러스", url: "/video.html?type=hygiene" },
  { id: 3, title: "실외안전", text: "횡단보도 교통 안전 사고 예방 길건너기", url: "/video.html?type=crosswalk" },
  { id: 4, title: "생활건강", text: "식습관 영양 건강 음식 균형 성장", url: "/video.html?type=foodsafety" }
];

/* =========================
   EMBED (가짜 fallback 포함 - 절대 서버 안 죽게)
========================= */
async function embed(text) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      // OPENAI 없어도 서버 안 죽게 fallback vector
      return new Array(128).fill(0).map(() => Math.random());
    }

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    });

    const data = await res.json();

    return data?.data?.[0]?.embedding || new Array(1536).fill(0);

  } catch {
    return new Array(128).fill(0).map(() => Math.random());
  }
}

/* =========================
   SIMPLE SEARCH (vector 없이도 동작)
========================= */
function simpleSearch(query) {
  return DOCUMENTS
    .map(d => {
      const score =
        d.title.includes(query) ||
        d.text.includes(query)
          ? 1
          : 0;

      return { ...d, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/* =========================
   GROQ (안 죽게 안전처리)
========================= */
async function askGroq(query, results) {
  try {
    if (!GROQ_API_KEY) {
      return {
        reply: "🔎 결과를 찾았습니다",
        results
      };
    }

    const context = results
      .map(r => `${r.title} - ${r.text}`)
      .join("\n");

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
            content: "짧게 한국어로 답하고 JSON으로 {reply, results} 형태로 출력"
          },
          {
            role: "user",
            content: `질문: ${query}\n\n${context}`
          }
        ]
      })
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    try {
      return JSON.parse(content);
    } catch {
      return { reply: content, results };
    }

  } catch (e) {
    return {
      reply: "서버 오류 발생",
      results
    };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(message) {
  const results = simpleSearch(message);
  return await askGroq(message, results);
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req, res) => {

  const url = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  /* ================= API ================= */
  if (url === "/api/chat") {

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "METHOD NOT ALLOWED" }));
    }

    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body || "{}");

        const result = await pipeline(message || "");

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(result));

      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: true,
          reply: "서버 오류"
        }));
      }
    });

    return;
  }

  /* ================= STATIC ================= */
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
  console.log("🚀 SERVER RUNNING ON", PORT);
});
