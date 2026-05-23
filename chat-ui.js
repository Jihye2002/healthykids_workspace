document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     STYLE (GPT / GEMINI UI)
  ========================= */
  const style = document.createElement("style");

  style.textContent = `
  #chatApp{
    position:fixed;
    bottom:90px;
    right:20px;
    width:380px;
    height:600px;
    background:#0f172a;
    border-radius:18px;
    box-shadow:0 20px 50px rgba(0,0,0,0.4);
    display:none;
    flex-direction:column;
    overflow:hidden;
    z-index:9999;
    font-family:Arial;
  }

  #chatHeader{
    background:#111827;
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
    background:#0b1220;
  }

  .msg{
    max-width:85%;
    padding:10px 12px;
    margin:8px 0;
    border-radius:12px;
    font-size:14px;
    line-height:1.4;
    white-space:pre-wrap;
  }

  .user{
    background:#2563eb;
    color:white;
    margin-left:auto;
  }

  .ai{
    background:#1f2937;
    color:#e5e7eb;
    border:1px solid #374151;
  }

  #inputBox{
    display:flex;
    gap:6px;
    padding:10px;
    background:#111827;
    border-top:1px solid #1f2937;
  }

  #text{
    flex:1;
    padding:10px;
    border-radius:10px;
    border:none;
    outline:none;
    background:#0b1220;
    color:white;
  }

  #send{
    padding:10px 14px;
    border:none;
    border-radius:10px;
    background:#2563eb;
    color:white;
    cursor:pointer;
  }

  #file{
    display:none;
  }

  #uploadBtn{
    padding:10px 12px;
    border-radius:10px;
    background:#374151;
    color:white;
    cursor:pointer;
  }

  #toggleBtn{
    position:fixed;
    bottom:20px;
    right:20px;
    width:60px;
    height:60px;
    border-radius:50%;
    border:none;
    background:#2563eb;
    color:white;
    font-size:22px;
    cursor:pointer;
  }

  .guideBox{
    padding:10px;
    margin-bottom:10px;
    background:#111827;
    border-radius:10px;
    color:#cbd5e1;
    font-size:13px;
  }

  .hidden{
    display:none !important;
  }

  .typing{
    opacity:0.7;
    font-style:italic;
  }
  `;

  document.head.appendChild(style);

  /* =========================
     UI CREATE
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatApp">
      <div id="chatHeader">
        🧠 AI Search Assistant
        <span id="closeBtn" style="cursor:pointer;">✕</span>
      </div>

      <div id="chatBody"></div>

      <div id="inputBox">
        <input id="text" placeholder="검색 / 질문 / 파일 업로드">
        <button id="send">전송</button>
        <label id="uploadBtn" for="file">📁</label>
        <input type="file" id="file">
      </div>
    </div>

    <button id="toggleBtn">💬</button>
  `);

  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  /* =========================
     STATE RESET FUNCTION
  ========================= */
  function resetChat() {
    body.innerHTML = "";

    addMessage("ai",
`👋 안녕하세요!
검색 방법:
- 질문 입력
- 파일 업로드 가능
- 자동 의미 검색 실행`);

    addMessage("ai", "📌 가이드: /guide.html 에서 확인 가능");
  }

  /* =========================
     MESSAGE ADD
  ========================= */
  function addMessage(type, text) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     TYPING EFFECT (OPTION)
  ========================= */
  function showTyping() {
    const div = document.createElement("div");
    div.className = "msg ai typing";
    div.innerText = "AI가 검색 중...";
    div.id = "typing";
    body.appendChild(div);
  }

  function hideTyping() {
    document.getElementById("typing")?.remove();
  }

  /* =========================
     SEND MESSAGE
  ========================= */
  async function send() {
    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    input.value = "";

    showTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();

      hideTyping();

      addMessage("ai", data.reply || "결과 없음");

      if (data.results?.length) {
        data.results.forEach(r => {
          addMessage("ai", `📌 ${r.title}\n${r.text}`);
        });
      }

    } catch (e) {
      hideTyping();
      addMessage("ai", "서버 오류 발생");
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

      addMessage("ai", "📁 파일 업로드 완료 (즉시 검색 반영됨)");
    };

    reader.readAsDataURL(file);
  });

  /* =========================
     EVENTS
  ========================= */
  document.getElementById("send").onclick = send;

  document.getElementById("toggleBtn").onclick = () => {
    chatApp.style.display = "flex";
    resetChat();   // 🔥 열릴 때 초기화 + 가이드 표시
  };

  document.getElementById("closeBtn").onclick = () => {
    chatApp.style.display = "none";
    body.innerHTML = ""; // 🔥 닫으면 완전 초기화
  };

});
