// chat-api.js
// 👉 server.js와 chat-ui.js 사이 API 브릿지

const API_URL = "/api/chat";

/* =========================
   CHAT API CALLER
========================= */
export async function sendMessage(message) {

  try {

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    // ❗ 서버가 HTML 줄 경우 방어
    const contentType = res.headers.get("content-type");

    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      console.error("❌ NON JSON RESPONSE:", text);
      throw new Error("Invalid server response");
    }

    const data = await res.json();

    return data;

  } catch (err) {
    console.error("❌ API ERROR:", err);

    return {
      error: true,
      reply: "네트워크 오류가 발생했어요 😢",
      results: []
    };
  }
}
