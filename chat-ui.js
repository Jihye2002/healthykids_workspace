document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  /* =========================
     STYLE (Blue + White + Robot UI)
  ========================= */
  document.head.insertAdjacentHTML("beforeend", `
  <style>

    #chatApp{
      position:fixed;
      bottom:110px;
      right:25px;
      width:420px;
      height:650px;
      background:#ffffff;
      border-radius:18px;
      box-shadow:0 20px 50px rgba(0,0,0,0.15);
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
      background:#f6f7fb;
    }

    /* GUIDE */
    .guideBox{
      background:#fff;
      border-radius:14px;
      padding:14px;
      border:1px solid #e5e5e5;
    }

    .guideTitle{
      font-weight:bold;
      color:#2f63c7;
      margin-bottom:10px;
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
    }

    .user .bubble{
      background:#2f63c7;
      color:#fff;
      max-width:75%;
    }

    .ai .bubble{
      background:#fff;
      border:1px solid #dcdcdc;
      max-width:78%;
    }

    /* 🔵 ROBOT ICON (완전 변경 핵심) */
    .robotIcon{
      width:36px;
      height:36px;
      border-radius:50%;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
      box-shadow:0 4px 10px rgba(0,0,0,0.12);
    }

    .robotIcon svg{
      width:20px;
      height:20px;
      fill:#fff;
    }

    /* RESULT */
    .resultCard{
      background:#fff;
      border:1px solid #ddd;
      border-radius:14px;
      padding:14px;
    }

    .resultTitle{
      font-weight:bold;
      color:#2f63c7;
      margin-bottom:8px;
    }

    .resultSummary{
      font-size:14px;
      color:#333;
      line-height:1.5;
    }

    .resultBtn{
      display:inline-block;
      margin-top:10px;
      padding:8px 12px;
      background:#2f63c7;
      color:#fff;
      border-radius:8px;
      text-decoration:none;
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
      padding:12px;
      font-size:14px;
      outline:none;
      resize:none;
      font-family:Arial;
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
      z-index:9999;
      cursor:pointer;
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
        <button id="send">검색</button>
      </div>

    </div>

    <button id="toggleBtn">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
        <path d="M12 2a2 2 0 00-2 2v1H8a3 3 0 00-3 3v9a3 3 0 003 3h8a3 3 0 003-3V8a3 3 0 00-3-3h-2V4a2 2 0 00-2-2zm-3 9h2v2H9v-2zm6 0h2v2h-2v-2z"/>
      </svg>
    </button>
  `);

  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  let loadingNode = null;

  /* =========================
     ROBOT SVG
  ========================= */
  const robotSVG = `
    <svg viewBox="0 0 24 24">
      <path d="M12 2a2 2 0 00-2 2v1H8a3 3 0 00-3 3v9a3 3 0 003 3h8a3 3 0 003-3V8a3 3 0 00-3-3h-2V4a2 2 0 00-2-2zm-3 9h2v2H9v-2zm6 0h2v2h-2v-2z"/>
    </svg>
  `;

  /* =========================
     RESET CHAT (핵심)
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
        <div>손 씻기 어떻게 해요</div>
        <div>감기 안 걸리는 방법</div>
        <div>횡단보도 안전하게 건너기</div>
      </div>

      <div class="guideBox">
        <div class="guideTitle">📘 이용 가이드</div>
        헬시키즈 AI 사용 방법과  
        영상, 놀이자료를 쉽게 찾을 수 있어요 😊
        <br><br>
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
     RESULT CARD
  ========================= */
  function addResultCard(r){

    const wrap = document.createElement("div");
    wrap.className = "msg ai";

    wrap.innerHTML = `
      <div class="robotIcon">${robotSVG}</div>

      <div class="resultCard">
        <div class="resultTitle">${r?.title || "제목 없음"}</div>
        <div class="resultSummary">${r?.summary || "내용 없음"}</div>

        <a class="resultBtn" href="${r?.url || "#"}" target="_blank">
          👉 보러가기
        </a>
      </div>
    `;

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
      <div class="bubble">자료를 찾고 있어요 😊</div>
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

      addMessage("ai", data.reply || "결과를 찾았어요 😊");

      if(!data.results?.length){
        addMessage("ai", "관련 자료가 없어요 😢");
        return;
      }

      data.results.forEach(addResultCard);

    } catch(e){

      console.log(e);

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

  /* 열기 = 초기화 */
  document.getElementById("toggleBtn").onclick = () => {
    chatApp.style.display = "flex";
    resetChat();
  };

  /* ✕ 닫기 = 초기화 */
  document.getElementById("closeBtn").onclick = () => {
    chatApp.style.display = "none";
    resetChat();
  };

});
