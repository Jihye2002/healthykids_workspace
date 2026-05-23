document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  /* =========================
     STYLE (유아 친화 UI)
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
      line-height:1.6;
    }

    .guideTitle{
      font-weight:bold;
      color:#1f2a44;
      margin-bottom:10px;
      font-size:15px;
    }

    /* 한 칸 더 들여쓰기 느낌 */
    .guideItem{
      margin:10px 0;
      font-size:14px;
      line-height:1.7;
      padding-left:10px;
    }

    .star{
      color:#f5c542;
      margin-right:6px;
    }

    .quote{
      color:#2f63c7;
      font-weight:600;
      display:block;
      margin:6px 0 6px 10px;
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

    /* =========================
       🤖 친근한 로봇 캐릭터 (핵심 수정)
    ========================= */
    .robotIcon{
      width:42px;
      height:42px;
      border-radius:50%;
      background:linear-gradient(145deg,#6fa3ff,#3d6fe0);
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      box-shadow:0 4px 12px rgba(0,0,0,0.12);
      position:relative;
    }

    /* 눈 (부드럽게 크게) */
    .robotIcon::before,
    .robotIcon::after{
      content:"";
      position:absolute;
      width:6px;
      height:6px;
      background:#fff;
      border-radius:50%;
      top:14px;
      opacity:0.95;
    }

    .robotIcon::before{ left:13px; }
    .robotIcon::after{ right:13px; }

    /* 입 (미소) */
    .robotIcon span{
      position:absolute;
      bottom:11px;
      width:14px;
      height:6px;
      border:2px solid #fff;
      border-top:0;
      border-radius:0 0 10px 10px;
      opacity:0.9;
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

  /* ROBOT ICON */
  const robotHTML = `<span></span>`;

  /* RESET */
  function resetChat(){
    body.innerHTML = "";
    showGuide();
  }

  /* GUIDE (유아용 설명 확장 + 줄바꿈 명확화) */
  function showGuide(){
    body.innerHTML = `
      <div class="guideBox">
        <div class="guideTitle">💡 사용 예시 (이렇게 물어보면 돼요)</div>

        <div class="guideItem">
          ⭐ 손 씻기는 어떻게 해야 하나요?
        </div>

        <div class="guideItem">
          ⭐ 감기에 걸리지 않으려면 무엇을 하면 좋을까요?
        </div>

        <div class="guideItem">
          ⭐ 횡단보도를 안전하게 건너는 방법은 무엇인가요?
        </div>
      </div>

      <div class="guideBox">
        <div class="guideTitle">📘 헬시키즈 사용 방법</div>

        <div class="guideItem">
          "헬시키즈에서 AI를 어떻게 사용하는지 알려줘요"<br>
          → AI에게 질문하는 방법을 알려줘요
        </div>

        <div class="guideItem">
          "메뉴는 어디에 있어요"<br>
          → 원하는 기능 버튼 위치를 알려줘요
        </div>

        <div class="guideItem">
          "영상은 어디서 봐요"<br>
          → 재미있는 영상을 보는 방법을 알려줘요
        </div>

        <div class="guideItem">
          "공부는 어떻게 해요"<br>
          → 공부할 내용을 찾는 방법을 알려줘요
        </div>

        <br>

        <a class="guideBtn" href="guide.html" target="_blank">가이드 보기</a>
      </div>
    `;
  }

  /* MESSAGE */
  function addMessage(type, text){

    const wrap = document.createElement("div");
    wrap.className = `msg ${type}`;

    if(type === "ai"){
      wrap.innerHTML = `
        <div class="robotIcon">${robotHTML}</div>
        <div class="bubble">${text}</div>
      `;
    } else {
      wrap.innerHTML = `<div class="bubble">${text}</div>`;
    }

    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  /* SEND */
  async function send(){

    const text = input.value.trim();
    if(!text) return;

    addMessage("user", text);
    input.value = "";

    loadingNode = document.createElement("div");
    loadingNode.className = "msg ai";
    loadingNode.innerHTML = `
      <div class="robotIcon">${robotHTML}</div>
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

  /* EVENTS */
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
