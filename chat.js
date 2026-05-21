/* =========================================================
   HEALTHY KIDS AI CHATBOT
   Gemini 기반 AI 챗봇
   최종 안정화 버전
========================================================= */

let isLoading = false;
let lastRequestTime = 0;

document.addEventListener("DOMContentLoaded", function () {

    /* =========================================================
       1. Gemini API KEY
    ========================================================= */

    const API_KEY = "AIzaSyAX5QhLOB03yyoMw07I1tRmBucjpy8c4AM";


    /* =========================================================
       2. 챗봇 스타일
    ========================================================= */

    const style = document.createElement("style");

    style.innerHTML = `

    #chatbox{
        position:fixed;
        bottom:90px;
        right:20px;
        width:340px;
        height:500px;
        background:#ffffff;
        border-radius:18px;
        box-shadow:0 10px 30px rgba(0,0,0,0.18);
        z-index:9999;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        transition:all 0.3s ease;
    }

    .chatbox-hidden{
        opacity:0;
        transform:translateY(120%);
        pointer-events:none;
    }

    #chat-header{
        background:#2f63c7;
        color:white;
        padding:15px;
        font-size:16px;
        font-weight:bold;
        display:flex;
        align-items:center;
        gap:8px;
    }

    #chat-body{
        flex:1;
        overflow-y:auto;
        padding:12px;
        background:#f7f8fc;
        display:flex;
        flex-direction:column;
    }

    .message{
        max-width:85%;
        padding:10px 13px;
        margin-bottom:12px;
        border-radius:15px;
        font-size:14px;
        line-height:1.5;
        word-break:keep-all;
    }

    .user-msg{
        align-self:flex-end;
        background:#2f63c7;
        color:white;
    }

    .ai-msg{
        align-self:flex-start;
        background:white;
        border:1px solid #e5e5e5;
    }

    .input-area{
        display:flex;
        padding:10px;
        border-top:1px solid #eee;
        background:white;
    }

    #user-input{
        flex:1;
        border:1px solid #ddd;
        border-radius:10px;
        padding:10px;
        outline:none;
        font-size:14px;
    }

    #send-btn{
        margin-left:7px;
        background:#2f63c7;
        color:white;
        border:none;
        border-radius:10px;
        padding:10px 14px;
        cursor:pointer;
    }

    #send-btn:disabled{
        opacity:0.6;
        cursor:not-allowed;
    }

    #chat-toggle-button{
        position:fixed;
        bottom:20px;
        right:20px;
        width:65px;
        height:65px;
        border-radius:50%;
        border:none;
        background:#2f63c7;
        color:white;
        font-size:28px;
        cursor:pointer;
        z-index:10000;
        box-shadow:0 5px 20px rgba(0,0,0,0.2);
    }

    .related-wrapper{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:10px;
    }

    .related-btn{
        border:none;
        background:#eef3ff;
        color:#2f63c7;
        border-radius:15px;
        padding:6px 10px;
        cursor:pointer;
        font-size:12px;
    }

    .related-btn:hover{
        background:#dbe7ff;
    }

    .menu-card{
        margin-top:10px;
        background:#ffffff;
        border:1px solid #e6e6e6;
        border-radius:12px;
        padding:10px;
    }

    .menu-title{
        font-weight:bold;
        margin-bottom:8px;
        color:#333;
    }

    .menu-desc{
        font-size:13px;
        color:#666;
        margin-bottom:10px;
    }

    .menu-btn{
        width:100%;
        border:none;
        background:#2f63c7;
        color:white;
        border-radius:8px;
        padding:9px;
        cursor:pointer;
    }

    .menu-btn:hover{
        opacity:0.9;
    }

    .loading{
        display:flex;
        gap:4px;
        padding:10px;
    }

    .loading span{
        width:7px;
        height:7px;
        border-radius:50%;
        background:#999;
        animation:loading 1s infinite;
    }

    .loading span:nth-child(2){
        animation-delay:0.2s;
    }

    .loading span:nth-child(3){
        animation-delay:0.4s;
    }

    @keyframes loading{

        0%{
            opacity:0.3;
            transform:translateY(0);
        }

        50%{
            opacity:1;
            transform:translateY(-3px);
        }

        100%{
            opacity:0.3;
            transform:translateY(0);
        }
    }

    `;

    document.head.appendChild(style);


    /* =========================================================
       3. 기본 메시지 함수
    ========================================================= */

    function getDefaultMessage() {

        return `

            <div class="message ai-msg">

                안녕하세요 😊<br><br>

                궁금한 건강교육 정보를 물어보세요!<br><br>

                예시)<br>
                • 감기 예방 방법 알려줘<br>
                • 손씻기 알려줘<br>
                • 놀이자료 다운로드 하고 싶어

            </div>

        `;
    }


    /* =========================================================
       4. 챗봇 HTML 생성
    ========================================================= */

    const chatHTML = `

    <div id="chatbox" class="chatbox-hidden">

        <div id="chat-header">
            🩺 헬시키즈 AI 도우미
        </div>

        <div id="chat-body">
            ${getDefaultMessage()}
        </div>

        <div class="input-area">

            <input
                type="text"
                id="user-input"
                placeholder="메시지를 입력하세요..."
            >

            <button id="send-btn">
                전송
            </button>

        </div>

    </div>

    <button id="chat-toggle-button">
        💬
    </button>

    `;

    document.body.insertAdjacentHTML("beforeend", chatHTML);


    /* =========================================================
       5. 챗봇 열기/닫기
    ========================================================= */

    const chatbox = document.getElementById("chatbox");
    const toggleButton = document.getElementById("chat-toggle-button");

    toggleButton.addEventListener("click", function () {

        const isHidden =
            chatbox.classList.contains("chatbox-hidden");

        /* ===============================
           챗봇 열기
        =============================== */

        if (isHidden) {

            chatbox.classList.remove("chatbox-hidden");
        }

        /* ===============================
           챗봇 닫기 + 초기화
        =============================== */

        else {

            chatbox.classList.add("chatbox-hidden");

            resetChatbot();
        }
    });


    /* =========================================================
       6. 챗봇 초기화
    ========================================================= */

    function resetChatbot() {

        const body = document.getElementById("chat-body");

        body.innerHTML = getDefaultMessage();

        document.getElementById("user-input").value = "";

        removeLoading();

        isLoading = false;

        document.getElementById("send-btn").disabled = false;
    }


    /* =========================================================
       7. 메시지 출력 함수
    ========================================================= */

    function appendMessage(sender, text, options = {}) {

        const body = document.getElementById("chat-body");

        const msgDiv = document.createElement("div");

        msgDiv.className = `message ${sender}-msg`;

        const textDiv = document.createElement("div");

        textDiv.innerHTML = text;

        msgDiv.appendChild(textDiv);

        /* ===============================
           연관검색어 버튼
        =============================== */

        if (options.related && options.related.length > 0) {

            const relatedWrapper = document.createElement("div");

            relatedWrapper.className = "related-wrapper";

            options.related.forEach(keyword => {

                const btn = document.createElement("button");

                btn.className = "related-btn";

                btn.innerText = keyword;

                btn.addEventListener("click", function () {

                    if (isLoading) return;

                    document.getElementById("user-input").value = keyword;

                    sendMessage();
                });

                relatedWrapper.appendChild(btn);
            });

            msgDiv.appendChild(relatedWrapper);
        }

        /* ===============================
           메뉴 추천 카드
        =============================== */

        if (options.menus && options.menus.length > 0) {

            options.menus.forEach(menu => {

                const card = document.createElement("div");

                card.className = "menu-card";

                card.innerHTML = `

                    <div class="menu-title">
                        ${menu.title}
                    </div>

                    <div class="menu-desc">
                        ${menu.description || "관련 페이지로 이동합니다."}
                    </div>

                    <button class="menu-btn">
                        바로가기
                    </button>

                `;

                card.querySelector(".menu-btn")
                    .addEventListener("click", function () {

                        window.location.href = menu.url;
                    });

                msgDiv.appendChild(card);
            });
        }

        body.appendChild(msgDiv);

        body.scrollTop = body.scrollHeight;
    }


    /* =========================================================
       8. 로딩 애니메이션
    ========================================================= */

    function showLoading() {

        const body = document.getElementById("chat-body");

        const loading = document.createElement("div");

        loading.className = "loading";

        loading.id = "loading-indicator";

        loading.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;

        body.appendChild(loading);

        body.scrollTop = body.scrollHeight;
    }

    function removeLoading() {

        const loading = document.getElementById("loading-indicator");

        if (loading) {

            loading.remove();
        }
    }


    /* =========================================================
       9. AI 메시지 전송
    ========================================================= */

    async function sendMessage() {

        if (isLoading) return;

        /* ===============================
           5초 요청 제한
        =============================== */

        const now = Date.now();

        if (now - lastRequestTime < 5000) {

            appendMessage(
                "ai",
                "잠시만요 😊<br><br>5초 후 다시 질문해주세요."
            );

            return;
        }

        lastRequestTime = now;

        isLoading = true;

        document.getElementById("send-btn").disabled = true;

        const input = document.getElementById("user-input");

        const text = input.value.trim();

        /* ===============================
           빈 입력 방지
        =============================== */

        if (!text) {

            isLoading = false;

            document.getElementById("send-btn").disabled = false;

            return;
        }

        /* ===============================
           글자 수 제한
        =============================== */

        if (text.length > 100) {

            appendMessage(
                "ai",
                "질문은 100자 이하로 입력해주세요 😊"
            );

            isLoading = false;

            document.getElementById("send-btn").disabled = false;

            return;
        }

        appendMessage("user", text);

        input.value = "";

        showLoading();

        try {

            const response = await fetch(

                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,

                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        contents: [

                            {
                                parts: [

                                    {
                                        text: `

너는 어린이 건강교육 AI 챗봇이다.

사용자의 질문에 대해:

1. 친절한 답변
2. 연관검색어 3개
3. 관련 메뉴 추천

을 JSON 형식으로 답해라.

추천 가능한 메뉴:

- 위생안전 → /hygiene.html
- 실외안전 → /outdoor.html
- 생활건강 → /health.html
- 질병예방 → /disease.html
- 놀이자료 다운로드 → /play.html
- 안전수칙자료 다운로드 → /safety.html
- Q&A → /qna.html

반드시 아래 JSON 형식으로만 답해라.

{
  "reply":"...",
  "related":["...","...","..."],
  "menus":[
    {
      "title":"...",
      "description":"...",
      "url":"..."
    }
  ]
}

사용자 질문:
${text}

`
                                    }
                                ]
                            }
                        ]
                    })
                }
            );

            const data = await response.json();

            console.log(data);

            /* ===============================
               API 에러 처리
            =============================== */

            if (data.error) {

                removeLoading();

                appendMessage(

                    "ai",

                    "현재 AI 요청이 많아요 😢<br><br>잠시 후 다시 시도해주세요."
                );

                isLoading = false;

                document.getElementById("send-btn").disabled = false;

                return;
            }

            /* ===============================
               Gemini 응답 가져오기
            =============================== */

            const aiText =
                data.candidates[0].content.parts[0].text;

            /* ===============================
               JSON 정리
            =============================== */

            let cleanText = aiText
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            const parsed = JSON.parse(cleanText);

            removeLoading();

            appendMessage(

                "ai",

                parsed.reply || "답변 생성 실패 😢",

                {
                    related: parsed.related || [],
                    menus: parsed.menus || []
                }
            );

            isLoading = false;

            document.getElementById("send-btn").disabled = false;

        } catch (error) {

            console.error(error);

            removeLoading();

            appendMessage(

                "ai",

                "죄송합니다 😢<br><br>AI 응답 생성 중 오류가 발생했어요."
            );

            isLoading = false;

            document.getElementById("send-btn").disabled = false;
        }
    }


    /* =========================================================
       10. 이벤트 연결
    ========================================================= */

    document
        .getElementById("send-btn")
        .addEventListener("click", sendMessage);

    document
        .getElementById("user-input")
        .addEventListener("keypress", function (e) {

            if (e.key === "Enter") {

                sendMessage();
            }
        });

});
