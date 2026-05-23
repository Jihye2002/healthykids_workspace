document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     STYLE
  ========================= */
  const style = document.createElement("style");

  style.textContent = `
  #chatApp{
    position:fixed;
    bottom:90px;
    right:20px;
    width:380px;
    height:600px;
    background:#ffffff;
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
    color:white;
    padding:14px;
    font-weight:bold;
    display:flex;
    justify-content:space-between;
    align-items:center;
  }

  #chatBody{
    flex:1;
    padding:14px;
    overflow-y:auto;
    background:#f6f7fb;
  }

  .msg{
    max-width:90%;
    padding:10px 12px;
    margin:8px 0;
    border-radius:12px;
    font-size:14px;
    white-space:pre-wrap;
  }

  .user{
    background:#2f63c7;
    color:white;
    margin-left:auto;
  }

  .ai{
    background:#ffffff;
    border:1px solid #ddd;
  }

  .card{
    background:#fff;
    border:1px solid #e5e5e5;
    padding:10px;
    border-radius:12px;
    margin-top:8px;
  }

  .card-title{
    font-weight:bold;
    margin-bottom:6px;
  }

  .card-summary{
    font-size:13px;
    color:#555;
    margin-bottom:8px;
  }

  .card-btn{
    display:inline-block;
    padding:6px 10px;
    background:#2f63c7;
    color:white;
    border-radius:8px;
    text-decoration:none;
    font-size:12px;
  }

  #inputBox{
    display:flex;
    gap:6px;
    padding:10px;
    border-top:1px solid #ddd;
    background:#fff;
  }

  #text{
    flex:1;
    padding:10px;
    border-radius:10px;
    border:1px solid #ddd;
    outline:none;
  }

  #send{
    padding:10px 14px;
    border:none;
    border-radius:10px;
    background:#2f63c7;
    color:white;
    cursor:pointer;
  }

  #uploadBtn{
    width:38px;
    height:38px;
    border-radius:50%;
    background:#2f63c7;
    color:white;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    font-size:18px;
  }

  #file{
    display:none;
  }

  #toggleBtn{
    position:fixed;
    bottom:20px;
    right:20px;
    width:60px;
    height:60px;
    border-radius:50%;
    background:#2f63c7;
    color:white;
    border:none;
    font-size:22px;
    cursor:pointer;
  }

  .hidden{ display:none !important; }
  `;

  document.head.appendChild(style);

  /* =========================
     UI
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatApp">
      <div id="chatHeader">
        AI 검색 엔진
        <span id="closeBtn" style="cursor:pointer;">✕</span>
      </div>

      <div id="chatBody"></div>

      <div id="inputBox">
        <input id="text" placeholder="질문을 입력하세요 (의미 기반 검색)">
        <label id="uploadBtn" for="file">＋</label>
        <input type="file" id="file">
        <button id="send">검색</button>
      </div>
    </div>

    <button id="toggleBtn">💬</button>
  `);

  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  /* =========================
     RESET
  ========================= */
  function resetChat() {
    body.innerHTML = "";

    addMessage("ai",
🔎 AI 챗봇 사용방법

    예시) 감기에 걸리면 어떡하지?
          손씻기 자료 좀 찾아줘
          몸이 튼튼해지는 음식은 뭐가 있을까?
  }

  /* =========================
     MESSAGE
  ========================= */
  function addMessage(type, text) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     RESULT CARD (핵심)
  ========================= */
  function addCard(r) {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
      <div class="card-title">${r.title || "결과"}</div>
      <div class="card-summary">${r.summary || r.text || ""}</div>
      <a class="card-btn" href="${r.url}" target="_blank">
        이동
      </a>
    `;

    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     SEND
  ========================= */
  async function send() {
    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";

    addMessage("ai", "🔍 검색 중...");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();

      body.lastChild.remove(); // "검색 중..." 제거

      addMessage("ai", data.reply || "결과 없음");

      if (data.results?.length) {
        data.results.forEach(addCard);
      }

    } catch (e) {
      addMessage("ai", "서버 오류");
    }
  }

  /* =========================
     FILE UPLOAD
  ========================= */
  document.getElementById("file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      addMessage("user", "📁 파일 업로드");

      await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          content: reader.result.split(",")[1]
        })
      });

      addMessage("ai", "📄 파일이 즉시 검색에 반영되었습니다");
    };

    reader.readAsDataURL(file);
  });

  /* =========================
     EVENTS
  ========================= */
  document.getElementById("send").onclick = send;

  document.getElementById("toggleBtn").onclick = () => {
    chatApp.style.display = "flex";
    resetChat();
  };

  document.getElementById("closeBtn").onclick = () => {
    chatApp.style.display = "none";
    body.innerHTML = "";
  };

});
