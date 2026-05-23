document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  /* =========================
     STYLE (ChatGPT + Kid Friendly UI)
  ========================= */
  document.head.insertAdjacentHTML("beforeend", `
  <style>

    #chatApp{
      position:fixed;
      bottom:110px;
      right:25px;
      width:420px;
      height:650px;
      background:#fff;
      border-radius:18px;
      box-shadow:0 20px 50px rgba(0,0,0,0.12);
      display:none;
      flex-direction:column;
      overflow:hidden;
      z-index:9999;
      font-family:Arial,sans-serif;
    }

    #chatHeader{
      background:#2f63c7;
      color:#fff;
      padding:14px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      font-weight:bold;
    }

    #chatBody{
      flex:1;
      padding:14px;
      overflow-y:auto;
      display:flex;
      flex-direction:column;
      gap:12px;
      background:#f7f9ff;
    }

    /* ================= GUIDE ================= */
    .guideBox{
      background:#fff;
      border-radius:14px;
      padding:14px;
      border:1px solid #e5e5e5;
      line-height:1.6;
    }

    .guideTitle{
      font-weight:bold;
      color:#1f2a44;
      margin-bottom:12px;
      font-size:15px;
    }

    .guideItem{
      margin:10px 0;
      padding-left:8px;
      font-size:14px;
      line-height:1.6;
    }

    .star{
      color:#f5c542;
      margin-right:6px;
    }

    .quote{
      color:#2f63c7;
      font-weight:600;
      display:block;
      margin-left:10px;
    }

    .guideBtn{
      display:inline-block;
      margin-top:12px;
      padding:8px 12px;
      background:#2f63c7;
      color:#fff;
      border-radius:8px;
      text-decoration:none;
    }

    /* ================= CHAT ================= */
    .msg{
      display:flex;
      gap:10px;
      align-items:flex-start;
    }

    .user{
      justify-content:flex-end;
    }

    .bubble{
      padding:12px 14px;
      border-radius:14px;
      font-size:14px;
      white-space:pre-wrap;
      word-break:break-word;
      line-height:1.5;
      max-width:78%;
    }

    .user .bubble{
      background:#2f63c7;
      color:#fff;
    }

    .ai .bubble{
      background:#fff;
      border:1px solid #e3e3e3;
    }

    /* ================= ROBOT CHARACTER ================= */
    .robotIcon{
      width:36px;
      height:36px;
      border-radius:50%;
      background:linear-gradient(145deg,#6fa3ff,#3d6fe0);
      position:relative;
      flex-shrink:0;
    }

    .robotIcon::before,
    .robotIcon::after{
      content:"";
      position:absolute;
      width:5px;
      height:5px;
      background:#fff;
      border-radius:50%;
      top:12px;
    }

    .robotIcon::before{ left:9px; }
    .robotIcon::after{ right:9px; }

    .robotIcon span{
      position:absolute;
      bottom:8px;
      left:50%;
      transform:translateX(-50%);
      width:10px;
      height:5px;
      border:2px solid #fff;
      border-top:0;
      border-radius:0 0 10px 10px;
    }

    /* ================= INPUT ================= */
    #inputBox{
      display:flex;
      align-items:center;
      gap:8px;
      padding:10px;
      background:#fff;
      border-top:1px solid #ddd;
    }

    #text{
      flex:1;
      height:54px;
      border:1px solid #ddd;
      border-radius:10px;
      padding:10px 12px;
      font-size:14px;
      outline:none;
      resize:none;
      line-height:1.4;
    }

    #send{
      width:80px;
      height:54px;
      background:#2f63c7;
      color:#fff;
      border:none;
      border-radius:10px;
      font-weight:bold;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
    }

    /* ================= LOADING (typing effect) ================= */
    .typing {
      display:flex;
      gap:4px;
      padding:10px 14px;
    }

    .typing span{
      width:6px;
      height:6px;
      background:#999;
      border-radius:50%;
      animation:bounce 1.2s infinite;
    }

    .typing span:nth-child(2){ animation-delay:0.2s; }
    .typing span:nth-child(3){ animation-delay:0.4s; }

    @keyframes bounce{
      0%,80%,100%{ transform:translateY(0); opacity:0.4; }
      40%{ transform:translateY(-5px); opacity:1; }
    }

    /* ================= TOGGLE ================= */
    #toggleBtn{
      position:fixed;
      right:25px;
      bottom:25px;
      width:70px;
      height:70px;
      border:none;
      border-radius:50%;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      z-index:9999;
    }

  </style>
  `);

  /* =========================
     UI
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatApp">

      <div id="chatHeader">
        헬시키즈 AI
        <span id="closeBtn" style="cursor:pointer;">✕</span>
      </div>

      <div id="chatBody"></div>

      <div id="inputBox">
        <textarea id="text" placeholder="궁금한 걸 물어보세요 😊"></textarea>
        <button id="send">찾기</button>
      </div>

    </div>

    <button id="toggleBtn">
      <div class="robotIcon"><span></span></div>
    </button>
  `);

  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  let loadingNode = null;

  const robotHTML = `<div class="robotIcon"><span></span></div>`;

  /* =========================
     RESET
  ========================= */
  function resetChat(){
    body.innerHTML = "";
    input.value = "";
    showGuide();
  }

  /* =========================
     GUIDE
  ========================= */
  function showGuide(){
    body.innerHTML = `
      <div class="guideBox">
        <div class="guideTitle">💡 이렇게 물어보면 좋아요</div>

        <div class="guideItem"><span class="star">⭐</span> 손 씻기는 어떻게 하나요?</div>
        <div class="guideItem"><span class="star">⭐</span> 감기에 안 걸리려면?</div>
        <div class="guideItem"><span class="star">⭐</span> 횡단보도 안전하게 건너는 방법</div>
      </div>

      <div class="guideBox">
        <div class="guideTitle">📘 헬시키즈 사용 방법</div>

        <div class="guideItem">
          <span class="quote">"AI를 어떻게 사용해요?"</span>
          → AI에게 질문할 수 있어요
        </div>

        <div class="guideItem">
          <span class="quote">"메뉴는 어디 있어요?"</span>
          → 원하는 기능을 찾을 수 있어요
        </div>

        <div class="guideItem">
          <span class="quote">"영상은 어디서 봐요?"</span>
          → 재미있는 영상을 볼 수 있어요
        </div>

        <div class="guideItem">
          <span class="quote">"공부는 어떻게 해요?"</span>
          → 공부 내용을 확인할 수 있어요
        </div>

        <a class="guideBtn" href="guide.html" target="_blank">가이드 보기</a>
      </div>
    `;
  }

  /* =========================
     MESSAGE
  ========================= */
  function addMessage(type, text){

    const wrap = document.createElement("div");
    wrap.className = `msg ${type}`;

    if(type === "ai"){
      wrap.innerHTML = `
        ${robotHTML}
        <div class="bubble">${text}</div>
      `;
    } else {
      wrap.innerHTML = `<div class="bubble">${text}</div>`;
    }

    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     LOADING (ChatGPT style)
  ========================= */
  function showTyping(){
    const wrap = document.createElement("div");
    wrap.className = "msg ai";
    wrap.innerHTML = `
      ${robotHTML}
      <div class="bubble typing">
        <span></span><span></span><span></span>
      </div>
    `;
    body.appendChild(wrap);
    return wrap;
  }

  /* =========================
     SEND
  ========================= */
  async function send(){

    const text = input.value.trim();
    if(!text) return;

    addMessage("user", text);
    input.value = "";

    loadingNode = showTyping();

    try{

      const res = await fetch(`${API_BASE}/api/chat`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();

      loadingNode?.remove();
      loadingNode = null;

      addMessage("ai", data.reply || "찾았어요 😊");

    } catch(e){

      loadingNode?.remove();
      loadingNode = null;

      addMessage("ai", "서버 오류가 발생했어요 😢");
    }
  }

  /* =========================
     EVENTS
  ========================= */

  document.getElementById("send").onclick = send;

  input.addEventListener("keydown", (e)=>{
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  document.getElementById("toggleBtn").onclick = () => {
    chatApp.style.display = "flex";
    resetChat();
  };

  document.getElementById("closeBtn").onclick = () => {
    chatApp.style.display = "none";
    resetChat();
  };

});
