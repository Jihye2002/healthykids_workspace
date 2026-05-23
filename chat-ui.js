document.addEventListener("DOMContentLoaded", () => {

  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatbox">
      <div id="body"></div>
      <input id="input">
      <button id="send">send</button>
    </div>
  `);

  const body = document.getElementById("body");

  function add(text) {
    const div = document.createElement("div");
    div.innerHTML = text;
    body.appendChild(div);
  }

  async function send() {
    const input = document.getElementById("input");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input.value })
    });

    const data = await res.json();

    add("🤖 " + data.reply);

    data.results.forEach(r => {
      add(`
        <div>
          <b>${r.title}</b><br/>
          <button onclick="window.open('${r.url}')">열기</button>
        </div>
      `);
    });
  }

  document.getElementById("send").onclick = send;
});
