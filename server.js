const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Tesseract = require("tesseract.js");
const fetch = global.fetch || require("node-fetch");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// 2. API 라우트 (정적 파일보다 무조건 위에 있어야 합니다)
app.get("/get-config", (req, res) => {
    res.json({
        SUPABASE_URL: process.env.SUPABASE_URL || "",
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
        NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID || "" // 이 줄을 추가하세요!
    });
});

app.post("/api/chat", async (req, res) => {
    const q = req.body.message || "";
    if (CACHE.has(q)) return res.json(CACHE.get(q));

    const docs = search(q);
    const ai = await generateAI(q, docs);

    const result = {
        query: q,
        answer: ai.answer,
        buttons: ai.buttons,
        results: docs
    };

    CACHE.set(q, result);
    res.json(result);
});

// 3. 정적 파일 서빙 (이제 안전합니다)
app.use(express.static(__dirname));

// 4. 데이터 및 로직 정의
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let DOCS = [];
let CACHE = new Map();

function cleanHTML(html) {
    return html
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractLinks(html) {
    const links = [];
    const regex = /href="(.*?)".*?>(.*?)<\/a>/g;
    let match;
    while ((match = regex.exec(html))) {
        links.push({
            url: match[1],
            label: match[2].replace(/<[^>]+>/g, "").trim()
        });
    }
    return links;
}

async function loadFiles() {
    DOCS = [];
    const files = fs.readdirSync(__dirname);
    for (const file of files) {
        const full = path.join(__dirname, file);
        if (file.endsWith(".html")) {
            const html = fs.readFileSync(full, "utf8");
            DOCS.push({ type: "html", title: file, text: cleanHTML(html), links: extractLinks(html), url: `/${file}` });
        }
        if (file.endsWith(".pdf")) {
            const buf = fs.readFileSync(full);
            const pdf = await pdfParse(buf);
            DOCS.push({ type: "pdf", title: file, text: pdf.text, links: [], url: `/${file}` });
        }
        if (file.match(/\.(png|jpg|jpeg)$/)) {
            const ocr = await Tesseract.recognize(full, "kor+eng");
            DOCS.push({ type: "image", title: file, text: ocr.data.text, links: [], url: `/${file}` });
        }
        if (file.endsWith(".mp4")) {
            DOCS.push({ type: "video", title: file, text: "VIDEO_FILE_AVAILABLE", links: [], url: `/${file}` });
        }
    }
    console.log("DOCS LOADED:", DOCS.length);
}

function search(query) {
    const q = query.toLowerCase();
    return DOCS.map(d => ({ ...d, score: d.text.toLowerCase().includes(q) ? 2 : 0 }))
               .sort((a, b) => b.score - a.score)
               .slice(0, 8);
}

async function generateAI(query, docs) {
    const context = docs.map(d => `TYPE: ${d.type}\nTITLE: ${d.title}\nURL: ${d.url}\n\nCONTENT:\n${d.text.slice(0, 500)}\n\nLINKS:\n${(d.links || []).map(l => `- ${l.label} → ${l.url}`).join("\n")}`).join("\n\n");
    const prompt = `너는 "AI 교육 검색 엔진"이다 (5~7세 대상).\n규칙: 메뉴/nav/footer 출력 금지, 의미 있는 정보만 사용, 결과는 버튼 제공, 버튼은 URL 포함.\n특별 규칙: video 타입이면 "영상 요약도 함께 생성", 감정 표현 없이 명확하게.\n출력 JSON:\n{ "answer": "", "buttons": [ { "label": "", "url": "" } ] }\n질문: ${query}\n문서: ${context}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "Return ONLY JSON." }, { role: "user", content: prompt }],
            temperature: 0.2
        })
    });
    const data = await res.json();
    try { return JSON.parse(data.choices[0].message.content); } 
    catch { return { answer: "처리 실패", buttons: [] }; }
}

// 5. 서버 시작
(async () => {
    await loadFiles();
})();

app.listen(PORT, () => {
    console.log("AI ENGINE RUNNING:", PORT);
});
