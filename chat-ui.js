document.addEventListener("DOMContentLoaded", () => {

  const style = document.createElement("style");

  style.textContent = `
  #chat{
    position:fixed;
    bottom:90px;
    right:20px;
    width:380px;
    height:600px;
    background:#fff;
    border-radius:15px;
    box-shadow:0 10px 30px rgba(0,0,0,0.2);
    display:flex;
    flex-direction:column;
    overflow:hidden;
    z-index:9999;
  }

  #body{
    flex:1;
    padding:10px;
    overflow-y:auto;
    background:#f6f7fb;
  }

  .msg{
    padding:10px;
    margin:6px;
    border-radius:10px;
  }

  .user{background:#2f63c7;color:#fff;margin-left:auto;}
  .ai{background:#fff;border:1px solid #ddd;}

  #input{
    display:flex;
    padding:10px;
    border-top:1px solid #ddd;
  }

  input{flex:1;padding:10px;}
  button{margin-left:5px;}

  #toggle{
    position:fixed;
    bottom:20px;
    right:20px;
    width:60px;
    height:60px;
    border-radius:50%;
    background:#2f63c7;
    color:white;
    border:none;
  }

  .guide{
    padding:10px;
    background:#eef3ff;
    margin:8px;
    border-radius:10px;
  }
  `;

  document.head.appendChild(style);

  document.body.innerHTML += `
    <div id="chat">
      <div id="body"></div>

      <div id="input">
        <input id="text" placeholder="검색 입력 / 파일 업로드">
        <button id="send">전송</button>
        <input type="file" id="file">
      </div>
    </div>

    <button id="toggle">💬</button>
  `;

  const body = document.getElementById("body");

  /* GUIDE */
  body.innerHTML += `
    <div class="guide">
      🔎 검색 방법<br>
      1. 질문 입력<br>
      2. 파일 업로드 가능<br>
      3. 자동 의미 검색
    </div>

    <div class="guide">
      📌 가이드
      <button onclick="window.open('/guide.html')">이동</button>
    </div>
  `;

  function add(text, type) {
    const div = document.createElement("div");
    div.className = `msg ${type}`;
    div.innerText = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  /* CHAT */
  async function send() {
    const text = document.getElementById("text").value;

    add(text, "user");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();

    add(data.reply, "ai");
  }

  /* UPLOAD (REALTIME) */
  document.getElementById("file").addEventListener("change", async (e) => {
    const file = e.target.files[0];

    const reader = new FileReader();

    reader.onload = async () => {
      await fetch("/api/upload", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          name: file.name,
          content: reader.result.split(",")[1]
        })
      });

      add("📁 파일 업로드 완료 + 즉시 반영됨", "ai");
    };

    reader.readAsDataURL(file);
  });

  document.getElementById("send").onclick = send;

  document.getElementById("toggle").onclick = () => {
    document.getElementById("chat").classList.toggle("hidden");
  };
});
