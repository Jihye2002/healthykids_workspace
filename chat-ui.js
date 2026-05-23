document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  /* =========================
     STYLE
  ========================= */
  document.head.insertAdjacentHTML("beforeend", `
  <style>

    /* =========================
       CHAT WINDOW
    ========================= */
    #chatApp{
      position:fixed;
      bottom:110px;
      right:20px;
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

    /* HEADER */
    #chatHeader{
      background:#2f63c7;
      color:#fff;
      padding:14px;
      font-weight:bold;
      display:flex;
      justify-content:space-between;
      align-items:center;
    }

    /* BODY */
    #chatBody{
      flex:1;
      padding:14px;
      overflow-y:auto;
      display:flex;
      flex-direction:column;
      gap:10px;
    }

    /* =========================
       MESSAGE RESET (말풍선 제거)
    ========================= */
    .msg{
      max-width:100%;
      display:flex;
      align-items:flex-start;
      gap:10px;
      font-size:14px;
      line-height:1.5;
    }

    /* USER */
    .user{
      justify-content:flex-end;
      text-align:right;
      color:#333;
    }

    .user .bubble{
      background:#2f63c7;
      color:#fff;
      padding:10px 14px;
      border-radius:14px;
      max-width:75%;
    }

    /* AI (로봇 스타일) */
    .ai{
      justify-content:flex-start;
    }

    /* 로봇 아이콘 */
    .robot{
      width:36px;
      height:36px;
      min-width:36px;
      border-radius:50%;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#fff;
      font-size:18px;
      box-shadow:0 4px 10px rgba(0,0,0,0.15);
    }

    /* AI 말 */
    .ai .bubble{
      background:#fff;
      border:1px solid #ddd;
      padding:10px 14px;
      border-radius:14px;
      max-width:75%;
    }

    /* GUIDE */
    .guide{
      background:#eef5ff;
      padding:12px;
      border-radius:12px;
      font-size:13px;
      line-height:1.5;
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
      outline:none;
    }

    #voiceBtn{
      width:42px;
      height:42px;
      border-radius:50%;
      background:#444;
      color:#fff;
      border:none;
      cursor:pointer;
    }

    #voiceBtn.recording{
      background:#e74c3c;
    }

    #send{
      width:70px;
      background:#2f63c7;
      color:#fff;
      border:none;
      border-radius:10px;
      cursor:pointer;
    }

    /* =========================
       🔵 완전 원형 챗봇 버튼
    ========================= */
    #toggleBtn{
      position:fixed;
      bottom:25px;
      right:25px;
      width:70px;
      height:70px;
      border-radius:50%;
      background:#2f63c7;
      color:#fff;
      border:none;
      font-size:28px;
      cursor:pointer;
      z-index:10000;
      box-shadow:0 12px 30px rgba(0,0,0,0.25);
      display:flex;
      align-items:center;
      justify-content:center;
    }

    #toggleBtn:hover{
      transform:scale(1.05);
      transition:0.2s;
    }

  </style>
  `);

  /* =========================
     UI
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
  <div id="chatApp">

    <div id="chatHeader">
      🤖 헬시키즈 AI
      <span id="closeBtn" style="cursor:pointer;">✕</span>
    </div>

    <div id="chatBody"></div>

    <div id="inputBox">
      <textarea id="text" placeholder="궁금한 걸 물어보세요 😊"></textarea>
      <button id="voiceBtn">🎙</button>
      <button id="send">검색</button>
    </div>
  </div>

  <!-- 🔵 원형 버튼 -->
  <button id="toggleBtn">🤖</button>
  `);

  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  /* =========================
     GUIDE
  ========================= */
  function showGuide(){
    body.innerHTML = "";

    body.innerHTML = `
      <div class="guide">
        🌼 <b>헬시키즈 사용 방법</b><br><br>
        ★ 안전, 건강, 생활습관을 쉽게 알려줘요<br>
        ★ 영상과 자료도 함께 볼 수 있어요 😊
      </div>

      <div class="guide">
        💡 <b>이렇게 물어보면 좋아요</b><br>
        “손 씻는 방법 알려줘”<br>
        “감기 안 걸리는 방법”<br>
        “횡단보도 안전하게 건너기”
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
        <div class="robot">🤖</div>
        <div class="bubble">${text}</div>
      `;
    } else {
      wrap.innerHTML = `
        <div class="bubble">${text}</div>
      `;
    }

    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     CARD
  ========================= */
  function addCard(r){
    const d = document.createElement("div");
    d.className = "msg ai";

    d.innerHTML = `
      <div class="robot">🤖</div>
      <div class="bubble">
        <b>${r.title}</b><br>
        ${r.summary || ""}<br><br>
        <a href="${r.url}" target="_blank"
          style="padding:6px 10px;background:#2f63c7;color:#fff;border-radius:8px;text-decoration:none;">
          👉 보러가기
        </a>
      </div>
    `;

    body.appendChild(d);
  }

  /* =========================
     SEND
  ========================= */
  async function send(){

    const text = input.value.trim();
    if(!text) return;

    addMsg("user", text);
    input.value = "";

    addMsg("ai", "검색 중... 🤖");

    try{
      const res = await fetch(`${API_BASE}/api/chat`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ message:text })
      });

      const data = await res.json();

      body.lastChild.remove();

      addMsg("ai", data.reply || "결과를 찾았어요 😊");

      (data.results || []).forEach(addCard);

    }catch(e){
      body.lastChild.remove();
      addMsg("ai", "서버 연결 문제가 있어요 😢");
    }
  }

  /* =========================
     EVENTS
  ========================= */
  document.getElementById("send").onclick = send;

  /* =========================
     VOICE
  ========================= */
  let rec;
  let listening = false;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if(SR){
    rec = new SR();
    rec.lang = "ko-KR";
    rec.interimResults = true;

    rec.onresult = (e)=>{
      let t="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        t += e.results[i][0].transcript;
      }
      input.value = t;
    };

    rec.onend = ()=>{
      listening = false;
      document.getElementById("voiceBtn").classList.remove("recording");
      if(input.value.trim()) send();
    };
  }

  document.getElementById("voiceBtn").onclick = ()=>{
    if(!rec) return;

    if(listening){
      rec.stop();
      listening = false;
      return;
    }

    rec.start();
    listening = true;
    document.getElementById("voiceBtn").classList.add("recording");
  };

  /* =========================
     OPEN / CLOSE
  ========================= */
  document.getElementById("toggleBtn").onclick = ()=>{
    document.getElementById("chatApp").style.display = "flex";
    showGuide();
  };

  document.getElementById("closeBtn").onclick = ()=>{
    document.getElementById("chatApp").style.display = "none";
    body.innerHTML = "";
  };

});
