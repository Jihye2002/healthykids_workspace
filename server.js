const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   MEMORY DB
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   CLEAN TEXT
========================= */
function cleanText(html){
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function split(text){
  return text
    .split(/(?<=[.!?])\s+/)
    .filter(t => t.length > 25);
}

/* =========================
   ADD DOCUMENT (핵심)
========================= */
function addDocument(doc){
  DOCUMENTS.push(doc);
}

/* =========================
   LOAD ALL HTML FILES
========================= */
function loadSite(){

  DOCUMENTS = [];

  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith(".html"));

  files.forEach(file => {

    const html = fs.readFileSync(file, "utf-8");

    split(cleanText(html)).forEach((t, i) => {
      addDocument({
        title: `${file} ${i}`,
        text: t,
        url: `/${file}`,
        type: "html"
      });
    });
  });

  console.log("📦 사이트 로딩 완료:", DOCUMENTS.length);
}

/* =========================
   EMBEDDING
========================= */
async function embed(text){

  try{
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text
      })
    });

    const data = await res.json();
    return data?.data?.[0]?.embedding || [];
  }catch{
    return [];
  }
}

/* =========================
   VECTOR BUILD (실시간)
========================= */
async function rebuildVector(){

  VECTOR_DB = [];

  for(const d of DOCUMENTS){

    const v = await embed(d.text);

    VECTOR_DB.push({
      ...d,
      vector: v
    });
  }

  console.log("🧠 Vector DB 업데이트:", VECTOR_DB.length);
}

/* =========================
   COSINE SIMILARITY
========================= */
function cosine(a,b){

  if(!a.length || !b.length) return 0;

  let dot=0, ma=0, mb=0;

  for(let i=0;i<a.length;i++){
    dot += a[i]*b[i];
    ma += a[i]*a[i];
    mb += b[i]*b[i];
  }

  return dot / (Math.sqrt(ma)*Math.sqrt(mb) + 1e-9);
}

/* =========================
   SEARCH (핵심 개선)
========================= */
async function search(query){

  const q = await embed(query);

  return DOCUMENTS.map(d => {

    let score = 0;

    if(q.length && d.vector.length){
      score = cosine(q, d.vector);
    }

    if(d.text.includes(query)) score += 0.25;

    return { ...d, score };
  })
  .filter(x => x.score > 0.5)
  .sort((a,b)=>b.score-a.score)
  .slice(0,5);
}

/* =========================
   AI SUMMARY (핵심 안전모드)
========================= */
async function summarize(query, results){

  if(results.length === 0){
    return {
      reply: "이 내용은 현재 헬시키즈 자료에 없어요 😊",
      results: []
    };
  }

  const context = results.map(r => `
제목: ${r.title}
내용: ${r.text}
링크: ${r.url}
`).join("\n\n");

  try{
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
          {
            role: "system",
            content: `
너는 유치원/초등 교육 AI이다.

절대 규칙:
- 반드시 제공된 자료만 사용
- 없는 내용은 만들지 말 것
- 3~4줄 쉬운 설명
- 부드럽고 친절한 말투
- JSON만 출력

{
 "reply":"",
 "results":[
   {
     "title":"",
     "summary":"",
     "url":""
   }
 ]
}
`
          },
          {
            role: "user",
            content: `${query}\n\n${context}`
          }
        ]
      })
    });

    const data = await res.json();

    try{
      return JSON.parse(data.choices[0].message.content);
    }catch{
      return {
        reply: "내용을 정리했어요 😊",
        results
      };
    }

  }catch{
    return {
      reply: "AI 서버 연결에 문제가 있어요 😢",
      results
    };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(msg){

  const results = await search(msg);

  return await summarize(msg, results);
}

/* =========================
   FILE UPLOAD (실시간 반영)
========================= */
async function addFile(file){

  if(file.name.endsWith(".pdf")){

    const buffer = Buffer.from(file.content, "base64");
    const parsed = await pdfParse(buffer);

    split(parsed.text).forEach((t,i)=>{
      addDocument({
        title:`📄 ${file.name} ${i}`,
        text:t,
        url:`/files/${file.name}`,
        type:"pdf"
      });
    });
  }

  await rebuildVector();

  return { ok:true };
}

/* =========================
   SERVER
========================= */
const server = http.createServer(async (req,res)=>{

  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");

  if(req.method === "OPTIONS"){
    res.writeHead(204);
    return res.end();
  }

  /* CHAT */
  if(req.url === "/api/chat"){

    let body="";
    req.on("data",c=>body+=c);

    req.on("end",async()=>{

      const {message} = JSON.parse(body || "{}");

      const result = await pipeline(message);

      res.writeHead(200,{"Content-Type":"application/json"});
      res.end(JSON.stringify(result));
    });

    return;
  }

  /* UPLOAD */
  if(req.url === "/api/upload"){

    let body="";
    req.on("data",c=>body+=c);

    req.on("end",async()=>{

      const file = JSON.parse(body || "{}");

      const result = await addFile(file);

      res.writeHead(200,{"Content-Type":"application/json"});
      res.end(JSON.stringify(result));
    });

    return;
  }

  /* STATIC FILE */
  const filePath = req.url === "/"
    ? "index.html"
    : path.join(__dirname, req.url);

  fs.readFile(filePath,(err,data)=>{

    if(err){
      res.writeHead(404);
      return res.end("not found");
    }

    res.writeHead(200);
    res.end(data);
  });
});

/* INIT */
(async()=>{
  loadSite();
  await rebuildVector();
})();

server.listen(PORT, ()=>{
  console.log("🚀 헬시키즈 AI 서버 실행:", PORT);
});
