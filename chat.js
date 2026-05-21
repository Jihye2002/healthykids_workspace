let isLoading = false;
let lastRequestTime = 0;

document.addEventListener("DOMContentLoaded", function () {

  const API_KEY = "AIzaSyAX5QhLOB03yyoMw07I1tRmBucjpy8c4AM";

  /* =========================
     스타일
  ========================= */
  const style = document.createElement("style");
  style.innerHTML = #chatbox{ position:fixed; bottom:90px; right:20px; width:340px; height:500px; background:#ffffff; border-radius:18px; box-shadow:0 10px 30px rgba(0,0,0,0.18); z-index:9999; overflow:hidden; display:flex; flex-direction:column; transition:all 0.3s ease; } .chatbox-hidden{ opacity:0; transform:translateY(120%); pointer-events:none; } #chat-header{ background:#2f63c7; color:white; padding:15px; font-size:16px; font-weight:bold; display:flex; align-items:center; gap:8px; } #chat-body{ flex:1; overflow-y:auto; padding:12px; background:#f7f8fc; display:flex; flex-direction:column; } .message{ max-width:85%; padding:10px 13px; margin-bottom:12px; border-radius:15px; font-size:14px; line-height:1.5; word-break:keep-all; } .user-msg{ align-self:flex-end; background:#2f63c7; color:white; } .ai-msg{ align-self:flex-start; background:white; border:1px solid #e5e5e5; } .input-area{ display:flex; padding:10px; border-top:1px solid #eee; background:white; } #user-input{ flex:1; border:1px solid #ddd; border-radius:10px; padding:10px; outline:none; font-size:14px; } #send-btn{ margin-left:7px; background:#2f63c7; color:white; border:none; border-radius:10px; padding:10px 14px; cursor:pointer; } #send-btn:disabled{ opacity:0.6; cursor:not-allowed; } #chat-toggle-button{ position:fixed; bottom:20px; right:20px; width:65px; height:65px; border-radius:50%; border:none; background:#2f63c7; color:white; font-size:28px; cursor:pointer; z-index:10000; box-shadow:0 5px 20px rgba(0,0,0,0.2); } .related-wrapper{ display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; } .related-btn{ border:none; background:#eef3ff; color:#2f63c7; border-radius:15px; padding:6px 10px; cursor:pointer; font-size:12px; } .related-btn:hover{ background:#dbe7ff; } .menu-card{ margin-top:10px; background:#ffffff; border:1px solid #e6e6e6; border-radius:12px; padding:10px; } .menu-title{ font-weight:bold; margin-bottom:8px; color:#333; } .menu-desc{ font-size:13px; color:#666; margin-bottom:10px; } .menu-btn{ width:100%; border:none; background:#2f63c7; color:white; border-radius:8px; padding:9px; cursor:pointer; } .menu-btn:hover{ opacity:0.9; } .loading{ display:flex; gap:4px; padding:10px; } .loading span{ width:7px; height:7px; border-radius:50%; background:#999; animation:loading 1s infinite; } .loading span:nth-child(2){ animation-delay:0.2s; } .loading span:nth-child(3){ animation-delay:0.4s; } @keyframes loading{ 0%{ opacity:0.3; transform:translateY(0); } 50%{ opacity:1; transform:translateY(-3px); } 100%{ opacity:0.3; transform:translateY(0); } } ; document.head.appendChild(style);
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
