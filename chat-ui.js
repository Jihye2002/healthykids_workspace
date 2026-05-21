document.addEventListener("DOMContentLoaded", () => {

  const box = document.createElement("div");
  box.id = "chatbox";
  box.innerHTML = `
    <div id="chat-body"></div>
    <input id="input" placeholder="검색어 입력">
    <button id="send">검색</button>
  `;

  document.body.appendChild(box);

  function add(msg) {
    document.getElementById("chat-body").innerHTML += `<div>${msg}</div>`;
  }

  document.getElementById("send").onclick = async () => {
    const q = document.getElementById("input").value;

    const res = await search(q);

    add("결과:");
    res.menus.forEach(m => {
      add(`<a href="${m.url}">${m.title}</a>`);
    });
  };
});
