document.addEventListener("DOMContentLoaded", () => {

  const API_BASE = "https://healthykids-workspace.onrender.com";

  document.head.insertAdjacentHTML("beforeend", `
  <style>
    #chatApp{position:fixed;bottom:90px;right:20px;width:420px;height:650px;background:#fff;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,0.2);display:none;flex-direction:column;overflow:hidden;z-index:9999;}

    #chatHeader{background:#2f63c7;color:#fff;padding:14px;font-weight:bold;display:flex;justify-content:space-between;}

    #chatBody{flex:1;padding:14px;overflow-y:auto;background:#f6f7fb;}

    .msg{max-width:92%;padding:10px;margin:8px 0;border-radius:12px;font-size:14px;}
    .user{background:#2f63c7;color:#fff;margin-left:auto;}
    .ai{background:#fff;border:1px solid #ddd;}

    .guide{
      background:#eef5ff;
      padding:12px;
      border-radius:12px;
      margin-bottom:10px;
      font-size:13px;
      line-height:1.5;
    }

    #inputBox{display:flex;gap:8px;padding:10px;border-top:1px solid #ddd;}

    #text{flex:1;height:42px;border-radius:10px;border:1px solid #ddd;padding:10px;}

    #voiceBtn{
      width:42px;height:42px;border-radius:50%;
      background:#4a4a4a;color:#fff;border:none;
    }

    #voiceBtn.recording{
      background:#e74c3c;
    }

    #send{
      width:70px;background:#2f63c7;color:#fff;border:none;border-radius:10px;
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
      <textarea id="text" placeholder="궁금한 것을 편하게 물어보세요 😊"></textarea>
      <button id="voiceBtn">🎙</button>
      <button id="send">검색</button>
    </div>
  </div>

  <button id="toggleBtn">💬</button>
  `);

  const body = document.getElementById("chatBody");
  const input = document.getElementById("text");

  function showGuide(){
    body.innerHTML = `
      <div class="guide">
        🌼 <b>헬시키즈 사용 방법</b><br><br>
        ★ 안전, 건강 정보를 알려줘요<br>
        ★ 영상과 자료도 함께 볼 수 있어요 😊
      </div>

      <div class="guide">
        💡 <b>이렇게 물어보면 좋아요</b><br>
        “손 씻는 방법 알려줘”<br>
        “감기 안 걸리는 방법”<br>
        “횡단보도 건너기”
      </div>
    `;
  }

  function addMsg(type, text){
    const d = document.createElement("div");
    d.className = `msg ${type}`;
    d.innerText = text;
    body.appendChild(d);
  }

  function addCard(r){
    const d = document.createElement("div");
    d.className = "msg ai";
    d.innerHTML = `
      <b>${r.title}</b><br>
      ${r.summary || ""}<br><br>
      <a href="${r.url}" target="_blank"
        style="padding:6px 10px;background:#2f63c7;color:#fff;border-radius:8px;text-decoration:none;">
        👉 보러가기
      </a>
    `;
    body.appendChild(d);
  }

  async function send(){
    const text = input.value.trim();
    if(!text) return;

    addMsg("user", text);
    input.value = "";

    const res = await fetch(`${API_BASE}/api/chat`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ message:text })
    });

    const data = await res.json();

    body.innerHTML = "";
    addMsg("ai", data.reply || "검색 결과를 알려드릴게요. 조금만 기다려주세요 😊");

    (data.results || []).forEach(addCard);
  }

  document.getElementById("send").onclick = send;

  /* VOICE */
  let rec;
  let listening = false;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  if(SR){
    rec = new SR();
    rec.lang = "ko-KR";

    rec.onresult = e=>{
      let t="";
      for(let i=e.resultIndex;i<e.results.length;i++){
        t += e.results[i][0].transcript;
      }
      input.value = t;
    };

    rec.onend = ()=>{
      listening = false;
      document.getElementById("voiceBtn").classList.remove("recording");
      if(input.value.trim()) send();
    };
  }

  document.getElementById("voiceBtn").onclick = ()=>{
    if(!rec) return;

    if(listening){
      rec.stop();
      listening = false;
      return;
    }

    rec.start();
    listening = true;
    document.getElementById("voiceBtn").classList.add("recording");
  };

  document.getElementById("toggleBtn").onclick = ()=>{
    document.getElementById("chatApp").style.display="flex";
    showGuide();
  };

  document.getElementById("closeBtn").onclick = ()=>{
    document.getElementById("chatApp").style.display="none";
    body.innerHTML="";
  };

});
