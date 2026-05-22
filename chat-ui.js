let isLoading = false;
let lastRequestTime = 0;

document.addEventListener("DOMContentLoaded", function () {

  /* =========================
     스타일
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
    box-shadow:0 12px 35px rgba(0,0,0,0.18);
    z-index:9999;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    transition:all 0.3s ease;
    font-family:'Pretendard',sans-serif;
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
    font-weight:700;
    display:flex;
    align-items:center;
    gap:8px;
  }

  #chat-body{
    flex:1;
    overflow-y:auto;
    padding:14px;
    background:#f6f8fc;
    display:flex;
    flex-direction:column;
  }

  .message{
    max-width:88%;
    padding:12px 14px;
    margin-bottom:14px;
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
    padding:12px;
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
    padding:0 16px;
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
    border:none;
    border-radius:50%;
    background:#2f63c7;
    color:white;
    font-size:28px;
    cursor:pointer;
    z-index:10000;
    box-shadow:0 8px 24px rgba(0,0,0,0.2);
  }

  .related-wrapper{
    display:flex;
    flex-wrap:wrap;
    gap:7px;
    margin-top:10px;
  }

  .related-btn{
    border:none;
    background:#edf3ff;
    color:#2f63c7;
    border-radius:20px;
    padding:7px 12px;
    cursor:pointer;
    font-size:12px;
    font-weight:600;
  }

  .related-btn:hover{
    background:#dbe7ff;
  }

  .menu-card{
    margin-top:12px;
    background:white;
    border:1px solid #e7e7e7;
    border-radius:14px;
    padding:13px;
  }

  .menu-title{
    font-size:15px;
    font-weight:700;
    margin-bottom:6px;
    color:#222;
  }

  .menu-desc{
    font-size:13px;
    color:#666;
    line-height:1.5;
    margin-bottom:10px;
  }

  .menu-btn{
    width:100%;
    border:none;
    background:#2f63c7;
    color:white;
    border-radius:10px;
    padding:10px;
    cursor:pointer;
    font-weight:600;
  }

  .menu-btn:hover{
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
      transform:translateY(-3px);
    }
    100%{
      opacity:0.3;
      transform:translateY(0);
    }
  }
  `;

  document.head.appendChild(style);

  /* =========================
     기본 UI 생성
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
          placeholder="궁금한 건강교육 내용을 검색해보세요"
        >
        <button id="send-btn">전송</button>
      </div>

    </div>

    <button id="chat-toggle-button">💬</button>
  `);

  const body = document.getElementById("chat-body");
  const chatbox = document.getElementById("chatbox");

  /* =========================
     메시지 추가
  ========================= */
  function appendMessage(sender, text, options = {}) {

    const msg = document.createElement("div");
    msg.className = `message ${sender}-msg`;

    const textDiv = document.createElement("div");
    textDiv.innerHTML = text;

    msg.appendChild(textDiv);

    /* =========================
       연관 키워드
    ========================= */
    if (options.related?.length) {

      const relatedWrap = document.createElement("div");
      relatedWrap.className = "related-wrapper";

      options.related.forEach(keyword => {

        const btn = document.createElement("button");

        btn.className = "related-btn";
        btn.innerText = keyword;

        btn.onclick = () => {

          document.getElementById("user-input").value = keyword;

          sendMessage();
        };

        relatedWrap.appendChild(btn);
      });

      msg.appendChild(relatedWrap);
    }

    /* =========================
       메뉴 카드
    ========================= */
    if (options.menus?.length) {

      options.menus.forEach(menu => {

        const card = document.createElement("div");

        card.className = "menu-card";

        card.innerHTML = `
          <div class="menu-title">${menu.title}</div>
          <div class="menu-desc">${menu.description || ""}</div>
          <button class="menu-btn">바로가기</button>
        `;

        card.querySelector("button").onclick = () => {
          window.location.href = menu.url;
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

    const loading = document.createElement("div");

    loading.className = "loading";
    loading.id = "loading";

    loading.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;

    body.appendChild(loading);

    body.scrollTop = body.scrollHeight;
  }

  function removeLoading() {
    document.getElementById("loading")?.remove();
  }

  /* =========================
     초기 메시지
  ========================= */
  async function loadInit() {

    try {

      const response = await fetch("/api/init");

      const data = await response.json();

      appendMessage(
        "ai",
        `
        안녕하세요 😊<br><br>
        헬시키즈 AI 검색 도우미입니다.<br><br>
        원하는 건강교육 내용을 검색해보세요.<br><br>
        예시)<br>
        • 감기 예방<br>
        • 손씻기 방법<br>
        • 횡단보도 안전수칙
        `
      );

      if (data.guide) {

        appendMessage(
          "ai",
          "📌 처음 이용한다면 가이드를 먼저 확인해보세요!",
          {
            menus: [
              {
                title: data.guide.title,
                description: data.guide.description,
                url: data.guide.url
              }
            ]
          }
        );
      }

    } catch (err) {

      console.error(err);

      appendMessage(
        "ai",
        "초기 데이터를 불러오지 못했어요 😢"
      );
    }
  }

  /* =========================
     메시지 전송
  ========================= */
  async function sendMessage() {

    if (isLoading) return;

    const now = Date.now();

    if (now - lastRequestTime < 1500) {

      appendMessage(
        "ai",
        "잠시만 기다려주세요 😊"
      );

      return;
    }

    lastRequestTime = now;

    const input = document.getElementById("user-input");

    const text = input.value.trim();

    if (!text) return;

    appendMessage("user", text);

    input.value = "";

    isLoading = true;

    showLoading();

    try {

      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: text
        })
      });

      const data = await response.json();

      removeLoading();

      if (!data.reply) {

        appendMessage(
          "ai",
          "검색 결과를 찾지 못했어요 😢"
        );

        isLoading = false;

        return;
      }

      appendMessage(
        "ai",
        data.reply,
        {
          related: data.related || [],
          menus: data.menus || []
        }
      );

    } catch (err) {

      console.error(err);

      removeLoading();

      appendMessage(
        "ai",
        "AI 서버 연결 중 오류가 발생했어요 😢"
      );

    } finally {

      isLoading = false;
    }
  }

  /* =========================
     이벤트
  ========================= */
  document.getElementById("send-btn").onclick = sendMessage;

  document.getElementById("user-input")
    .addEventListener("keypress", (e) => {

      if (e.key === "Enter") {

        e.preventDefault();

        sendMessage();
      }
    });

  document.getElementById("chat-toggle-button")
    .onclick = () => {

      chatbox.classList.toggle("chatbox-hidden");
    };

  /* =========================
     초기 로드
  ========================= */
  loadInit();

});
