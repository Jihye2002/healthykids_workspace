document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://YOUR-RENDER-URL.onrender.com";

  /* =========================
     STYLE (GPT STYLE)
  ========================= */
  const style = document.createElement("style");

  style.textContent = `
  #chatApp{
    position:fixed;
    bottom:90px;
    right:20px;
    width:420px;
    height:650px;
    background:#ffffff;
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
    background:#fff;
    border:1px solid #ddd;
  }

  /* ================= GPT INPUT BAR ================= */
  #inputBox{
    display:flex;
    align-items:center;
    gap:8px;
    padding:10px;
    border-top:1px solid #ddd;
    background:#fff;
  }

  #uploadBtn{
    width:40px;
    height:40px;
    border-radius:10px;
    background:#2f63c7;
    color:white;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    font-size:18px;
  }

  #file{ display:none; }

  #text{
    flex:1;
    height:40px;
    resize:none;
    padding:10px;
    border-radius:10px;
    border:1px solid #ddd;
    outline:none;
    font-size:14px;
  }

  #send{
    width:70px;
    height:40px;
    border:none;
    border-radius:10px;
    background:#2f63c7;
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
    background:#2f63c7;
    color:white;
    border:none;
    font-size:22px;
    cursor:pointer;
  }

  .guideBox{
    background:#eef3ff;
    padding:10px;
    border-radius:10px;
    margin-bottom:10px;
    font-size:13px;
  }

  .guideBtn{
    display:inline-block;
    margin-top:6px;
    padding:6px 10px;
    background:#2f63c7;
    color:white;
    border-radius:8px;
    text-decoration:none;
    font-size:12px;
  }
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
        <label id="uploadBtn" for="file">＋</label>
        <input type="file" id="file">

        <textarea id="text" placeholder="검색어 입력 (Enter=전송 / Shift+Enter=줄바꿈)"></textarea>

        <button id="send">검색</button>
      </div>
    </div>

    <button id="toggleBtn">💬</button>
  `);

  const chatApp = document.getElementById("chatApp");
  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  /* =========================
     RESET + GUIDE
  ========================= */
  function resetChat() {
    body.innerHTML = "";

    const guide = document.createElement("div");
    guide.className = "guideBox";
    guide.innerHTML = `
      🔎 AI 검색 사용법<br><br>
      1. 질문 입력 → 의미 기반 검색<br>
      2. 파일 업로드 → 자동 반영<br>
      3. 결과 클릭 → 원본 페이지 이동<br><br>

      💡 예시:<br>
      - 감기 예방 방법 알려줘<br>
      - 손씻기 관련 자료 찾아줘<br>
      - 건강한 음식 추천해줘<br><br>

      📌 가이드를 더 자세히 보려면 아래 버튼 클릭
      <br>
      <a class="guideBtn" href="guide.html">가이드 보기</a>
    `;

    body.appendChild(guide);
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
     CARD
  ========================= */
  function addCard(r) {
    const div = document.createElement("div");
    div.className = "msg ai";

    div.innerHTML = `
      <b>${r.title || "결과"}</b><br>
      ${r.summary || ""}<br><br>
      <a href="${r.url}" target="_blank" style="
        display:inline-block;
        padding:6px 10px;
        background:#2f63c7;
        color:#fff;
        border-radius:8px;
        text-decoration:none;
        font-size:12px;
      ">이동</a>
    `;

    body.appendChild(div);
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
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();

      body.lastChild.remove();

      addMessage("ai", data.reply || "결과 없음");

      if (Array.isArray(data.results)) {
        data.results.forEach(addCard);
      }

    } catch (e) {
      body.lastChild?.remove();
      addMessage("ai", "❌ 서버 연결 실패");
    }
  }

  /* =========================
     ENTER / SHIFT+ENTER
  ========================= */
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  /* =========================
     FILE UPLOAD
  ========================= */
  document.getElementById("file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      addMessage("user", "📁 파일 업로드");

      await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          content: reader.result.split(",")[1]
        })
      });

      addMessage("ai", "📄 즉시 검색 반영 완료");
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
