document.addEventListener("DOMContentLoaded", function() {
    // 1. CSS 스타일을 페이지에 자동으로 추가
    const style = document.createElement('style');
    style.innerHTML = `
        #chatbox { position: fixed; bottom: 80px; right: 20px; width: 300px; height: 400px; background: white; border: 1px solid #ccc; box-shadow: 0 5px 15px rgba(0,0,0,0.2); z-index: 9999; transition: transform 0.3s ease; }
        .chatbox-hidden { transform: translateY(120%); }
        #chat-toggle-button { position: fixed; bottom: 20px; right: 20px; z-index: 10000; padding: 10px 20px; background: #2f63c7; color: white; border: none; border-radius: 20px; cursor: pointer; }
        #chat-body { height: 300px; overflow-y: auto; padding: 10px; border-bottom: 1px solid #eee; }
    `;
    document.head.appendChild(style);

    // 2. HTML 구조 자동 생성
    const chatboxHTML = `
        <div id="chatbox" class="chatbox-hidden">
            <div id="chat-body"></div>
            <input type="text" id="user-input" placeholder="질문을 입력하세요">
            <button onclick="sendMessage()">전송</button>
        </div>
        <button id="chat-toggle-button" onclick="toggleChat()">챗봇</button>
    `;
    document.body.insertAdjacentHTML('beforeend', chatboxHTML);

    // 3. 함수를 여기서 전역으로 선언 (버튼이 함수를 찾을 수 있게)
    window.toggleChat = function() {
        document.getElementById('chatbox').classList.toggle('chatbox-hidden');
    };

    window.sendMessage = function() {
        const input = document.getElementById('user-input');
        const body = document.getElementById('chat-body');
        if (input.value.trim() === "") return;
        body.innerHTML += `<p>나: ${input.value}</p>`;
        input.value = "";
        body.scrollTop = body.scrollHeight;
    };
});