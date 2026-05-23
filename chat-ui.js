document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  /* =========================
     STYLE
  ========================= */
  document.head.insertAdjacentHTML("beforeend", `
  <style>
    #chatApp{
      position:fixed;
      bottom:90px;
      right:20px;
      width:420px;
      height:650px;
      background:#fff;
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
      font-weight:bold;
      display:flex;
      justify-content:space-between;
    }

    #chatBody{
      flex:1;
      padding:14px;
      overflow-y:auto;
      background:#f6f7fb;
    }

    .msg{
      max-width:92%;
      padding:10px;
      margin:8px 0;
      border-radius:12px;
      font-size:14px;
      line-height:1.4;
    }

    .user{
      background:#2f63c7;
      color:#fff;
      margin-left:auto;
    }

    .ai{
      background:#fff;
      border:1px solid #ddd;
    }

    .guide{
      background:#eef5ff;
      padding:12px;
      border-radius:12px;
      margin-bottom:10px;
      font-size:13px;
      line-height:1.5;
    }

    #inputBox{
      display:flex;
      gap:8px;
      padding:10px;
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
      font-size:16px;
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

    /* ⭐ 챗봇 버튼 (핵심 추가) */
    #toggleBtn{
      position:fixed;
      bottom:20px;
      right:20px;
      width:60px;
      height:60px;
      border-radius:50%;
      background:#2f63c7;
      color:#fff;
      border:none;
      font-size:24px;
      cursor:pointer;
      z-index:10000;
      box-shadow:0 10px 25px rgba(0,0,0,0.2);
    }
  </style>
  `);

  /* =========================
     UI
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
  <div id="chatApp">
    <div id="chatHeader">
      헬시키즈 AI <span id="closeBtn" style="cursor:pointer;">✕</span>
    </div>

    <div id="chatBody"></div>

    <div id="inputBox">
      <textarea id="text" placeholder="궁금한 걸 물어보세요 😊"></textarea>
      <button id="voiceBtn">🎙</button>
      <button id="send">검색</button>
    </div>
  </div>

  <button id="toggleBtn">💬</button>
  `);

  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  /* =========================
     GUIDE
  ========================= */
  function showGuide(){
    body.innerHTML = "";

    const g1 = document.createElement("div");
    g1.className = "guide";
    g1.innerHTML = `
      🌼 <b>헬시키즈 사용 방법</b><br><br>
      ★ 건강, 안전, 생활습관 정보를 배울 수 있어요<br>
      ★ 영상과 자료도 함께 볼 수 있어요 😊
    `;

    const g2 = document.createElement("div");
    g2.className = "guide";
    g2.innerHTML = `
      💡 <b>이렇게 물어보면 좋아요</b><br>
      “손 씻는 방법 알려줘”<br>
      “감기 안 걸리는 방법”<br>
      “횡단보도 안전하게 건너기”
    `;

    body.appendChild(g1);
    body.appendChild(g2);
  }

  /* =========================
     MESSAGE
  ========================= */
  function addMsg(type, text){
    const d = document.createElement("div");
    d.className = `msg ${type}`;
    d.innerText = text;
    body.appendChild(d);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     CARD
  ========================= */
  function addCard(r){
    const d = document.createElement("div");
    d.className = "msg ai";

    d.innerHTML = `
      <b>${r.title || "결과"}</b><br>
      ${r.summary || ""}<br><br>
      <a href="${r.url}" target="_blank"
        style="padding:6px 10px;background:#2f63c7;color:#fff;border-radius:8px;text-decoration:none;">
        👉 보러가기
      </a>
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

    addMsg("ai", "🔍 검색 중...");

    try{
      const res = await fetch(`${API_BASE}/api/chat`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ message:text })
      });

      const data = await res.json();

      body.lastChild.remove();

      addMsg("ai", data.reply || "검색 결과를 찾았어요 😊");

      (data.results || []).forEach(addCard);

    }catch(e){
      body.lastChild.remove();
      addMsg("ai", "서버 연결에 문제가 있어요 😢");
    }
  }

  /* =========================
     EVENTS
  ========================= */
  document.getElementById("send").onclick = send;

  /* =========================
     VOICE (안정 버전)
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
