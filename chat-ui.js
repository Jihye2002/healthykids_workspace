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
      background:#f6f7fb;
      border-radius:18px;
      box-shadow:0 20px 50px rgba(0,0,0,0.2);
      display:none;
      flex-direction:column;
      overflow:hidden;
      z-index:9999;
      font-family:Arial;
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
    }

    /* =========================
       GUIDE BOX
    ========================= */
    .guideBox{
      background:#fff;
      border-radius:14px;
      padding:14px;
      border:1px solid #e5e5e5;
    }

    .guideTitle{
      font-weight:bold;
      color:#2f63c7;
      margin-bottom:8px;
    }

    .guideBtn{
      margin-top:10px;
      display:inline-block;
      padding:6px 10px;
      background:#2f63c7;
      color:#fff;
      border-radius:8px;
      font-size:13px;
      text-decoration:none;
    }

    /* =========================
       MESSAGE
    ========================= */
    .msg{
      display:flex;
      gap:10px;
      font-size:14px;
      line-height:1.5;
    }

    .user{
      justify-content:flex-end;
    }

    .user .bubble{
      background:#2f63c7;
      color:#fff;
      padding:10px 14px;
      border-radius:14px;
      max-width:70%;
    }

    .ai .bubble{
      background:#fff;
      border:1px solid #ddd;
      padding:10px 14px;
      border-radius:14px;
      max-width:70%;
    }

    /* =========================
       ROBOT ICON (SVG)
    ========================= */
    .robotIcon{
      width:34px;
      height:34px;
      min-width:34px;
      border-radius:50%;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 4px 10px rgba(0,0,0,0.15);
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
    }

    #text{
      flex:1;
      height:42px;
      border-radius:10px;
      border:1px solid #ddd;
      padding:10px;
    }

    #send{
      width:70px;
      background:#2f63c7;
      color:#fff;
      border:none;
      border-radius:10px;
    }

    /* =========================
       TOGGLE BUTTON (ROBOT)
    ========================= */
    #toggleBtn{
      position:fixed;
      bottom:25px;
      right:25px;
      width:70px;
      height:70px;
      border-radius:50%;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      border:none;
      cursor:pointer;
      box-shadow:0 12px 30px rgba(0,0,0,0.25);
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
      <input id="text" placeholder="궁금한 걸 물어보세요 😊" />
      <button id="send">검색</button>
    </div>

  </div>

  <!-- ROBOT BUTTON (SVG) -->
  <button id="toggleBtn">
    <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
      <path d="M12 2a2 2 0 00-2 2v1H7a3 3 0 00-3 3v9a3 3 0 003 3h10a3 3 0 003-3V8a3 3 0 00-3-3h-3V4a2 2 0 00-2-2zm-4 9h2v2H8v-2zm6 0h2v2h-2v-2z"/>
    </svg>
  </button>
  `);

  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  /* =========================
     GUIDE (2 BOX)
  ========================= */
  function showGuide(){

    body.innerHTML = "";

    body.innerHTML = `
      <div class="guideBox">
        <div class="guideTitle">💡 AI 사용 예시</div>
        <div>• 손 씻는 방법 알려줘</div>
        <div>• 감기 예방 방법</div>
        <div>• 횡단보도 안전하게 건너기</div>
      </div>

      <div class="guideBox">
        <div class="guideTitle">📘 헬시키즈 이용 가이드</div>
        <div>홈페이지의 영상, 자료, 안전수칙을 쉽게 배울 수 있어요.</div>
        <a class="guideBtn" href="guide.html">가이드 보기</a>
      </div>
    `;
  }

  /* =========================
     MESSAGE
  ========================= */
  function addMsg(type, text){

    const wrap = document.createElement("div");
    wrap.className = `msg ${type}`;

    if(type === "ai"){
      wrap.innerHTML = `
        <div class="robotIcon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2a2 2 0 00-2 2v1H7a3 3 0 00-3 3v9a3 3 0 003 3h10a3 3 0 003-3V8a3 3 0 00-3-3h-3V4a2 2 0 00-2-2z"/>
          </svg>
        </div>
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

    addMsg("user", text);
    input.value = "";

    addMsg("ai", "조금만 기다려주세요 😊");

    try{

      const res = await fetch(`${API_BASE}/api/chat`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ message:text })
      });

      const data = await res.json();

      body.lastChild.remove();

      addMsg("ai", data.reply || "찾은 내용이 없어요 😢");

      if(!data.results || data.results.length === 0){
        addMsg("ai", "이 내용은 아직 자료에 없어요.");
        return;
      }

      data.results.forEach(r=>{
        const d = document.createElement("div");
        d.className = "msg ai";
        d.innerHTML = `
          <div class="robotIcon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a2 2 0 00-2 2v1H7a3 3 0 00-3 3v9a3 3 0 003 3h10a3 3 0 003-3V8a3 3 0 00-3-3h-3V4a2 2 0 00-2-2z"/>
            </svg>
          </div>
          <div class="bubble">
            <b>${r.title}</b><br>
            ${r.summary}<br><br>
            <a href="${r.url}" target="_blank">👉 보러가기</a>
          </div>
        `;
        body.appendChild(d);
      });

    }catch(e){
      body.lastChild.remove();
      addMsg("ai", "서버 연결이 안 돼요 😢");
    }
  }

  /* EVENTS */
  document.getElementById("send").onclick = send;

  document.getElementById("toggleBtn").onclick = ()=>{
    document.getElementById("chatApp").style.display = "flex";
    showGuide();
  };

  document.getElementById("closeBtn").onclick = ()=>{
    document.getElementById("chatApp").style.display = "none";
    body.innerHTML = "";
  };

});
