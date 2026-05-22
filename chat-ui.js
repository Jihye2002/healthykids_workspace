let isLoading = false;

document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     STYLE
  ========================= */
  const style = document.createElement("style");

  style.textContent = `
  #chatbox{
    position:fixed;
    bottom:90px;
    right:20px;
    width:360px;
    height:560px;
    background:#fff;
    border-radius:20px;
    box-shadow:0 10px 35px rgba(0,0,0,0.18);
    z-index:9999;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    transition:0.3s;
  }

  .chatbox-hidden{
    opacity:0;
    transform:translateY(120%);
    pointer-events:none;
  }

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
    background:#f5f7fb;
    display:flex;
    flex-direction:column;
  }

  .message{
    max-width:85%;
    padding:12px 14px;
    margin-bottom:12px;
    border-radius:16px;
    line-height:1.6;
    font-size:14px;
    word-break:keep-all;
  }

  .user-msg{
    align-self:flex-end;
    background:#2f63c7;
    color:white;
  }

  .ai-msg{
    align-self:flex-start;
    background:white;
    border:1px solid #e4e4e4;
  }

  .input-area{
    display:flex;
    padding:10px;
    border-top:1px solid #eee;
    background:white;
  }

  #user-input{
    flex:1;
    border:1px solid #ddd;
    border-radius:10px;
    padding:10px;
    font-size:14px;
    outline:none;
  }

  #send-btn{
    margin-left:8px;
    border:none;
    background:#2f63c7;
    color:white;
    border-radius:10px;
    padding:10px 14px;
    cursor:pointer;
  }

  #chat-toggle-button{
    position:fixed;
    bottom:20px;
    right:20px;
    width:68px;
    height:68px;
    border:none;
    border-radius:50%;
    background:#2f63c7;
    color:white;
    font-size:28px;
    cursor:pointer;
    z-index:10000;
    box-shadow:0 5px 20px rgba(0,0,0,0.2);
  }

  .result-card{
    margin-top:12px;
    border:1px solid #e5e5e5;
    border-radius:14px;
    padding:12px;
    background:white;
  }

  .result-title{
    font-weight:bold;
    font-size:15px;
    margin-bottom:6px;
  }

  .result-desc{
    color:#666;
    font-size:13px;
    line-height:1.5;
    margin-bottom:10px;
  }

  .result-btn{
    display:inline-block;
    background:#2f63c7;
    color:white;
    text-decoration:none;
    padding:8px 12px;
    border-radius:8px;
    font-size:13px;
  }

  .loading{
    display:flex;
    gap:5px;
    padding:10px;
  }

  .loading span{
    width:7px;
    height:7px;
    border-radius:50%;
    background:#999;
    animation:loading 1s infinite;
  }

  .loading span:nth-child(2){
    animation-delay:0.2s;
  }

  .loading span:nth-child(3){
    animation-delay:0.4s;
  }

  @keyframes loading{
    0%{opacity:0.3;transform:translateY(0);}
    50%{opacity:1;transform:translateY(-4px);}
    100%{opacity:0.3;transform:translateY(0);}
  }
  `;

  document.head.appendChild(style);

  /* =========================
     UI
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatbox" class="chatbox-hidden">

      <div id="chat-header">
        🩺 헬시키즈 AI
      </div>

      <div id="chat-body"></div>

      <div class="input-area">
        <input
          id="user-input"
          type="text"
          placeholder="건강 교육 내용을 검색해보세요..."
        />

        <button id="send-btn">전송</button>
      </div>
    </div>

    <button id="chat-toggle-button">💬</button>
  `);

  const body = document.getElementById("chat-body");

  /* =========================
     INIT MESSAGE
  ========================= */
  appendMessage("ai", `
    안녕하세요 😊<br><br>

    헬시키즈 AI입니다.<br><br>

    원하는 건강 교육 내용을 검색해보세요.<br><br>

    예시:<br>
    • 감기 예방 방법<br>
    • 손씻기 방법<br>
    • 교통안전 교육<br>
    • 건강한 식습관
  `);

  /* =========================
     MESSAGE
  ========================= */
  function appendMessage(sender, html) {

    const div = document.createElement("div");

    div.className = `message ${sender}-msg`;

    div.innerHTML = html;

    body.appendChild(div);

    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     RESULT CARD
  ========================= */
  function appendResults(results) {

    const wrapper = document.createElement("div");
    wrapper.className = "message ai-msg";

    if (!results.length) {

      wrapper.innerHTML = `
        검색 결과를 찾지 못했어요 😢
      `;

      body.appendChild(wrapper);

      return;
    }

    results.forEach(item => {

      const card = document.createElement("div");

      card.className = "result-card";

      card.innerHTML = `
        <div class="result-title">
          ${item.title}
        </div>

        <div class="result-desc">
          ${item.description || item.text}
        </div>

        <a class="result-btn" href="${item.url}">
          바로가기
        </a>
      `;

      wrapper.appendChild(card);
    });

    body.appendChild(wrapper);

    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     LOADING
  ========================= */
  function showLoading() {

    const div = document.createElement("div");

    div.className = "loading";
    div.id = "loading";

    div.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    body.appendChild(div);

    body.scrollTop = body.scrollHeight;
  }

  function removeLoading() {
    document.getElementById("loading")?.remove();
  }

  /* =========================
     SEND MESSAGE
  ========================= */
  async function sendMessage() {

    if (isLoading) return;

    const input = document.getElementById("user-input");

    const text = input.value.trim();

    if (!text) return;

    isLoading = true;

    appendMessage("user", text);

    input.value = "";

    showLoading();

    try {

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          message: text
        })
      });

      const data = await response.json();

      removeLoading();

      appendMessage("ai", data.reply);

      appendResults(data.results || []);

    } catch (err) {

      console.error(err);

      removeLoading();

      appendMessage(
        "ai",
        "서버 오류가 발생했어요 😢"
      );

    } finally {

      isLoading = false;
    }
  }

  /* =========================
     EVENTS
  ========================= */
  document.getElementById("send-btn")
    .onclick = sendMessage;

  document.getElementById("user-input")
    .addEventListener("keypress", e => {

      if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    });

  document.getElementById("chat-toggle-button")
    .onclick = () => {

      document
        .getElementById("chatbox")
        .classList
        .toggle("chatbox-hidden");
    };
});
