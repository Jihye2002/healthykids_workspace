document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  document.head.insertAdjacentHTML("beforeend", `
  <style>

  #chatApp{
    position:fixed;
    bottom:110px;
    right:25px;
    width:420px;
    height:650px;
    background:#fff;
    border-radius:20px;
    box-shadow:0 15px 40px rgba(0,0,0,0.12);
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
    display:flex;
    justify-content:space-between;
    font-weight:600;
  }

  #chatBody{
    flex:1;
    padding:14px;
    overflow-y:auto;
    background:#f6f8ff;
    display:flex;
    flex-direction:column;
    gap:10px;
  }

  .msg{display:flex; gap:10px;}
  .user{justify-content:flex-end;}

  .bubble{
    padding:12px 14px;
    border-radius:16px;
    font-size:14px;
    line-height:1.5;
    max-width:75%;
  }

  .user .bubble{
    background:#2f63c7;
    color:#fff;
  }

  .ai .bubble{
    background:#fff;
    border:1px solid #e6e6e6;
  }

  .robotIcon{
    width:34px;
    height:34px;
    border-radius:50%;
    background:#2f63c7;
    display:flex;
    align-items:center;
    justify-content:center;
    color:white;
    font-weight:bold;
  }

  #inputBox{
    display:flex;
    padding:10px;
    background:#fff;
    border-top:1px solid #eee;
  }

  #text{
    flex:1;
    border:1px solid #ddd;
    border-radius:12px;
    padding:12px;
    resize:none;
  }

  #send{
    margin-left:8px;
    background:#2f63c7;
    color:white;
    border:none;
    border-radius:12px;
    width:80px;
  }

  #toggleBtn{
    position:fixed;
    bottom:25px;
    right:25px;
    width:70px;
    height:70px;
    border-radius:50%;
    background:#2f63c7;
    color:white;
    font-size:22px;
    border:none;
  }

  </style>
  `);

  document.body.insertAdjacentHTML("beforeend", `
    <div id="chatApp">
      <div id="chatHeader">
        헬시키즈 AI <span id="closeBtn">✕</span>
      </div>

      <div id="chatBody"></div>

      <div id="inputBox">
        <textarea id="text" placeholder="질문하세요 😊"></textarea>
        <button id="send">전송</button>
      </div>
    </div>

    <button id="toggleBtn">💬</button>
  `);

  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");
  const app = document.getElementById("chatApp");

  function reset(){
    body.innerHTML = "";
  }

  function add(type, text){
    const div = document.createElement("div");
    div.className = `msg ${type}`;

    div.innerHTML = type === "ai"
      ? `<div class="robotIcon">AI</div><div class="bubble">${text}</div>`
      : `<div class="bubble">${text}</div>`;

    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  async function send(){

    const msg = input.value.trim();
    if(!msg) return;

    add("user", msg);
    input.value = "";

    const loading = document.createElement("div");
    loading.className = "msg ai";
    loading.innerHTML = `<div class="robotIcon">AI</div><div class="bubble">검색 중...</div>`;
    body.appendChild(loading);

    const res = await fetch(`${API_BASE}/api/chat`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ message: msg })
    });

    const data = await res.json();

    loading.remove();

    add("ai", data.reply || "완료");

    (data.results || []).forEach(r=>{
      const div = document.createElement("div");
      div.className = "msg ai";

      div.innerHTML = `
        <div class="robotIcon">AI</div>
        <div class="bubble">
          <b>${r.title}</b><br/>
          ${r.summary}<br/>
          <a href="${r.url}" target="_blank">👉 보기</a>
        </div>
      `;

      body.appendChild(div);
    });
  }

  document.getElementById("send").onclick = send;

  input.addEventListener("keydown", e=>{
    if(e.key==="Enter" && !e.shiftKey){
      e.preventDefault();
      send();
    }
  });

  document.getElementById("toggleBtn").onclick = ()=>{
    app.style.display = "flex";
    reset();
  };

  document.getElementById("closeBtn").onclick = ()=>{
    app.style.display = "none";
    reset();
  };

});
