document.addEventListener("DOMContentLoaded", function() {
    // 1. CSS 스타일 수정 (디자인 강화)
    const style = document.createElement('style');
    style.innerHTML = `
        #chatbox { position: fixed; bottom: 90px; right: 20px; width: 300px; height: 400px; background: #fff; border-radius: 15px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 9999; transition: all 0.3s ease; display: flex; flex-direction: column; overflow: hidden; }
        .chatbox-hidden { transform: translateY(120%); opacity: 0; pointer-events: none; }
        
        #chat-toggle-button { position: fixed; bottom: 20px; right: 20px; z-index: 10000; width: 60px; height: 60px; background: #2f63c7; color: white; border: none; border-radius: 50%; cursor: pointer; box-shadow: 0 4px 10px rgba(47, 99, 199, 0.4); font-size: 24px; display: flex; align-items: center; justify-content: center; }
        
        #chat-body { flex: 1; overflow-y: auto; padding: 15px; background: #f9f9f9; }
        .message { margin-bottom: 10px; padding: 8px 12px; border-radius: 15px; background: white; border: 1px solid #ddd; max-width: 80%; align-self: flex-start; }
        
        .input-area { display: flex; padding: 10px; border-top: 1px solid #eee; }
        #user-input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 5px; outline: none; }
        #send-btn { margin-left: 5px; background: #2f63c7; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; }
    `;
    document.head.appendChild(style);

    // 2. HTML 구조 수정
    const chatboxHTML = `
        <div id="chatbox" class="chatbox-hidden">
            <div id="chat-body"></div>
            <div class="input-area">
                <input type="text" id="user-input" placeholder="메시지를 입력하세요...">
                <button id="send-btn" onclick="sendMessage()">전송</button>
            </div>
        </div>
        <button id="chat-toggle-button" onclick="toggleChat()">💬</button>
    `;
    document.body.insertAdjacentHTML('beforeend', chatboxHTML);

    // 3. 기능 구현
    window.toggleChat = function() {
        document.getElementById('chatbox').classList.toggle('chatbox-hidden');
    };

    window.sendMessage = function() {
        const input = document.getElementById('user-input');
        const body = document.getElementById('chat-body');
        if (input.value.trim() === "") return;
        
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        msgDiv.innerText = input.value;
        body.appendChild(msgDiv);
        
        input.value = "";
        body.scrollTop = body.scrollHeight;
    };
});
