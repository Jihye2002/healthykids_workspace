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
  }

  /* INPUT */
  #inputBox{
    display:flex;
    align-items:center;
    gap:8px;
    padding:10px;
    border-top:1px solid #ddd;
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

  /* 🎙️ 녹음 버튼 */
  #voiceBtn{
    width:42px;
    height:42px;
    border-radius:50%;
    background:#333;
    color:#fff;
    border:none;
    cursor:pointer;
    font-size:16px;
  }

  #voiceBtn.recording{
    background:#e53935;
    box-shadow:0 0 10px rgba(229,57,53,0.5);
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

        <textarea id="text" placeholder="궁금한 내용을 입력하세요"></textarea>

        <button id="voiceBtn">🎙</button>
        <button id="send">검색</button>
      </div>
    </div>

    <button id="toggleBtn">💬</button>
  `);

  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  function addMessage(type, text){
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

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

  async function send(){
    const text = input.value.trim();
    if(!text) return;

    addMessage("user", text);
    input.value = "";

    addMessage("ai", "🔍 검색 중...");

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ message:text })
      });

      const data = await res.json();

      body.lastChild.remove();

      addMessage("ai", data.reply || "결과 없음");

      (data.results || []).forEach(addCard);

    } catch (e) {
      body.lastChild.remove();
      addMessage("ai", "서버 연결 실패");
    }
  }

  document.getElementById("send").onclick = send;

  /* =========================
     VOICE (완전 수정)
  ========================= */
  let recognition = null;
  let isListening = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
  }

  const voiceBtn = document.getElementById("voiceBtn");

  voiceBtn.onclick = () => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      return;
    }

    try {
      recognition.start();
      isListening = true;
      voiceBtn.classList.add("recording");
      voiceBtn.innerText = "REC";
    } catch (e) {
      console.log(e);
    }
  };

  if (recognition) {
    recognition.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      input.value = text;
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.classList.remove("recording");
      voiceBtn.innerText = "🎙";

      if (input.value.trim()) send();
    };

    recognition.onerror = () => {
      isListening = false;
      voiceBtn.classList.remove("recording");
      voiceBtn.innerText = "🎙";
    };
  }

  document.getElementById("toggleBtn").onclick = () => {
    document.getElementById("chatApp").style.display = "flex";
    body.innerHTML = "";
  };

  document.getElementById("closeBtn").onclick = () => {
    document.getElementById("chatApp").style.display = "none";
    body.innerHTML = "";
  };

});
