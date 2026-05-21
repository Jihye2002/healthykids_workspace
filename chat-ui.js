// chat-ui.js

document.addEventListener("DOMContentLoaded", () => {

  const chatbox = document.getElementById("chatbox");
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const body = document.getElementById("chat-body");

  let isLoading = false;

  // ========================
  // 메시지 출력 함수
  // ========================
  function appendMessage(type, text, options = {}) {

    const msg = document.createElement("div");
    msg.className = `message ${type}-msg`;

    const textDiv = document.createElement("div");
    textDiv.innerHTML = text;
    msg.appendChild(textDiv);

    // related buttons
    if (options.related?.length) {
      const wrap = document.createElement("div");
      wrap.className = "related-wrapper";

      options.related.forEach(r => {
        const btn = document.createElement("button");
        btn.className = "related-btn";
        btn.innerText = r;

        btn.onclick = () => {
          input.value = r;
          handleSend();
        };

        wrap.appendChild(btn);
      });

      msg.appendChild(wrap);
    }

    // menus
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

  // ========================
  // 로딩
  // ========================
  function showLoading() {
    const loading = document.createElement("div");
    loading.className = "loading";
    loading.id = "loading";
    loading.innerHTML = `<span></span><span></span><span></span>`;
    body.appendChild(loading);
  }

  function removeLoading() {
    document.getElementById("loading")?.remove();
  }

  // ========================
  // 메시지 전송
  // ========================
  async function handleSend() {

    if (isLoading) return;

    const text = input.value.trim();
    if (!text) return;

    if (text.length > 100) {
      appendMessage("ai", "100자 이하로 입력해주세요 😊");
      return;
    }

    isLoading = true;

    appendMessage("user", text);
    input.value = "";

    showLoading();

    const result = await ChatAPI.sendMessage(text);

    removeLoading();

    appendMessage("ai", result.reply, {
      related: result.related,
      menus: result.menus
    });

    isLoading = false;
  }

  // ========================
  // 이벤트
  // ========================
  sendBtn.addEventListener("click", handleSend);

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  });

  // 챗봇 토글 (있을 경우)
  document.getElementById("chat-toggle-button")?.addEventListener("click", () => {
    chatbox.classList.toggle("chatbox-hidden");
  });

});
