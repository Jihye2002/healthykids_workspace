document.addEventListener("DOMContentLoaded", () => {

  const input = document.getElementById("chat-input");
  const box = document.getElementById("chat-box");

  window.sendMessage = async function () {
    const q = input.value;
    if (!q) return;

    box.innerHTML += `<div>👤 ${q}</div>`;

    const results = await search(q);

    let html = `<div>🤖 검색 결과:</div>`;

    results.forEach(r => {
      html += `
        <div>
          <a href="${r.url}">${r.title}</a>
        </div>
      `;
    });

    box.innerHTML += html;
    input.value = "";
  };
});
