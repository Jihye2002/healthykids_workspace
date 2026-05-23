const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

const { handleChat } = require("./chat-api");

const server = http.createServer(async (req, res) => {

  const url = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  /* ================= API ================= */
  if (url === "/api/chat") {

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "METHOD NOT ALLOWED" }));
    }

    let body = "";

    req.on("data", chunk => body += chunk);

    req.on("end", async () => {
      try {
        const { message } = JSON.parse(body || "{}");

        const result = await handleChat(message);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(result));

      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          error: true,
          reply: "SERVER ERROR"
        }));
      }
    });

    return;
  }

  /* ================= STATIC ================= */
  let filePath = url === "/" ? "index.html" : path.join(__dirname, url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404");
    }

    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log("🚀 SERVER RUNNING ON", PORT);
});
