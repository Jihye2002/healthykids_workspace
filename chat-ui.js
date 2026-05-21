document.addEventListener("DOMContentLoaded", () => {

  const page = location.pathname.split("/").pop();

  const EXCLUDE = ["login.html", "signup.html"];

  if (EXCLUDE.includes(page)) return;

  /* =========================
     1. CSS 주입
  ========================= */
  const style = document.createElement("style");
  style.textContent = `
    #chat-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #2f63c7;
      color: white;
      border: none;
      font-size: 24px;
      z-index: 99999;
      cursor: pointer;
    }

    #chat-panel {
      position: fixed;
      bottom: 90px;
      right: 20px;
      width: 340px;
      height: 480px;
      background: white;
      border-radius: 15px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 99999;
    }

    #chat-header {
      background: #2f63c7;
      color: white;
      padding: 10px;
      font-weight: bold;
    }

    #chat-box {
      flex: 1;
      padding: 10px;
      overflow-y: auto;
      font-size: 14px;
    }

    #chat-input-area {
      display: flex;
      border-top: 1px solid #eee;
    }

    #chat-input {
      flex: 1;
      padding: 10px;
      border: none;
      outline: none;
    }

    #chat-send {
      background: #2f63c7;
      color: white;
      border: none;
      padding: 10px;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  /* =========================
     2. HTML 자동 생성
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
    <button id="chat-btn">💬</button>

    <div id="chat-panel">
      <div id="chat-header">헬시키즈 AI</div>
      <div id="chat-box"></div>

      <div id="chat-input-area">
        <input id="chat-input" placeholder="검색어 입력">
        <button id="chat-send">검색</button>
      </div>
    </div>
  `);

  const btn = document.getElementById("chat-btn");
  const panel = document.getElementById("chat-panel");
  const input = document.getElementById("chat-input");
  const box = document.getElementById("chat-box");

  /* =========================
     3. 토글
  ========================= */
  btn.onclick = () => {
    panel.style.display =
      panel.style.display === "flex" ? "none" : "flex";
  };

  /* =========================
     4. 메시지
  ========================= */
  function addMessage(text, isUser) {
    const div = document.createElement("div");
    div.textContent = (isUser ? "👤 " : "🤖 ") + text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  /* =========================
     5. 검색 API 연결
  ========================= */
   const results = await ragSearch(q);

  /* =========================
     6. 전송
  ========================= */
  async function send() {
    const q = input.value;
    if (!q) return;

    addMessage(q, true);
    input.value = "";

    const results = await search(q);

    results.forEach(r => {
      addMessage(`${r.title} → ${r.url}`, false);
    });
  }

  btn.onclick = () => {
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
  };

  document.getElementById("chat-send").onclick = send;

  input.addEventListener("keypress", e => {
    if (e.key === "Enter") send();
  });

});
