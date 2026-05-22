const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================
   DATABASE
========================= */
let DOCUMENTS = [];

/* =========================
   OPENAI EMBEDDING
========================= */
async function createEmbedding(text) {

  const response = await fetch(
    "https://api.openai.com/v1/embeddings",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },

      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    }
  );

  const data = await response.json();

  if (!data.data?.length) {

    console.error(data);

    throw new Error("EMBEDDING ERROR");
  }

  return data.data[0].embedding;
}

/* =========================
   COSINE SIMILARITY
========================= */
function cosineSimilarity(a, b) {

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {

    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (
    Math.sqrt(normA) *
    Math.sqrt(normB) +
    1e-10
  );
}

/* =========================
   ADD DOCUMENT
========================= */
async function addDocument(doc) {

  const embedding = await createEmbedding(
    `
    ${doc.title}
    ${doc.description || ""}
    ${doc.text}
    `
  );

  DOCUMENTS.push({
    ...doc,
    embedding
  });

  console.log("✅ DOCUMENT INDEXED:", doc.title);
}

/* =========================
   INITIAL DOCUMENTS
========================= */
async function initializeDocuments() {

  DOCUMENTS = [];

  await addDocument({
    title: "😷 질병예방",
    text: `
    감기 예방 독감 바이러스 예방 면역력
    기침예절 마스크 착용 호흡기 건강
    손씻기 감염 예방 건강관리
    `,
    description:
      "감기와 바이러스 예방 교육 자료",
    url: "/video.html?type=precaution"
  });

  await addDocument({
    title: "🧼 위생안전",
    text: `
    손씻기 세균 예방 개인위생 마스크
    올바른 손씻기 방법 기침예절
    바이러스 예방 위생 교육
    `,
    description:
      "손씻기와 개인위생 교육 자료",
    url: "/video.html?type=hygiene"
  });

  await addDocument({
    title: "🚦 실외안전",
    text: `
    횡단보도 교통안전 길건너기
    보행자 안전 신호등 안전수칙
    `,
    description:
      "횡단보도와 교통안전 교육",
    url: "/video.html?type=crosswalk"
  });

  await addDocument({
    title: "🥗 생활건강",
    text: `
    건강한 식습관 영양관리 편식예방
    음식 건강 생활습관 어린이 건강
    `,
    description:
      "건강한 식습관과 영양관리 교육",
    url: "/video.html?type=foodsafety"
  });

  /* =========================
     PDF AUTO INDEX
  ========================= */
  const uploadDir = path.join(__dirname, "uploads");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const files = fs.readdirSync(uploadDir);

  for (const file of files) {

    if (!file.endsWith(".pdf")) continue;

    try {

      const filePath = path.join(uploadDir, file);

      const buffer = fs.readFileSync(filePath);

      const pdf = await pdfParse(buffer);

      await addDocument({
        title: `📄 ${file}`,
        text: pdf.text,
        description: "업로드된 PDF 교육 자료",
        url: `/uploads/${file}`
      });

    } catch (err) {

      console.error("PDF ERROR:", file);
      console.error(err);
    }
  }

  console.log("✅ ALL DOCUMENTS READY");
}

/* =========================
   AI SEARCH
========================= */
async function searchDocuments(query) {

  if (!query) return [];

  const queryEmbedding =
    await createEmbedding(query);

  const scored = DOCUMENTS.map(doc => {

    const score = cosineSimilarity(
      queryEmbedding,
      doc.embedding
    );

    return {
      title: doc.title,
      text: doc.text,
      description: doc.description,
      url: doc.url,
      score
    };
  });

  return scored
    .filter(item => item.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   AI CHAT RESPONSE
========================= */
async function generateAIResponse(
  userMessage,
  results
) {

  const context = results
    .map(r => `
제목: ${r.title}
설명: ${r.description}
내용:
${r.text}
`)
    .join("\n");

  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },

      body: JSON.stringify({

        model: "gpt-4.1-mini",

        messages: [

          {
            role: "system",
            content: `
너는 헬시키즈 AI 건강교육 챗봇이다.

반드시:
- 어린이 교육처럼 친절하게 설명
- 검색 결과를 기반으로 설명
- 없는 정보는 지어내지 말 것
- 자연스럽게 요약할 것
`
          },

          {
            role: "user",
            content: `
사용자 질문:
${userMessage}

검색 자료:
${context}
`
          }
        ],

        temperature: 0.7
      })
    }
  );

  const data = await response.json();

  return (
    data.choices?.[0]?.message?.content ||
    "답변 생성 실패 😢"
  );
}

/* =========================
   MIME
========================= */
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4"
};

/* =========================
   SERVER
========================= */
const server = http.createServer(
  async (req, res) => {

    const cleanUrl =
      req.url.split("?")[0];

    console.log(
      "REQ:",
      req.method,
      req.url
    );

    /* =========================
       CORS
    ========================= */
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,OPTIONS"
    );

    if (req.method === "OPTIONS") {

      res.writeHead(204);

      return res.end();
    }

    /* =========================
       AI CHAT API
    ========================= */
    if (
      cleanUrl === "/api/chat" &&
      req.method === "POST"
    ) {

      let body = "";

      req.on("data", chunk => {
        body += chunk;
      });

      req.on("end", async () => {

        try {

          const parsed =
            JSON.parse(body || "{}");

          const message =
            parsed.message || "";

          console.log(
            "🔍 USER:",
            message
          );

          /* =========================
             AI SEARCH
          ========================= */
          const results =
            await searchDocuments(message);

          console.log(
            "✅ SEARCH RESULTS:",
            results.length
          );

          /* =========================
             AI RESPONSE
          ========================= */
          const reply =
            await generateAIResponse(
              message,
              results
            );

          res.writeHead(200, {
            "Content-Type":
              "application/json"
          });

          return res.end(
            JSON.stringify({
              reply,
              results
            })
          );

        } catch (err) {

          console.error(err);

          res.writeHead(500, {
            "Content-Type":
              "application/json"
          });

          return res.end(
            JSON.stringify({
              error:
                "AI SERVER ERROR"
            })
          );
        }
      });

      return;
    }

    /* =========================
       STATIC FILE
    ========================= */
    let filePath;

    if (cleanUrl === "/") {

      filePath = path.join(
        __dirname,
        "index.html"
      );

    } else {

      filePath = path.join(
        __dirname,
        cleanUrl
      );
    }

    fs.readFile(
      filePath,
      (err, data) => {

        if (err) {

          console.log(
            "❌ FILE NOT FOUND:",
            filePath
          );

          res.writeHead(404, {
            "Content-Type":
              "text/plain"
          });

          return res.end(
            "404 NOT FOUND"
          );
        }

        const ext =
          path.extname(filePath);

        res.writeHead(200, {
          "Content-Type":
            MIME[ext] ||
            "text/plain"
        });

        res.end(data);
      }
    );
  }
);

/* =========================
   START SERVER
========================= */
initializeDocuments()
  .then(() => {

    server.listen(PORT, () => {

      console.log(
        `🚀 SERVER RUNNING : ${PORT}`
      );
    });
  })
  .catch(err => {

    console.error(
      "❌ INIT ERROR"
    );

    console.error(err);
  });
