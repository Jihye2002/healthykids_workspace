let isLoading = false;
let lastRequestTime = 0;

document.addEventListener("DOMContentLoaded", () => {

  /* ================= STYLE ================= */
  const style = document.createElement("style");

  style.textContent = `
  #chatbox{
    position:fixed;
    bottom:20px;
    right:20px;
    width:360px;
    height:560px;
    background:white;
    border-radius:16px;
    box-shadow:0 10px 40px rgba(0,0,0,0.2);
    display:flex;
    flex-direction:column;
    z-index:999999;
  }

  #chat-body{
    flex:1;
    overflow-y:auto;
    padding:12px;
  }

  .msg{
    padding:10px;
    margin:8px 0;
    border-radius:10px;
  }

  .user{ background:#2f63c7; color:white; align-self:flex-end; }
  .ai{ background:#f1f1f1; }

  .input-area{
    display:flex;
    padding:10px;
  }

  #user-input{
    flex:1;
    padding:10px;
  }

  #send-btn{
    background:#2f63c7;
    color:white;
    border:none;
    padding:10px;
  }

  #chat-toggle{
    position:fixed;
    bottom:20px;
    right:20px;
    width:60px;
    height:60px;
    border-radius:50%;
    background:#2f63c7;
    color:white;
    z-index:999999;
  }
  `;

  document.head.appendChild(style);

  /* ================= UI ================= */
  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatbox">
      <div id="chat-body"></div>

      <div class="input-area">
        <input id="user-input" placeholder="질문 입력">
        <button id="send-btn">전송</button>
      </div>
    </div>

    <button id="chat-toggle">💬</button>
  `);

  const body = document.getElementById("chat-body");

  function addMsg(type, text) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerHTML = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  async function send() {

    if (isLoading) return;

    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

    addMsg("user", text);
    input.value = "";

    isLoading = true;

    try {

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();

      addMsg("ai", data.reply || "응답 없음");

    } catch (e) {
      addMsg("ai", "서버 오류");
    }

    isLoading = false;
  }

  document.getElementById("send-btn").onclick = send;

  document.getElementById("chat-toggle").onclick = () => {
    document.getElementById("chatbox").classList.toggle("hidden");
  };

});
