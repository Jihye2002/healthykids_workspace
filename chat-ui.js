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
    }

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
      border:1px solid #ddd;
      max-width:78%;
    }

    .robotIcon{
      width:34px;
      height:34px;
      border-radius:50%;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      flex-shrink:0;
    }

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

    <button id="toggleBtn">🤖</button>
  `);

  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  /* =========================
     RESET CHAT (핵심 추가)
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
        헬시키즈 AI를 어떻게 쓰는지와  
        영상, 놀이자료를 쉽게 찾을 수 있어요 😊
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
        <div class="robotIcon">🤖</div>
        <div class="bubble">${text}</div>
      `;
    } else {
      wrap.innerHTML = `<div class="bubble">${text}</div>`;
    }

    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     RESULT CARD (undefined 방지)
  ========================= */
  function addResultCard(r){

    const title = r?.title || "제목 없음";
    const summary = r?.summary || "내용 없음";
    const url = r?.url || "#";

    const wrap = document.createElement("div");
    wrap.className = "msg ai";

    wrap.innerHTML = `
      <div class="robotIcon">🤖</div>
      <div class="resultCard">

        <div class="resultTitle">${title}</div>

        <div class="resultSummary">${summary}</div>

        <a class="resultBtn" href="${url}" target="_blank">
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

    const loading = document.createElement("div");
    loading.className = "msg ai";
    loading.innerHTML = `<div class="robotIcon">🤖</div><div class="bubble">자료를 찾고 있어요 😊</div>`;
    body.appendChild(loading);

    try{

      const res = await fetch(`${API_BASE}/api/chat`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();

      loading.remove();

      addMessage("ai", data.reply || "결과를 찾았어요 😊");

      if(!data.results?.length){
        addMessage("ai", "관련 자료가 없어요 😢");
        return;
      }

      data.results.forEach(addResultCard);

    } catch(e){

      console.log(e);
      loading.remove();
      addMessage("ai", "서버 오류가 발생했어요 😢");
    }
  }

  /* =========================
     EVENT
  ========================= */

  document.getElementById("send").onclick = send;

  input.addEventListener("keydown", (e)=>{
    if(e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  /* =========================
     OPEN (버튼 클릭 → 초기화)
  ========================= */
  document.getElementById("toggleBtn").onclick = () => {
    chatApp.style.display = "flex";
    resetChat();
  };

  /* =========================
     CLOSE (X → 닫기 + 초기화)
  ========================= */
  document.getElementById("closeBtn").onclick = () => {
    chatApp.style.display = "none";
    resetChat();
  };

});
