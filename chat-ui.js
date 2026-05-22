let isLoading = false;
let lastRequestTime = 0;

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
    border-radius:22px;
    box-shadow:0 12px 40px rgba(0,0,0,0.18);
    overflow:hidden;
    z-index:9999;
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
    display:flex;
    align-items:center;
    gap:8px;
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
    border:1px solid #e8e8e8;
    color:#333;
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
    border-radius:12px;
    padding:12px;
    outline:none;
    font-size:14px;
  }

  #send-btn{
    margin-left:8px;
    border:none;
    background:#2f63c7;
    color:white;
    border-radius:12px;
    padding:12px 15px;
    cursor:pointer;
    font-weight:bold;
  }

  #send-btn:hover{
    opacity:0.9;
  }

  #chat-toggle-button{
    position:fixed;
    right:20px;
    bottom:20px;
    width:68px;
    height:68px;
    border-radius:50%;
    border:none;
    background:#2f63c7;
    color:white;
    font-size:30px;
    cursor:pointer;
    z-index:10000;
    box-shadow:0 8px 25px rgba(0,0,0,0.2);
  }

  .result-card{
    margin-top:12px;
    padding:12px;
    border-radius:14px;
    background:#f8fbff;
    border:1px solid #dce7ff;
  }

  .result-title{
    font-weight:bold;
    font-size:14px;
    margin-bottom:6px;
    color:#234ea5;
  }

  .result-desc{
    font-size:13px;
    color:#555;
    line-height:1.5;
    margin-bottom:10px;
  }

  .result-btn{
    border:none;
    background:#2f63c7;
    color:white;
    border-radius:10px;
    padding:8px 12px;
    cursor:pointer;
    font-size:13px;
  }

  .result-btn:hover{
    opacity:0.92;
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
    0%{
      opacity:0.3;
      transform:translateY(0);
    }

    50%{
      opacity:1;
      transform:translateY(-4px);
    }

    100%{
      opacity:0.3;
      transform:translateY(0);
    }
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
          placeholder="궁금한 건강교육 내용을 입력하세요"
        >

        <button id="send-btn">
          전송
        </button>
      </div>

    </div>

    <button id="chat-toggle-button">
      💬
    </button>

  `);

  const chatbox = document.getElementById("chatbox");
  const chatBody = document.getElementById("chat-body");

  /* =========================
     INIT MESSAGE
    ========================= */
    appendMessage(
    "ai",
    `
    안녕하세요 😊<br><br>
  
    저는 헬시키즈 AI 건강교육 도우미예요.<br><br>
  
    궁금한 내용을 자연스럽게 질문해보세요!<br><br>
  
    예시)<br>
    • 감기 예방 방법 알려줘<br>
    • 손씻기 교육 자료 찾아줘<br>
    • 횡단보도 안전수칙 알려줘
    `,
    [
      {
        title:"📌 헬시키즈 이용 가이드",
        description:"사이트 이용 방법을 확인할 수 있어요.",
        url:"/guide.html"
      }
    ]
  );

  /* =========================
     APPEND MESSAGE
  ========================= */
  function appendMessage(sender, text, results = []) {

    const msg = document.createElement("div");

    msg.className = `message ${sender}-msg`;

    msg.innerHTML = `
      <div>${text}</div>
    `;

    /* =========================
       RESULT CARDS
    ========================= */
    if (results.length > 0) {

      results.forEach(result => {

        const card = document.createElement("div");

        card.className = "result-card";

        card.innerHTML = `
          <div class="result-title">
            ${result.title}
          </div>

          <div class="result-desc">
            ${result.description || ""}
          </div>

          <button class="result-btn">
            바로가기
          </button>
        `;

        card.querySelector("button")
          .onclick = () => {
            window.location.href = result.url;
          };

        msg.appendChild(card);
      });
    }

    chatBody.appendChild(msg);

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  /* =========================
     LOADING
  ========================= */
  function showLoading() {

    const loading = document.createElement("div");

    loading.className = "loading";
    loading.id = "loading";

    loading.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    chatBody.appendChild(loading);

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function removeLoading() {
    document.getElementById("loading")?.remove();
  }

  /* =========================
     SEND MESSAGE
  ========================= */
  async function sendMessage() {

    if (isLoading) return;

    const now = Date.now();

    if (now - lastRequestTime < 1500) {

      appendMessage(
        "ai",
        "조금만 기다려주세요 😊"
      );

      return;
    }

    lastRequestTime = now;

    const input = document.getElementById("user-input");

    const text = input.value.trim();

    if (!text) return;

    if (text.length > 200) {

      appendMessage(
        "ai",
        "질문은 200자 이하로 입력해주세요 😊"
      );

      return;
    }

    appendMessage("user", text);

    input.value = "";

    isLoading = true;

    showLoading();

    try {

      const response = await fetch("/api/chat", {

        method:"POST",

        headers:{
          "Content-Type":"application/json"
        },

        body: JSON.stringify({
          message:text
        })
      });

      const data = await response.json();

      removeLoading();

      if (data.error) {

        appendMessage(
          "ai",
          "AI 서버 오류가 발생했어요 😢"
        );

        return;
      }

      appendMessage(
        "ai",
        data.reply,
        data.results || []
      );

    } catch (err) {

      console.error(err);

      removeLoading();

      appendMessage(
        "ai",
        "서버 연결 오류가 발생했어요 😢"
      );

    } finally {

      isLoading = false;
    }
  }

  /* =========================
     EVENTS
  ========================= */
  document
    .getElementById("send-btn")
    .onclick = sendMessage;

  document
    .getElementById("user-input")
    .addEventListener("keypress", e => {

      if (e.key === "Enter") {

        e.preventDefault();

        sendMessage();
      }
    });

  document
    .getElementById("chat-toggle-button")
    .onclick = () => {

      chatbox.classList.toggle(
        "chatbox-hidden"
      );
    };

});
