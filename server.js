const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   API KEYS
========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DB
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(__dirname));

const upload = multer({ dest: "uploads/" });

/* =========================
   CLEAN HTML (강화 버전)
========================= */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi, "")

    // 메뉴 완전 제거
    .replace(
      /로그인|회원가입|회원정보|개인정보|회원탈퇴|Q&A|공지사항|다운로드|영상보기|메뉴|HOME|MENU/gi,
      ""
    )

    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   NORMALIZE
========================= */
function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^\w가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   SPLIT
========================= */
function splitParagraphs(text) {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 40);
}

/* =========================
   TITLE
========================= */
function getTitle(html, file) {
  const m = html.match(/<title>(.*?)<\/title>/i);
  return m?.[1]?.trim() || file.replace(".html", "");
}

/* =========================
   LOAD DATA
========================= */
async function crawlSite() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".html"));

  for (const file of files) {
    try {
      const html = fs.readFileSync(path.join(__dirname, file), "utf-8");
      const clean = stripHtml(html);
      const title = getTitle(html, file);

      splitParagraphs(clean).forEach(p => {
        DOCUMENTS.push({
          title,
          text: p,
          url: "/" + file,
          type: "html"
        });
      });
    } catch (e) {}
  }
}

async function loadPdfFiles() {
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".pdf"));

  for (const pdf of files) {
    try {
      const buffer = fs.readFileSync(path.join(__dirname, pdf));
      const parsed = await pdfParse(buffer);

      splitParagraphs(parsed.text).forEach(p => {
        DOCUMENTS.push({
          title: pdf.replace(".pdf", ""),
          text: p,
          url: "/" + pdf,
          type: "pdf"
        });
      });
    } catch (e) {}
  }
}

/* =========================
   EMBEDDING
========================= */
async function embed(text) {
  if (!OPENAI_API_KEY) return [];

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    });

    const data = await res.json();
    return data?.data?.[0]?.embedding || [];
  } catch {
    return [];
  }
}

/* =========================
   VECTOR BUILD
========================= */
async function rebuildVector() {
  VECTOR_DB = [];

  for (const d of DOCUMENTS) {
    const vector = await embed(d.text);
    VECTOR_DB.push({ ...d, vector });
  }
}

/* =========================
   COSINE
========================= */
function cosine(a, b) {
  if (!a?.length || !b?.length) return 0;

  let dot = 0, ma = 0, mb = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] ** 2;
    mb += b[i] ** 2;
  }

  return dot / (Math.sqrt(ma) * Math.sqrt(mb) + 1e-9);
}

/* =========================
   RETRIEVE (TOP 15)
========================= */
async function retrieve(query) {
  const qvec = await embed(query);
  const keywords = normalize(query).split(" ");

  return VECTOR_DB.map(d => {
    let score = 0;

    if (qvec.length && d.vector.length) {
      score += cosine(qvec, d.vector);
    }

    const text = normalize(d.text);
    const title = normalize(d.title);

    for (const k of keywords) {
      if (k && text.includes(k)) score += 0.4;
    }

    if (title.includes(normalize(query))) {
      score += 1.2;
    }

    return { ...d, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

/* =========================
   RERANK (🔥 핵심)
========================= */
function rerank(docs, query) {
  const q = normalize(query);

  return docs
    .map(d => {
      let score = d.score;

      // 제목 가중치
      if (normalize(d.title).includes(q)) score += 1.5;

      // 길이 페널티 (너무 긴 문장 제거)
      if (d.text.length > 300) score -= 0.2;

      // 메뉴/쓰레기 문장 제거
      if (
        d.text.includes("로그인") ||
        d.text.includes("회원가입") ||
        d.text.includes("메뉴")
      ) {
        score -= 2;
      }

      return { ...d, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* =========================
   LLM (OPENAI / GROQ)
========================= */
async function generateAIResponse(query, docs) {
  const context = docs
    .map(d => `제목:${d.title}\n내용:${d.text}`)
    .join("\n\n")
    .slice(0, 6000);

  const messages = [
    {
      role: "system",
      content: `
너는 어린이 건강 교육 AI야.

규칙:
- 관련 없는 내용 금지
- 5줄 이하
- 아주 쉽게 설명
- 핵심만 요약
- 메뉴/사이트 구조 절대 언급 금지
      `
    },
    {
      role: "user",
      content: `질문: ${query}\n\n자료:\n${context}`
    }
  ];

  try {
    // 1) OpenAI 우선
    if (OPENAI_API_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.3,
          max_tokens: 250
        })
      });

      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim();
    }

    // 2) GROQ fallback
    if (GROQ_API_KEY) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama3-70b-8192",
          messages,
          temperature: 0.3,
          max_tokens: 250
        })
      });

      const data = await res.json();
      return data?.choices?.[0]?.message?.content?.trim();
    }

    return "관련 자료를 찾았어요 😊";
  } catch (e) {
    return "AI 응답 실패 😢";
  }
}

/* =========================
   API
========================= */
app.post("/api/chat", async (req, res) => {
  const message = req.body.message || "";

  const retrieved = await retrieve(message);
  const ranked = rerank(retrieved, message);

  if (!ranked.length) {
    return res.json({
      reply: "관련 자료가 없어요 😢",
      results: []
    });
  }

  const reply = await generateAIResponse(message, ranked);

  res.json({
    reply,
    results: ranked.map(r => ({
      title: r.title,
      url: r.url,
      type: r.type,
      thumbnail: r.thumbnail || ""
    }))
  });
});

/* =========================
   INIT
========================= */
(async () => {
  DOCUMENTS = [];
  await crawlSite();
  await loadPdfFiles();
  await rebuildVector();
})();

/* =========================
   START
========================= */
app.listen(PORT, () => {
  console.log("V7 AI SERVER RUNNING:", PORT);
});
