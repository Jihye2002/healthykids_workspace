document.addEventListener("DOMContentLoaded", () => {

  const page = location.pathname.split("/").pop();

  const EXCLUDE = ["login.html", "signup.html"];

  if (EXCLUDE.includes(page)) return;

  /* =========================
     STYLE
  ========================= */
  const style = document.createElement("style");

  style.textContent = `

    #chat-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 65px;
      height: 65px;
      border-radius: 50%;
      background: #2f63c7;
      color: white;
      border: none;
      font-size: 28px;
      cursor: pointer;
      z-index: 99999;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    }

    #chat-panel {
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 360px;
      height: 560px;
      background: white;
      border-radius: 18px;
      overflow: hidden;
      display: none;
      flex-direction: column;
      z-index: 99999;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    #chat-header {
      background: #2f63c7;
      color: white;
      padding: 16px;
      font-size: 18px;
      font-weight: bold;
    }

    #chat-box {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
      background: #f5f7fb;
    }

    #chat-input-area {
      display: flex;
      border-top: 1px solid #ddd;
      background: white;
    }

    #chat-input {
      flex: 1;
      border: none;
      outline: none;
      padding: 15px;
      font-size: 14px;
    }

    #chat-send {
      border: none;
      background: #2f63c7;
      color: white;
      padding: 0 18px;
      cursor: pointer;
      font-weight: bold;
    }

    .chat-message {
      margin-bottom: 12px;
      line-height: 1.6;
      font-size: 14px;
    }

    .bot-message {
      color: #333;
    }

    .user-message {
      text-align: right;
      color: #2f63c7;
      font-weight: bold;
    }

    .result-card {
      background: white;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border: 1px solid #eee;
    }

    .result-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 8px;
      color: #222;
    }

    .result-desc {
      font-size: 13px;
      color: #666;
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .result-btn {
      background: #2f63c7;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 10px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
    }

    .result-btn:hover {
      background: #1f4ea5;
    }

  `;

  document.head.appendChild(style);

  /* =========================
     HTML
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `

    <button id="chat-btn">💬</button>

    <div id="chat-panel">

      <div id="chat-header">
        헬시키즈 AI
      </div>

      <div id="chat-box"></div>

      <div id="chat-input-area">
        <input
          id="chat-input"
          placeholder="건강 교육 내용을 검색해보세요"
        />

        <button id="chat-send">
          검색
        </button>
      </div>

    </div>

  `);

  const btn = document.getElementById("chat-btn");
  const panel = document.getElementById("chat-panel");
  const box = document.getElementById("chat-box");
  const input = document.getElementById("chat-input");

  /* =========================
     TOGGLE
  ========================= */
  btn.onclick = () => {

    panel.style.display =
      panel.style.display === "flex"
        ? "none"
        : "flex";
  };

  /* =========================
     MESSAGE
  ========================= */
  function addMessage(text, isUser = false) {

    const div = document.createElement("div");

    div.className =
      "chat-message " +
      (isUser ? "user-message" : "bot-message");

    div.innerHTML = text.replace(/\n/g, "<br>");

    box.appendChild(div);

    box.scrollTop = box.scrollHeight;
  }

  /* =========================
     CARD
  ========================= */
  function addCard(item) {

    const card = document.createElement("div");

    card.className = "result-card";

    card.innerHTML = `

      <div class="result-title">
        ${item.title}
      </div>

      <div class="result-desc">
        ${item.description || ""}
      </div>

      <button
        class="result-btn"
        onclick="location.href='${item.url}'">
        바로가기
      </button>

    `;

    box.appendChild(card);

    box.scrollTop = box.scrollHeight;
  }

  /* =========================
     INIT
  ========================= */
  async function initChat() {

    try {

      const res = await fetch("/api/init");

      const data = await res.json();

      data.messages.forEach(msg => {
        addMessage(msg, false);
      });

      if (data.guide) {
        addCard(data.guide);
      }

    } catch (err) {

      console.error(err);

      addMessage(
        "❌ AI 초기화 중 오류가 발생했습니다.",
        false
      );
    }
  }

  /* =========================
     SEARCH API
  ========================= */
  async function ragSearch(query) {

    const res = await fetch("/api/search", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        query
      })
    });

    return await res.json();
  }

  /* =========================
     SEND
  ========================= */
  async function send() {

    const query = input.value.trim();

    if (!query) return;

    addMessage("👤 " + query, true);

    input.value = "";

    try {

      const results = await ragSearch(query);

      if (!results.length) {

        addMessage(
          "검색 결과를 찾지 못했어요 😢",
          false
        );

        return;
      }

      addMessage(
        `🔎 "${query}" 검색 결과입니다.`,
        false
      );

      results.forEach(item => {
        addCard(item);
      });

    } catch (err) {

      console.error(err);

      addMessage(
        "❌ 검색 중 오류가 발생했습니다.",
        false
      );
    }
  }

  /* =========================
     EVENTS
  ========================= */
  document
    .getElementById("chat-send")
    .onclick = send;

  input.addEventListener("keypress", e => {

    if (e.key === "Enter") {
      send();
    }
  });

  /* =========================
     START
  ========================= */
  initChat();

});
