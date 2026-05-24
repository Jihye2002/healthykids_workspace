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
      font-size:16px;
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

    .guideBtn{
      display:inline-block;
      margin-top:12px;
      padding:8px 12px;
      background:#2f63c7;
      color:#fff;
      border-radius:8px;
      text-decoration:none;
      font-size:14px;
    }

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
      line-height:1.6;
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
       ROBOT ICON
    ========================= */
    .robotIcon{
      width:52px;
      height:52px;
      border-radius:16px;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      box-shadow:0 8px 18px rgba(0,0,0,0.15);
    }

    .robotIcon svg{
      width:34px;
      height:34px;
    }

    /* =========================
       INPUT
    ========================= */
    #inputBox{
      display:flex;
      gap:8px;
      padding:10px;
      background:#fff;
      border-top:1px solid #ddd;
      align-items:center;
    }

    #text{
      flex:1;
      height:54px;
      border:1px solid #ddd;
      border-radius:10px;
      padding:14px 12px;
      font-size:14px;
      outline:none;
      resize:none;
      box-sizing:border-box;
      font-family:Arial,sans-serif;
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
      flex-shrink:0;
    }

    /* =========================
       TOGGLE BUTTON
    ========================= */
    #toggleBtn{
      position:fixed;
      right:25px;
      bottom:25px;
      width:72px;
      height:72px;
      border:none;
      border-radius:50%;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      cursor:pointer;
      z-index:99999;
      box-shadow:0 10px 25px rgba(0,0,0,0.25);
    }

    #toggleBtn svg{
      width:42px;
      height:42px;
    }

    .resultBtn{
      display:inline-block;
      margin:6px 6px 0 0;
      padding:8px 10px;
      background:#2f63c7;
      color:#fff;
      border-radius:8px;
      text-decoration:none;
      font-size:13px;
      transition:0.2s;
    }

    .resultBtn:hover{
      transform:translateY(-1px);
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

        <!-- 안테나 -->
        <line 
          x1="12" 
          y1="4" 
          x2="12" 
          y2="2.5" 
          stroke="white" 
          stroke-width="2" 
          stroke-linecap="round"
        />

        <circle cx="12" cy="2" r="0.9" fill="white"/>

        <!-- 머리 -->
        <rect 
          x="3.5" 
          y="5" 
          width="17" 
          height="15" 
          rx="5" 
          fill="white"
        />

        <!-- 눈 -->
        <rect 
          x="8" 
          y="11" 
          width="2.5" 
          height="2.5" 
          rx="0.4" 
          fill="#2f63c7"
        />

        <rect 
          x="13.5" 
          y="11" 
          width="2.5" 
          height="2.5" 
          rx="0.4" 
          fill="#2f63c7"
        />

        <!-- 웃는 입 -->
        <path 
          d="M8.5 15c1.2 2 5.8 2 7 0"
          stroke="#2f63c7"
          stroke-width="1.6"
          fill="none"
          stroke-linecap="round"
        />

        <!-- 포인트 -->
        <circle cx="12" cy="6" r="0.8" fill="#2f63c7"/>

      </svg>

    </button>
  `);

  /* =========================
     ELEMENTS
  ========================= */
  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  /* =========================
     ROBOT SVG
  ========================= */
  const robotSVG = `
    <svg viewBox="0 0 24 24">

      <line 
        x1="12" 
        y1="4" 
        x2="12" 
        y2="2.5" 
        stroke="white" 
        stroke-width="2" 
        stroke-linecap="round"
      />

      <circle cx="12" cy="2" r="0.9" fill="white"/>

      <rect 
        x="3.5" 
        y="5" 
        width="17" 
        height="15" 
        rx="5" 
        fill="white"
      />

      <rect 
        x="8" 
        y="11" 
        width="2.5" 
        height="2.5" 
        rx="0.4" 
        fill="#2f63c7"
      />

      <rect 
        x="13.5" 
        y="11" 
        width="2.5" 
        height="2.5" 
        rx="0.4" 
        fill="#2f63c7"
      />

      <path 
        d="M8.5 15c1.2 2 5.8 2 7 0"
        stroke="#2f63c7"
        stroke-width="1.6"
        fill="none"
        stroke-linecap="round"
      />

      <circle cx="12" cy="6" r="0.8" fill="#2f63c7"/>

    </svg>
  `;

  /* =========================
     GUIDE
  ========================= */
  function showGuide(){

    body.innerHTML = `
      <div class="guideBox">

        <div class="guideTitle">
          💡 사용 예시
        </div>

        <div class="guideItem">
          <span class="star">⭐</span>
          손 씻기 어떻게 해요
        </div>

        <div class="guideItem">
          <span class="star">⭐</span>
          감기 안 걸리는 방법
        </div>

        <div class="guideItem">
          <span class="star">⭐</span>
          횡단보도 안전하게 건너기
        </div>

      </div>

      <div class="guideBox">

        <div class="guideTitle">
          📘 이용 가이드
        </div>

        <div class="guideItem">
          "영상은 어떻게 보나요"
        </div>

        <div class="guideItem">
          "AI는 어떻게 사용해요"
        </div>

        <div class="guideItem">
          "메뉴는 어디에 있어요"
        </div>

        <a 
          class="guideBtn" 
          href="guide.html" 
          target="_blank"
        >
          가이드 보기
        </a>

      </div>
    `;
  }

  /* =========================
     RESET
  ========================= */
  function resetChat(){

    body.innerHTML = "";
    input.value = "";
    showGuide();
  }

  /* =========================
     ADD MESSAGE
  ========================= */
  function addMessage(type, text){

    const wrap = document.createElement("div");
    wrap.className = `msg ${type}`;

    if(type === "ai"){

      wrap.innerHTML = `
        <div class="robotIcon">
          ${robotSVG}
        </div>

        <div class="bubble">
          ${text}
        </div>
      `;

    } else {

      wrap.innerHTML = `
        <div class="bubble">
          ${text}
        </div>
      `;
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

    /* 로딩 */
    const loadingNode = document.createElement("div");

    loadingNode.className = "msg ai";

    loadingNode.innerHTML = `
      <div class="robotIcon">
        ${robotSVG}
      </div>

      <div class="bubble">
        찾고 있어요 😊
      </div>
    `;

    body.appendChild(loadingNode);
    body.scrollTop = body.scrollHeight;

    try{

      const res = await fetch(`${API_BASE}/api/chat`, {
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          message:text
        })
      });

      const data = await res.json();

      loadingNode.remove();

      const answer =
        data.answer ||
        data.reply ||
        "찾았어요 😊";

      const buttons =
        data.buttons || [];

      const buttonsHTML = buttons.map(btn => `
        <a
          href="${btn.url}"
          target="_blank"
          class="resultBtn"
        >
          ${btn.label}
        </a>
      `).join("");

      const wrap = document.createElement("div");

      wrap.className = "msg ai";

      wrap.innerHTML = `
        <div class="robotIcon">
          ${robotSVG}
        </div>

        <div class="bubble">

          ${answer}

          ${
            buttons.length
            ? `
              <div style="margin-top:10px;">
                ${buttonsHTML}
              </div>
            `
            : ""
          }

        </div>
      `;

      body.appendChild(wrap);

      body.scrollTop = body.scrollHeight;

    } catch(error){

      console.error(error);

      loadingNode.remove();

      addMessage(
        "ai",
        "처리 실패 😢"
      );
    }
  }

  /* =========================
     EVENTS
  ========================= */

  document
    .getElementById("send")
    .onclick = send;

  input.addEventListener("keydown", (e)=>{

    if(
      e.key === "Enter" &&
      !e.shiftKey
    ){
      e.preventDefault();
      send();
    }
  });

  document
    .getElementById("closeBtn")
    .onclick = ()=>{

      chatApp.style.display = "none";
      resetChat();
    };

  document
    .getElementById("toggleBtn")
    .onclick = ()=>{

      chatApp.style.display = "flex";
      resetChat();
    };

  /* =========================
     INIT
  ========================= */
  showGuide();

});
