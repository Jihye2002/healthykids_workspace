document.addEventListener("DOMContentLoaded", () => {

  const style = document.createElement("style");

  style.textContent = `
  #box{
    position:fixed;
    bottom:90px;
    right:20px;
    width:380px;
    height:600px;
    background:white;
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

  .user{background:#2f63c7;color:white;margin-left:auto;}
  .ai{background:white;border:1px solid #ddd;}

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
    background:#eef3ff;
    padding:10px;
    margin:8px;
    border-radius:10px;
  }
  `;

  document.head.appendChild(style);

  document.body.innerHTML += `
  <div id="box">
    <div id="body"></div>

    <div id="input">
      <input id="text" placeholder="검색 / 파일 업로드 가능">
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
      🔎 AI 검색 방법<br>
      - 질문 입력<br>
      - 파일 업로드 가능<br>
      - 의미 기반 자동 검색
    </div>

    <div class="guide">
      📌 가이드 보기
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

  /* FILE UPLOAD REALTIME */
  document.getElementById("file").addEventListener("change", async (e) => {
    const file = e.target.files[0];

    const reader = new FileReader();

    reader.onload = async () => {

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          name: file.name,
          content: reader.result.split(",")[1]
        })
      });

      const data = await res.json();

      add("📁 파일 업로드 + 즉시 반영 완료", "ai");
    };

    reader.readAsDataURL(file);
  });

  document.getElementById("send").onclick = send;

  document.getElementById("toggle").onclick = () => {
    document.getElementById("box").classList.toggle("hidden");
  };
});
