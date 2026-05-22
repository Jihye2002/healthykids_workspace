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
    line-height:1.6;
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
  }

  #send-btn{
    margin-left:8px;
    border:none;
    background:#2f63c7;
    color:white;
    border-radius:12px;
    padding:12px 15px;
    cursor:pointer;
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
    color:#234ea5;
    margin-bottom:5px;
  }

  .result-desc{
    font-size:13px;
    color:#555;
    margin-bottom:10px;
  }

  .result-btn{
    border:none;
    background:#2f63c7;
    color:white;
    padding:8px 12px;
    border-radius:10px;
    cursor:pointer;
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
    animation:blink 1s infinite;
  }

  @keyframes blink{
    0%,100%{opacity:0.3;}
    50%{opacity:1;}
  }
  `;

  document.head.appendChild(style);

  /* =========================
     UI
  ========================= */
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

  /* =========================
     INIT
  ========================= */
  appendMessage("ai",
    `안녕하세요 😊<br>
    감기, 위생, 안전 등 무엇이든 물어보세요!`,
    [
      {
        title:"📌 헬시키즈 이용 가이드",
        description:"사용 방법 안내",
        url:"/guide.html"
      }
    ]
  );

  /* =========================
     MESSAGE
  ========================= */
  function appendMessage(sender, text, results = []) {

    const msg = document.createElement("div");
    msg.className = `message ${sender}-msg`;

    msg.innerHTML = `<div>${text}</div>`;

    if (results && results.length > 0) {

      results.forEach(r => {

        const card = document.createElement("div");
        card.className = "result-card";

        card.innerHTML = `
          <div class="result-title">${r.title}</div>
          <div class="result-desc">${r.description || ""}</div>
          <button class="result-btn">바로가기</button>
        `;

        card.querySelector("button").onclick = () => {
          window.location.href = r.url;
        };

        msg.appendChild(card);
      });
    }

    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showLoading(){
    const div = document.createElement("div");
    div.className = "loading";
    div.id = "loading";
    div.innerHTML = "<span></span><span></span><span></span>";
    chatBody.appendChild(div);
  }

  function removeLoading(){
    document.getElementById("loading")?.remove();
  }

  /* =========================
     SEND
  ========================= */
  async function sendMessage(){

    if(isLoading) return;

    const now = Date.now();
    if(now - lastRequestTime < 1200) return;

    lastRequestTime = now;

    const input = document.getElementById("user-input");
    const text = input.value.trim();

    if(!text) return;

    appendMessage("user", text);
    input.value = "";

    isLoading = true;
    showLoading();

    try {

      const res = await fetch("/api/chat", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ message:text })
      });

      const data = await res.json();

      removeLoading();

      if(data.error){
        appendMessage("ai", "서버 오류 😢");
        return;
      }

      appendMessage(
        "ai",
        data.reply,
        data.results || []
      );

    } catch(e){

      removeLoading();
      appendMessage("ai", "네트워크 오류 😢");

    } finally {
      isLoading = false;
    }
  }

  /* =========================
     EVENTS
  ========================= */
  document.getElementById("send-btn").onclick = sendMessage;

  document.getElementById("user-input")
    .addEventListener("keypress", e => {
      if(e.key === "Enter"){
        sendMessage();
      }
    });

  document.getElementById("chat-toggle-button")
    .onclick = () => {
      chatbox.classList.toggle("chatbox-hidden");
    };

});
