let isLoading = false;
let lastRequestTime = 0;

document.addEventListener("DOMContentLoaded", () => {

  /* ================= STYLE ================= */
  const style = document.createElement("style");

  style.textContent = `
  #chatbox{
    position:fixed;
    bottom:90px;
    right:20px;
    width:360px;
    height:560px;
    background:#fff;
    border-radius:22px;
    box-shadow:0 12px 40px rgba(0,0,0,0.18);
    overflow:hidden;
    z-index:9999;
    display:flex;
    flex-direction:column;
  }

  .chatbox-hidden{ opacity:0; transform:translateY(120%); pointer-events:none; }

  #chat-header{
    background:#2f63c7;
    color:white;
    padding:16px;
    font-size:17px;
    font-weight:bold;
  }

  #chat-body{
    flex:1;
    overflow-y:auto;
    padding:14px;
    background:#f7f8fc;
    display:flex;
    flex-direction:column;
  }

  .message{
    max-width:88%;
    padding:12px 14px;
    margin-bottom:12px;
    border-radius:16px;
    font-size:14px;
  }

  .user-msg{ align-self:flex-end; background:#2f63c7; color:white; }
  .ai-msg{ align-self:flex-start; background:#fff; border:1px solid #eee; }

  .input-area{
    display:flex;
    padding:10px;
    border-top:1px solid #eee;
  }

  #user-input{
    flex:1;
    padding:12px;
    border-radius:12px;
    border:1px solid #ddd;
  }

  #send-btn{
    margin-left:8px;
    background:#2f63c7;
    color:white;
    border:none;
    border-radius:10px;
    padding:12px;
  }
  `;

  document.head.appendChild(style);

  /* ================= UI ================= */
  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatbox" class="chatbox-hidden">
      <div id="chat-header">🩺 헬시키즈 AI</div>
      <div id="chat-body"></div>

      <div class="input-area">
        <input id="user-input" placeholder="질문 입력">
        <button id="send-btn">전송</button>
      </div>
    </div>

    <button id="chat-toggle-button">💬</button>
  `);

  const chatBody = document.getElementById("chat-body");
  const chatbox = document.getElementById("chatbox");

  function appendMessage(type, text, results = []) {
    const msg = document.createElement("div");
    msg.className = `message ${type}-msg`;
    msg.innerHTML = text;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showLoading() {
    const div = document.createElement("div");
    div.id = "loading";
    div.innerText = "AI 응답 생성중...";
    chatBody.appendChild(div);
  }

  function removeLoading() {
    document.getElementById("loading")?.remove();
  }

  /* ================= SEND ================= */
  async function sendMessage() {

    if (isLoading) return;

    const now = Date.now();
    if (now - lastRequestTime < 1000) return;

    lastRequestTime = now;

    const input = document.getElementById("user-input");
    const text = input.value.trim();
    if (!text) return;

    appendMessage("user", text);
    input.value = "";

    isLoading = true;
    showLoading();

    try {

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const textRes = await res.text();

      let data;

      try {
        data = JSON.parse(textRes);
      } catch {
        throw new Error("SERVER NOT JSON: " + textRes);
      }

      removeLoading();

      if (!data || data.error) {
        appendMessage("ai", "서버 오류가 발생했어요 😢");
        return;
      }

      appendMessage("ai", data.reply || "응답 없음");

    } catch (err) {
      console.error(err);
      removeLoading();
      appendMessage("ai", "네트워크 오류 발생 😢");
    } finally {
      isLoading = false;
    }
  }

  document.getElementById("send-btn").onclick = sendMessage;

  document.getElementById("user-input").addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });

  document.getElementById("chat-toggle-button").onclick = () => {
    chatbox.classList.toggle("chatbox-hidden");
  };

});
