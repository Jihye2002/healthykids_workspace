// chat-api.js

const ChatAPI = (() => {

  async function sendMessage(userMessage) {
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: userMessage
        })
      });

      if (!response.ok) {
        throw new Error("Server Error");
      }

      const data = await response.json();

      return {
        reply: data.reply || "응답이 없습니다.",
        related: data.related || [],
        menus: data.menus || []
      };

    } catch (err) {
      console.error("API Error:", err);

      return {
        reply: "서버와 연결할 수 없습니다 😢",
        related: [],
        menus: []
      };
    }
  }

  return {
    sendMessage
  };

})();
