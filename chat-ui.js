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
      line-height:1.6;
    }

    .guideTitle{
      font-weight:bold;
      color:#1f2a44;
      margin-bottom:10px;
      font-size:15px;
    }

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
       🔵 진짜 챗봇 로봇 아이콘 (핵심 수정)
    ========================= */
    .robotIcon{
      width:38px;
      height:38px;
      border-radius:12px;
      background:#3d6fe0;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      box-shadow:0 4px 10px rgba(0,0,0,0.12);
    }

    .robotIcon svg{
      width:22px;
      height:22px;
      fill:#fff;
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
      line-height:54px;   /* 세로 가운데 핵심 */
    }

    #text::placeholder{
      color:#999;
      line-height:54px;
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

    /* TOGGLE BUTTON */
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
      <svg viewBox="0 0 24 24">
        <rect x="4" y="6" width="16" height="14" rx="3"></rect>
        <circle cx="9" cy="12" r="1.2"></circle>
        <circle cx="15" cy="12" r="1.2"></circle>
        <path d="M9 16c1 .8 5 .8 6 0" stroke="white" stroke-width="1.5" fill="none"/>
      </svg>
    </button>
  `);

  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  let loadingNode = null;

  /* =========================
     ROBOT ICON (AI 메시지용)
  ========================= */
  const robotSVG = `
    <svg viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="3"></rect>
      <circle cx="9" cy="12" r="1.3"></circle>
      <circle cx="15" cy="12" r="1.3"></circle>
      <path d="M9 16c1 .8 5 .8 6 0" stroke="white" stroke-width="1.5" fill="none"/>
    </svg>
  `;

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

        <div class="guideItem">
          "헬시키즈에서 AI를 어떻게 사용하는지 알려줘요"
        </div>

        <div class="guideItem">
          "메뉴는 어디에 있어요"
        </div>

        <div class="guideItem">
          "영상은 어디서 봐요"
        </div>

        <div class="guideItem">
          "공부는 어떻게 해요"
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
        <div class="robotIcon">${robotSVG}</div>
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
    <div class="robotIcon">${robotSVG}</div>
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

    const answer = data.answer || data.reply || "찾았어요 😊";
    const buttons = data.buttons || [];

    const buttonsHTML = buttons.length
      ? `
        <div style="margin-top:10px; display:flex; flex-wrap:wrap;">
          ${buttons.map(b => `
            <a href="${b.url}" target="_blank"
              style="
                display:inline-block;
                margin:6px 6px 0 0;
                padding:8px 10px;
                background:#2f63c7;
                color:#fff;
                border-radius:8px;
                text-decoration:none;
                font-size:13px;
              ">
              ${b.label}
            </a>
          `).join("")}
        </div>
      `
      : "";

    const wrap = document.createElement("div");
    wrap.className = "msg ai";

    wrap.innerHTML = `
      <div class="robotIcon">${robotSVG}</div>
      <div class="bubble">
        ${answer}
        ${buttonsHTML}
      </div>
    `;

    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;

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

  document.getElementById("closeBtn").onclick = () => {
    chatApp.style.display = "none";
    resetChat();
  };

  document.getElementById("toggleBtn").onclick = () => {
    chatApp.style.display = "flex";
    resetChat();
  };

});
