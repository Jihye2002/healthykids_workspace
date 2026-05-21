let isLoading = false;
let lastRequestTime = 0;

/* =========================
   Chat UI Bootstrap
========================= */
document.addEventListener("DOMContentLoaded", function () {

  /* =========================
     기본 UI 생성
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatbox" class="chatbox-hidden">
      <div id="chat-header">🩺 헬시키즈 AI 도우미</div>

      <div id="chat-body">
        <div class="message ai-msg">
          안녕하세요 😊<br><br>
          궁금한 건강교육 정보를 물어보세요!<br><br>
          예시)<br>
          • 감기 예방 방법<br>
          • 손씻기 방법<br>
          • 안전 교육 자료
        </div>
      </div>

      <div class="input-area">
        <input id="user-input" type="text" placeholder="메시지를 입력하세요..." />
        <button id="send-btn">전송</button>
      </div>
    </div>

    <button id="chat-toggle-button">💬</button>
  `);

  const chatbox = document.getElementById("chatbox");
  const input = document.getElementById("user-input");
  const body = document.getElementById("chat-body");

  /* =========================
     메시지 출력
  ========================= */
  function appendMessage(sender, text, options = {}) {

    const msg = document.createElement("div");
    msg.className = `message ${sender}-msg`;

    const textDiv = document.createElement("div");
    textDiv.innerHTML = text;
    msg.appendChild(textDiv);

    /* =========================
       related buttons
    ========================= */
    if (options.related?.length) {
      const wrap = document.createElement("div");
      wrap.className = "related-wrapper";

      options.related.forEach(r => {
        const btn = document.createElement("button");
        btn.className = "related-btn";
        btn.innerText = r;

        btn.onclick = () => {
          input.value = r;
          sendMessage();
        };

        wrap.appendChild(btn);
      });

      msg.appendChild(wrap);
    }

    /* =========================
       menus (RAG 결과)
    ========================= */
    if (options.menus?.length) {
      options.menus.forEach(m => {

        const card = document.createElement("div");
        card.className = "menu-card";

        card.innerHTML = `
          <div class="menu-title">${m.title}</div>
          <div class="menu-desc">${m.description || ""}</div>
          <button class="menu-btn">바로가기</button>
        `;

        card.querySelector("button").onclick = () => {
          window.location.href = m.url;
        };

        msg.appendChild(card);
      });
    }

    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  /* =========================
     로딩 UI
  ========================= */
  function showLoading() {
    const loading = document.createElement("div");
    loading.className = "loading";
    loading.id = "loading";
    loading.innerHTML = `<span></span><span></span><span></span>`;
    body.appendChild(loading);
    body.scrollTop = body.scrollHeight;
  }

  function removeLoading() {
    document.getElementById("loading")?.remove();
  }

  /* =========================
     메시지 전송 (RAG CALL)
  ========================= */
  async function sendMessage() {

    if (isLoading) return;

    const now = Date.now();
    if (now - lastRequestTime < 1500) {
      appendMessage("ai", "조금만 기다려주세요 😊");
      return;
    }

    const text = input.value.trim();
    if (!text) return;

    if (text.length > 100) {
      appendMessage("ai", "100자 이하로 입력해주세요 😊");
      return;
    }

    isLoading = true;
    lastRequestTime = now;

    appendMessage("user", text);
    input.value = "";
    showLoading();

    try {

      /* =========================
         RAG SERVER CALL
      ========================= */
      const res = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: text
        })
      });

      const data = await res.json();

      removeLoading();

      if (!data || data.error) {
        appendMessage("ai", "응답을 불러오지 못했어요 😢");
        return;
      }

      /* =========================
         GUIDE 강제 우선 노출
      ========================= */
      let menus = data.menus || [];

      const guideIndex = menus.findIndex(m => m.type === "guide");

      if (guideIndex === -1 && data.guide) {
        menus.unshift(data.guide);
      }

      /* =========================
         출력
      ========================= */
      appendMessage("ai", data.reply || "결과가 없습니다.", {
        related: data.related || [],
        menus: menus
      });

    } catch (err) {
      console.error(err);
      removeLoading();
      appendMessage("ai", "서버 연결 오류가 발생했어요 😢");
    }

    isLoading = false;
  }

  /* =========================
     이벤트
  ========================= */
  document.getElementById("send-btn").onclick = sendMessage;

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("chat-toggle-button").onclick = () => {
    chatbox.classList.toggle("chatbox-hidden");
  };

});
