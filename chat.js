/* =========================================================
   HEALTHY KIDS AI CHATBOT
   GPT 기반 연관검색 + 메뉴추천 챗봇
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =========================================================
       1. 챗봇 스타일 추가
    ========================================================= */

    const style = document.createElement("style");

    style.innerHTML = `

    /* ===============================
       챗봇 전체
    =============================== */

    #chatbox{

        position:fixed;

        bottom:90px;

        right:20px;

        width:330px;

        height:480px;

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

    /* ===============================
       챗봇 헤더
    =============================== */

    #chat-header{

        background:#2f63c7;

        color:white;

        padding:14px;

        font-size:16px;

        font-weight:bold;

        display:flex;

        align-items:center;

        gap:8px;
    }

    /* ===============================
       채팅 영역
    =============================== */

    #chat-body{

        flex:1;

        overflow-y:auto;

        padding:12px;

        background:#f7f8fc;

        display:flex;

        flex-direction:column;
    }

    /* ===============================
       메시지 공통
    =============================== */

    .message{

        max-width:85%;

        padding:10px 13px;

        margin-bottom:12px;

        border-radius:15px;

        font-size:14px;

        line-height:1.5;

        word-break:keep-all;
    }

    /* 사용자 메시지 */

    .user-msg{

        align-self:flex-end;

        background:#2f63c7;

        color:white;
    }

    /* AI 메시지 */

    .ai-msg{

        align-self:flex-start;

        background:white;

        border:1px solid #e5e5e5;
    }

    /* ===============================
       입력창
    =============================== */

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

    /* ===============================
       챗봇 열기 버튼
    =============================== */

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

    /* ===============================
       연관검색어
    =============================== */

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

    /* ===============================
       메뉴 추천 카드
    =============================== */

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

    /* ===============================
       로딩 애니메이션
    =============================== */

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
       2. 챗봇 HTML 생성
    ========================================================= */

    const chatHTML = `

    <div id="chatbox" class="chatbox-hidden">

        <div id="chat-header">
            🩺 헬시키즈 AI 도우미
        </div>

        <div id="chat-body">

            <div class="message ai-msg">

                안녕하세요 😊<br><br>

                궁금한 건강교육 정보를 물어보세요!<br><br>

                예시)<br>
                • 감기 예방 방법 알려줘<br>
                • 손씻기 영상 보여줘<br>
                • 놀이자료 다운로드 하고 싶어

            </div>

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
       3. 챗봇 열기/닫기
    ========================================================= */

    const chatbox = document.getElementById("chatbox");

    const toggleButton = document.getElementById("chat-toggle-button");

    toggleButton.addEventListener("click", function () {

        chatbox.classList.toggle("chatbox-hidden");
    });


    /* =========================================================
       4. 메시지 출력 함수
    ========================================================= */

    function appendMessage(sender, text, options = {}) {

        const body = document.getElementById("chat-body");

        const msgDiv = document.createElement("div");

        msgDiv.className = `message ${sender}-msg`;

        /* =========================
           답변 텍스트
        ========================== */

        const textDiv = document.createElement("div");

        textDiv.innerHTML = text;

        msgDiv.appendChild(textDiv);

        /* =========================
           연관검색어 버튼
        ========================== */

        if (options.related && options.related.length > 0) {

            const relatedWrapper = document.createElement("div");

            relatedWrapper.className = "related-wrapper";

            options.related.forEach(keyword => {

                const btn = document.createElement("button");

                btn.className = "related-btn";

                btn.innerText = keyword;

                btn.addEventListener("click", function () {

                    document.getElementById("user-input").value = keyword;

                    sendMessage();
                });

                relatedWrapper.appendChild(btn);
            });

            msgDiv.appendChild(relatedWrapper);
        }

        /* =========================
           메뉴 추천 카드
        ========================== */

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
       5. 로딩 표시
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
       6. 메시지 전송
    ========================================================= */

    async function sendMessage() {

        const input = document.getElementById("user-input");

        const text = input.value.trim();

        if (!text) return;

        /* =========================
           사용자 메시지 출력
        ========================== */

        appendMessage("user", text);

        input.value = "";

        /* =========================
           로딩 표시
        ========================== */

        showLoading();

        try {

            /* =====================================================
               AI 서버 요청
               ↓↓↓ 여기를 실제 서버 주소로 수정
            ===================================================== */

            const response = await fetch("http://127.0.0.1:5000/chat"), {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    prompt: text
                })
            });

            const data = await response.json();

            removeLoading();

            /* =========================
               AI 답변 출력
            ========================== */

            appendMessage(

                "ai",

                data.reply || "답변을 생성하지 못했어요 😢",

                {
                    related: data.related || [],
                    menus: data.menus || []
                }
            );

        } catch (error) {

            removeLoading();

            appendMessage(

                "ai",

                "죄송합니다 😢<br><br>현재 AI 서버와 연결할 수 없어요."
            );

            console.error(error);
        }
    }


    /* =========================================================
       7. 이벤트 연결
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
