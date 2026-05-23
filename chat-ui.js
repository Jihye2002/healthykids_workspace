document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  /* =========================
     STYLE
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

    /* GUIDE */
    .guideBox{
      background:#fff;
      border-radius:14px;
      padding:14px;
      border:1px solid #e5e5e5;
      line-height:1.5;
    }

    .guideTitle{
      font-weight:bold;
      color:#000;
      margin-bottom:10px;
    }

    .guideItem{
      display:flex;
      align-items:center;
      gap:8px;
      margin:6px 0;
      font-size:14px;
    }

    .star{
      color:#f5c542;
    }

    .quote{
      color:#2f63c7;
      font-weight:600;
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

    /* MESSAGE */
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
      line-height:1.4;
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

    /* =========================
       🤖 캐릭터형 AI 아이콘
    ========================= */
    .robotIcon{
      width:40px;
      height:40px;
      border-radius:50%;
      background:#4f7de6;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      box-shadow:0 4px 10px rgba(0,0,0,0.08);
      position:relative;
    }

    /* eyes */
    .robotIcon::before,
    .robotIcon::after{
      content:"";
      position:absolute;
      width:5px;
      height:5px;
      background:#fff;
      border-radius:50%;
      top:14px;
    }

    .robotIcon::before{ left:13px; }
    .robotIcon::after{ right:13px; }

    /* mouth */
    .robotIcon span{
      position:absolute;
      bottom:10px;
      width:10px;
      height:3px;
      background:#fff;
      border-radius:3px;
    }

    /* INPUT */
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
      padding:0 12px;
      font-size:14px;
      outline:none;
      resize:none;
      display:flex;
      align-items:center;
    }

    #text::placeholder{
      text-align:left;
      color:#999;
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

    /* TOGGLE */
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
      font-size:26px;
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

    <button id="toggleBtn">🤖</button>
  `);

  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  let loadingNode = null;

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
        <div class="guideTitle">💡 사용 예시</div>

        <div class="guideItem"><span class="star">⭐</span> 손 씻기 어떻게 해요</div>
        <div class="guideItem"><span class="star">⭐</span> 감기 안 걸리는 방법</div>
        <div class="guideItem"><span class="star">⭐</span> 횡단보도 안전하게 건너기</div>
      </div>

      <div class="guideBox">
        <div class="guideTitle">📘 이용 가이드</div>

        <div class="guideItem"><span class="quote">"AI는 어떻게 써요"</span></div>
        <div class="guideItem"><span class="quote">"메뉴는 어디에 있어요"</span></div>
        <div class="guideItem"><span class="quote">"영상은 어디서 봐요"</span></div>
        <div class="guideItem"><span class="quote">"공부는 어떻게 해요"</span></div>

        <br>

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
        <div class="robotIcon"><span></span></div>
        <div class="bubble">${text}</div>
      `;
    } else {
      wrap.innerHTML = `<div class="bubble">${text}</div>`;
    }

    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     SEND
  ========================= */
  async function send(){

    const text = input.value.trim();
    if(!text) return;

    addMessage("user", text);
    input.value = "";

    loadingNode = document.createElement("div");
    loadingNode.className = "msg ai";
    loadingNode.innerHTML = `
      <div class="robotIcon"><span></span></div>
      <div class="bubble">찾고 있어요 😊</div>
    `;
    body.appendChild(loadingNode);

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
