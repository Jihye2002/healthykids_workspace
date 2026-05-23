document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  /* =========================
     STYLE
  ========================= */
  const style = document.createElement("style");

  style.textContent = `
  #chatApp{
    position:fixed;
    bottom:90px;
    right:20px;
    width:430px;
    height:680px;
    background:#fff;
    border-radius:18px;
    box-shadow:0 20px 50px rgba(0,0,0,0.2);
    display:none;
    flex-direction:column;
    overflow:hidden;
    font-family:Arial;
    z-index:9999;
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
    padding:10px 12px;
    margin:8px 0;
    border-radius:12px;
    font-size:14px;
    white-space:pre-wrap;
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

  /* GUIDE */
  .guideBox, .guideBox2{
    background:#eef3ff;
    padding:12px;
    border-radius:12px;
    margin-bottom:10px;
    font-size:13px;
    line-height:1.5;
  }

  .guideBox2{
    background:#e7f0ff;
  }

  .guideBtn{
    display:inline-block;
    margin-top:8px;
    padding:7px 12px;
    background:#2f63c7;
    color:#fff;
    border-radius:8px;
    text-decoration:none;
    font-size:12px;
  }

  /* INPUT */
  #inputBox{
    display:flex;
    align-items:center;
    gap:8px;
    padding:10px;
    border-top:1px solid #ddd;
    background:#fff;
  }

  #uploadBtn{
    width:42px;
    height:42px;
    border-radius:50%;
    background:#2f63c7;
    color:#fff;
    display:flex;
    justify-content:center;
    align-items:center;
    font-size:20px;
    cursor:pointer;
  }

  #file{ display:none; }

  #text{
    flex:1;
    height:42px;
    padding:10px;
    border-radius:10px;
    border:1px solid #ddd;
    outline:none;
  }

  #send{
    width:70px;
    height:42px;
    background:#2f63c7;
    color:#fff;
    border:none;
    border-radius:10px;
    cursor:pointer;
  }

  #voiceBtn{
    width:42px;
    height:42px;
    border-radius:50%;
    background:#ffcc00;
    border:none;
    cursor:pointer;
    font-weight:bold;
  }

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
    font-size:22px;
  }
  `;

  document.head.appendChild(style);

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
        <label id="uploadBtn">＋
          <input type="file" id="file">
        </label>

        <textarea id="text" placeholder="궁금한 내용을 물어보세요"></textarea>

        <button id="voiceBtn">🎤</button>
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
  function resetChat() {
    body.innerHTML = "";

    const box1 = document.createElement("div");
    box1.className = "guideBox";
    box1.innerHTML = `
      🔎 <b>헬시키즈 챗봇 사용 방법</b><br><br>
      - 궁금한 내용을 입력하면 쉽게 설명해줘요<br>
      - 건강·안전 정보를 알려줘요<br>
      - 홈페이지 자료를 함께 찾아요
    `;

    const box2 = document.createElement("div");
    box2.className = "guideBox2";
    box2.innerHTML = `
      📘 <b>헬시키즈 전체 가이드</b><br><br>
      헬시키즈는 아이들이 건강하고 안전하게 생활할 수 있도록 도와주는 서비스예요.<br>
      손씻기, 위생, 안전, 생활 습관을 쉽게 배울 수 있어요.<br><br>

      아래 버튼을 누르면 전체 가이드로 이동해요.<br>
      <a class="guideBtn" href="guide.html">헬시키즈 가이드 보기</a>
    `;

    body.appendChild(box1);
    body.appendChild(box2);
  }

  /* =========================
     MESSAGE
  ========================= */
  function addMessage(type, text){
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    body.appendChild(div);
  }

  /* =========================
     CARD
  ========================= */
  function addCard(r){
    const div = document.createElement("div");
    div.className = "msg ai";

    div.innerHTML = `
      <b>${r.title || "결과"}</b><br>
      ${r.summary || ""}<br><br>
      <a href="${r.url}" target="_blank"
        style="padding:6px 10px;background:#2f63c7;color:#fff;border-radius:8px;text-decoration:none;">
        이동
      </a>
    `;

    body.appendChild(div);
  }

  /* =========================
     SEND
  ========================= */
  async function send(){
    const text = input.value.trim();
    if(!text) return;

    addMessage("user", text);
    input.value = "";

    addMessage("ai", "🔍 검색 중...");

    const res = await fetch(`${API_BASE}/api/chat`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ message:text })
    });

    const data = await res.json();

    body.lastChild.remove();

    addMessage("ai", data.reply || "결과 없음");

    (data.results || []).forEach(addCard);
  }

  /* =========================
     ENTER
  ========================= */
  input.addEventListener("keydown", (e)=>{
    if(e.key==="Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  /* =========================
     VOICE (FIXED GPT STYLE)
  ========================= */
  let recognition = null;
  let isListening = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if(SpeechRecognition){
    recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;
  }

  const voiceBtn = document.getElementById("voiceBtn");

  voiceBtn.onclick = () => {
    if(!recognition) return;

    if(isListening){
      recognition.stop();
      return;
    }

    try{
      recognition.start();
      isListening = true;
      voiceBtn.innerText = "🎤 듣는 중...";
      voiceBtn.style.background = "#ff4d4d";
    }catch(e){
      console.log(e);
    }
  };

  recognition.onresult = (e)=>{
    let text = "";
    for(let i=e.resultIndex;i<e.results.length;i++){
      text += e.results[i][0].transcript;
    }
    input.value = text;
  };

  recognition.onend = ()=>{
    isListening = false;
    voiceBtn.innerText = "🎤";
    voiceBtn.style.background = "#ffcc00";

    if(input.value.trim().length>0){
      send(); // 자동 검색
    }
  };

  recognition.onerror = ()=>{
    isListening = false;
    voiceBtn.innerText = "🎤";
    voiceBtn.style.background = "#ffcc00";
  };

  /* =========================
     FILE UPLOAD
  ========================= */
  document.getElementById("file").addEventListener("change", async (e)=>{
    const file = e.target.files[0];
    if(!file) return;

    const reader = new FileReader();

    reader.onload = async ()=>{
      await fetch(`${API_BASE}/api/upload`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          name:file.name,
          content:reader.result.split(",")[1]
        })
      });

      addMessage("ai","📄 문서가 추가되었어요");
    };

    reader.readAsDataURL(file);
  });

  /* =========================
     EVENTS
  ========================= */
  document.getElementById("send").onclick = send;

  document.getElementById("toggleBtn").onclick = ()=>{
    document.getElementById("chatApp").style.display="flex";
    resetChat();
  };

  document.getElementById("closeBtn").onclick = ()=>{
    document.getElementById("chatApp").style.display="none";
    body.innerHTML="";
  };

});
