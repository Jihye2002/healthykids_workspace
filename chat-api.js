const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/* =========================
   SIMPLE KNOWLEDGE BASE
========================= */
const DOCUMENTS = [
  { title: "손씻기", text: "손을 30초 이상 씻으면 세균 제거", url: "/video.html" },
  { title: "교통안전", text: "횡단보도에서는 좌우 확인", url: "/video2.html" },
  { title: "영양", text: "균형 잡힌 식사가 중요", url: "/video3.html" }
];

/* =========================
   SIMPLE SEARCH
========================= */
function search(query) {
  return DOCUMENTS
    .map(d => ({
      ...d,
      score: d.title.includes(query) || d.text.includes(query) ? 1 : 0
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/* =========================
   GROQ AI
========================= */
async function askGroq(message, context) {

  if (!GROQ_API_KEY) {
    return {
      reply: "검색 결과를 찾았습니다.",
      results: context
    };
  }

  try {

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
            content: "너는 어린이 교육 AI야. 짧게 설명하고 JSON으로 답변"
          },
          {
            role: "user",
            content: `질문: ${message}\n\n자료:\n${JSON.stringify(context)}`
          }
        ]
      })
    });

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;

    try {
      return JSON.parse(content);
    } catch {
      return {
        reply: content,
        results: context
      };
    }

  } catch (err) {
    return {
      reply: "AI 오류 발생",
      results: context
    };
  }
}

/* =========================
   MAIN PIPELINE
========================= */
async function handleChat(message) {

  const results = search(message);

  return await askGroq(message, results);
}

module.exports = { handleChat };
