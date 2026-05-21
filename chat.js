let isLoading = false;
let lastRequestTime = 0;

document.addEventListener("DOMContentLoaded", function () {

  const API_KEY = "YOUR_API_KEY_HERE";

  /* =========================
     스타일
  ========================= */
  const style = document.createElement("style");
  style.innerHTML = `/* (너 기존 CSS 그대로 넣으면 됨) */`;
  document.head.appendChild(style);

  /* =========================
     기본 메시지
  ========================= */
  function getDefaultMessage() {
    return `
      <div class="message ai-msg">
        안녕하세요 😊<br><br>
        궁금한 건강교육 정보를 물어보세요!<br><br>
        예시)<br>
        • 감기 예방 방법<br>
        • 손씻기 방법<br>
        • 안전 교육 자료
      </div>
    `;
  }

  /* =========================
     UI 생성
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatbox" class="chatbox-hidden">
      <div id="chat-header">🩺 헬시키즈 AI 도우미</div>

      <div id="chat-body">
        ${getDefaultMessage()}
      </div>

      <div class="input-area">
        <input id="user-input" type="text" placeholder="메시지를 입력하세요...">
        <button id="send-btn">전송</button>
      </div>
    </div>

    <button id="chat-toggle-button">💬</button>
  `);

  const chatbox = document.getElementById("chatbox");

  /* =========================
     메시지 출력
  ========================= */
  function appendMessage(sender, text, options = {}) {
    const body = document.getElementById("chat-body");

    const msg = document.createElement("div");
    msg.className = `message ${sender}-msg`;

    const textDiv = document.createElement("div");
    textDiv.innerHTML = text;
    msg.appendChild(textDiv);

    /* related */
    if (options.related?.length) {
      const wrap = document.createElement("div");
      wrap.className = "related-wrapper";

      options.related.forEach(r => {
        const btn = document.createElement("button");
        btn.className = "related-btn";
        btn.innerText = r;
        btn.onclick = () => {
          document.getElementById("user-input").value = r;
          sendMessage();
        };
        wrap.appendChild(btn);
      });

      msg.appendChild(wrap);
    }

    /* menus */
    if (options.menus?.length) {
      options.menus.forEach(m => {
        const card = document.createElement("div");
        card.className = "menu-card";

        card.innerHTML = `
          <div class="menu-title">${m.title}</div>
          <div class="menu-desc">${m.description || ""}</div>
          <button class="menu-btn">바로가기</button>
        `;

        card.querySelector("button").onclick = () => {
          window.location.href = m.url;
        };

        msg.appendChild(card);
      });
    }

    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     로딩
  ========================= */
  function showLoading() {
    const body = document.getElementById("chat-body");

    const loading = document.createElement("div");
    loading.className = "loading";
    loading.id = "loading";

    loading.innerHTML = `<span></span><span></span><span></span>`;
    body.appendChild(loading);
  }

  function removeLoading() {
    document.getElementById("loading")?.remove();
  }

  /* =========================
     메시지 전송
  ========================= */
  async function sendMessage() {

    if (isLoading) return;

    const now = Date.now();
    if (now - lastRequestTime < 3000) {
      appendMessage("ai", "조금만 기다려주세요 😊");
      return;
    }

    lastRequestTime = now;
    isLoading = true;

    const input = document.getElementById("user-input");
    const text = input.value.trim();

    if (!text) {
      isLoading = false;
      return;
    }

    if (text.length > 100) {
      appendMessage("ai", "100자 이하로 입력해주세요 😊");
      isLoading = false;
      return;
    }

    appendMessage("user", text);
    input.value = "";
    showLoading();

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `
너는 어린이 건강교육 AI 챗봇이다.

반드시 JSON으로만 답해라:

{
  "reply":"친절한 답변",
  "related":["키워드1","키워드2","키워드3"],
  "menus":[
    {
      "title":"메뉴",
      "description":"설명",
      "url":"/health.html"
    }
  ]
}

사용자 질문:
${text}
`
                  }
                ]
              }
            ]
          })
        }
      );

      const data = await response.json();

      if (!data.candidates) throw new Error("API ERROR");

      let aiText = data.candidates[0].content.parts[0].text;

      /* =========================
         JSON 안전 처리
      ========================= */
      let cleanText = aiText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .replace(/[\u0000-\u001F]+/g, "")
        .trim();

      let parsed;

      try {
        parsed = JSON.parse(cleanText);
      } catch (e) {
        console.log("JSON parse error:", cleanText);

        parsed = {
          reply: "응답 처리 중 오류가 발생했어요 😢",
          related: [],
          menus: []
        };
      }

      removeLoading();

      appendMessage("ai", parsed.reply, {
        related: parsed.related,
        menus: parsed.menus
      });

    } catch (err) {
      console.error(err);

      removeLoading();

      appendMessage("ai",
        "서버 오류가 발생했어요 😢 잠시 후 다시 시도해주세요."
      );

    } finally {
      isLoading = false;
    }
  }

  /* =========================
     이벤트
  ========================= */
  document.getElementById("send-btn").onclick = sendMessage;

  document.getElementById("user-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  document.getElementById("chat-toggle-button").onclick = () => {
    chatbox.classList.toggle("chatbox-hidden");
  };

});
