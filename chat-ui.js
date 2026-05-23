document.addEventListener("DOMContentLoaded", () => {

  const API_BASE =
    "https://healthykids-workspace.onrender.com";

  /* =========================
     STYLE
  ========================= */
  document.head.insertAdjacentHTML("beforeend", `
  <style>

    #chatApp{
      position:fixed;
      bottom:110px;
      right:25px;
      width:420px;
      height:650px;
      background:#f6f7fb;
      border-radius:18px;
      box-shadow:0 20px 50px rgba(0,0,0,0.2);
      display:none;
      flex-direction:column;
      overflow:hidden;
      z-index:9999;
      font-family:Arial,sans-serif;
    }

    #chatHeader{
      background:#2f63c7;
      color:#fff;
      padding:14px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      font-weight:bold;
      font-size:16px;
    }

    #chatBody{
      flex:1;
      padding:14px;
      overflow-y:auto;
      display:flex;
      flex-direction:column;
      gap:12px;
    }

    /* =========================
       GUIDE
    ========================= */
    .guideBox{
      background:#fff;
      border-radius:14px;
      padding:14px;
      border:1px solid #e5e5e5;
    }

    .guideTitle{
      font-weight:bold;
      color:#2f63c7;
      margin-bottom:10px;
      font-size:15px;
    }

    .guideBtn{
      display:inline-block;
      margin-top:12px;
      padding:8px 12px;
      background:#2f63c7;
      color:#fff;
      border-radius:8px;
      text-decoration:none;
      font-size:13px;
    }

    /* =========================
       MESSAGE
    ========================= */
    .msg{
      display:flex;
      gap:10px;
      align-items:flex-start;
    }

    .user{
      justify-content:flex-end;
    }

    .bubble{
      padding:12px 14px;
      border-radius:14px;
      line-height:1.6;
      font-size:14px;
      white-space:pre-wrap;
      word-break:keep-all;
    }

    .user .bubble{
      background:#2f63c7;
      color:#fff;
      max-width:75%;
    }

    .ai .bubble{
      background:#fff;
      border:1px solid #ddd;
      max-width:78%;
    }

    /* =========================
       ROBOT ICON
    ========================= */
    .robotIcon{
      width:34px;
      height:34px;
      min-width:34px;
      border-radius:50%;
      background:#2f63c7;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 4px 10px rgba(0,0,0,0.15);
    }

    /* =========================
       RESULT CARD
    ========================= */
    .resultCard{
      background:#fff;
      border:1px solid #ddd;
      border-radius:14px;
      padding:14px;
      width:100%;
    }

    .resultTitle{
      font-weight:bold;
      color:#2f63c7;
      margin-bottom:8px;
      font-size:15px;
    }

    .resultSummary{
      line-height:1.6;
      color:#333;
      font-size:14px;
    }

    .resultBtn{
      display:inline-block;
      margin-top:12px;
      padding:8px 12px;
      background:#2f63c7;
      color:#fff;
      border-radius:8px;
      text-decoration:none;
      font-size:13px;
    }

    .videoThumb{
      width:100%;
      border-radius:10px;
      margin-bottom:10px;
    }

    /* =========================
       INPUT
    ========================= */
   #inputBox{
      display:flex;
      align-items:center;
      gap:8px;
      padding:10px;
      background:#fff;
      border-top:1px solid #ddd;
    }
    
    /* 입력창 */
    #text{
      flex:1;
    
      height:54px;
      min-height:54px;
      max-height:120px;
    
      resize:none;
    
      border:1px solid #ddd;
      border-radius:10px;
    
      /* 세로 가운데처럼 보이게 */
      padding:16px 12px 0 12px;
    
      font-size:14px;
      line-height:20px;
    
      outline:none;
      font-family:Arial,sans-serif;
    
      overflow-y:auto;
    
      box-sizing:border-box;
    }
    
    /* 검색 버튼 */
    #send{
      width:80px;
      height:54px;
    
      border:none;
      border-radius:10px;
    
      background:#2f63c7;
      color:#fff;
    
      font-size:14px;
      font-weight:bold;
    
      cursor:pointer;
    
      display:flex;
      align-items:center;
      justify-content:center;
    
      flex-shrink:0;
    
      box-sizing:border-box;
    }
    
    /* =========================
       TOGGLE BUTTON
    ========================= */
    #toggleBtn{
      position:fixed;
      right:25px;
      bottom:25px;
    
      width:70px;
      height:70px;
    
      border:none;
      border-radius:50%;
    
      background:#2f63c7;
    
      display:flex;
      align-items:center;
      justify-content:center;
    
      cursor:pointer;
    
      box-shadow:0 12px 30px rgba(0,0,0,0.25);
    
      z-index:9999;
    }

  </style>
  `);

  /* =========================
     UI
  ========================= */
  document.body.insertAdjacentHTML("beforeend", `

    <div id="chatApp">

      <div id="chatHeader">
        헬시키즈 AI
        <span id="closeBtn" style="cursor:pointer;">✕</span>
      </div>

      <div id="chatBody"></div>

      <div id="inputBox">

        <textarea
          id="text"
          placeholder="궁금한 걸 물어보세요 😊"
        ></textarea>

        <button id="send">검색</button>

      </div>

    </div>

    <button id="toggleBtn">

      <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
        <path d="M12 2a2 2 0 00-2 2v1H7a3 3 0 00-3 3v9a3 3 0 003 3h10a3 3 0 003-3V8a3 3 0 00-3-3h-3V4a2 2 0 00-2-2zm-4 9h2v2H8v-2zm6 0h2v2h-2v-2z"/>
      </svg>

    </button>

  `);

  const body =
    document.getElementById("chatBody");

  const input =
    document.getElementById("text");

  /* =========================
     GUIDE
  ========================= */
  function showGuide(){

    body.innerHTML = `

      <div class="guideBox">

        <div class="guideTitle">
          💡 AI 사용 예시
        </div>

        <div>⭐ 손 씻는 방법 알려줘</div>
        <div>⭐ 감기 예방 방법</div>
        <div>⭐ 횡단보도 안전하게 건너기</div>

      </div>

      <div class="guideBox">

        <div class="guideTitle">
          📘 헬시키즈 이용 가이드
        </div>

        <div>
          홈페이지의 영상, 놀이자료,
          안전수칙 자료를 쉽게 찾아볼 수 있어요.
        </div>

        <a
          class="guideBtn"
          href="guide.html"
          target="_blank"
        >
          가이드 보기
        </a>

      </div>

    `;
  }

  /* =========================
     MESSAGE
  ========================= */
  function addMessage(type, text){

    const wrap =
      document.createElement("div");

    wrap.className =
      `msg ${type}`;

    if(type === "ai"){

      wrap.innerHTML = `

        <div class="robotIcon">

          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 2a2 2 0 00-2 2v1H7a3 3 0 00-3 3v9a3 3 0 003 3h10a3 3 0 003-3V8a3 3 0 00-3-3h-3V4a2 2 0 00-2-2z"/>
          </svg>

        </div>

        <div class="bubble">${text}</div>

      `;

    }else{

      wrap.innerHTML = `
        <div class="bubble">${text}</div>
      `;
    }

    body.appendChild(wrap);

    body.scrollTop =
      body.scrollHeight;
  }

  /* =========================
     RESULT CARD
  ========================= */
  function addResultCard(r){

    const wrap =
      document.createElement("div");

    wrap.className = "msg ai";

    let thumb = "";

    if(
      r.type === "video" &&
      r.thumbnail
    ){

      thumb = `
        <img
          src="${r.thumbnail}"
          class="videoThumb"
        >
      `;
    }

    wrap.innerHTML = `

      <div class="robotIcon">

        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 2a2 2 0 00-2 2v1H7a3 3 0 00-3 3v9a3 3 0 003 3h10a3 3 0 003-3V8a3 3 0 00-3-3h-3V4a2 2 0 00-2-2z"/>
        </svg>

      </div>

      <div class="resultCard">

        ${thumb}

        <div class="resultTitle">
          ${r.title}
        </div>

        <div class="resultSummary">
          ${r.summary}
        </div>

        <a
          class="resultBtn"
          href="${r.url}"
          target="_blank"
        >
          👉 보러가기
        </a>

      </div>

    `;

    body.appendChild(wrap);

    body.scrollTop =
      body.scrollHeight;
  }

  /* =========================
     SEND
  ========================= */
  async function send(){

    const text =
      input.value.trim();

    if(!text) return;

    addMessage("user", text);

    input.value = "";

    addMessage(
      "ai",
      "자료를 찾고 있어요 😊"
    );

    try{

      const res = await fetch(
        `${API_BASE}/api/chat`,
        {
          method:"POST",

          headers:{
            "Content-Type":
              "application/json"
          },

          body:JSON.stringify({
            message:text
          })
        }
      );

      const data =
        await res.json();

      body.lastChild.remove();

      addMessage(
        "ai",
        data.reply ||
        "자료를 찾았어요 😊"
      );

      if(
        !data.results ||
        data.results.length === 0
      ){

        addMessage(
          "ai",
          "관련 자료가 아직 없어요 😢"
        );

        return;
      }

      data.results.forEach(r=>{

        addResultCard(r);

      });

    }catch(e){

      console.log(e);

      body.lastChild.remove();

      addMessage(
        "ai",
        "서버 연결에 문제가 있어요 😢"
      );
    }
  }

  /* =========================
     ENTER / SHIFT+ENTER
  ========================= */
  input.addEventListener(
    "keydown",
    (e)=>{

      if(
        e.key === "Enter" &&
        !e.shiftKey
      ){

        e.preventDefault();

        send();
      }
    }
  );

  /* =========================
     SEND BUTTON
  ========================= */
  document
    .getElementById("send")
    .addEventListener(
      "click",
      send
    );

  /* =========================
     OPEN CHAT
  ========================= */
  document
    .getElementById("toggleBtn")
    .addEventListener(
      "click",
      ()=>{

        document
          .getElementById("chatApp")
          .style.display = "flex";

        if(
          body.innerHTML.trim() === ""
        ){
          showGuide();
        }
      }
    );

  /* =========================
     CLOSE CHAT
  ========================= */
  document
    .getElementById("closeBtn")
    .addEventListener(
      "click",
      ()=>{

        document
          .getElementById("chatApp")
          .style.display = "none";
      }
    );

});
