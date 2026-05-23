const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

const fetch = global.fetch || require("node-fetch");

/* =========================
   KEYS
========================= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DATA STORE
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];
let CACHE = new Map();

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(__dirname));

const upload = multer({ dest: "uploads/" });

/* =========================
   NORMALIZE
========================= */
function normalize(t="") {
  return t.toLowerCase().replace(/[^\w가-힣]/g," ").replace(/\s+/g," ").trim();
}

/* =========================
   CLEAN HTML
========================= */
function stripHtml(html){
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,"")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi,"")
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim();
}

/* =========================
   INTENT (AUTO FILTER)
========================= */
function classifyIntent(q){
  q=q.toLowerCase();
  if(q.includes("손")||q.includes("씻"))return"hygiene";
  if(q.includes("감기")||q.includes("열"))return"health";
  if(q.includes("횡단"))return"safety";
  return"general";
}

/* =========================
   FILE LOAD (HTML + PDF + IMAGE)
========================= */
async function loadFiles(){

  DOCUMENTS = [];

  const files = fs.readdirSync(__dirname);

  for(const file of files){

    const full = path.join(__dirname,file);

    /* HTML */
    if(file.endsWith(".html")){
      const html = fs.readFileSync(full,"utf8");
      const clean = stripHtml(html);

      DOCUMENTS.push({
        type:"html",
        title:file,
        text:clean,
        url:"/"+file
      });
    }

    /* PDF */
    if(file.endsWith(".pdf")){
      const buf = fs.readFileSync(full);
      const pdf = await pdfParse(buf);

      DOCUMENTS.push({
        type:"pdf",
        title:file,
        text:pdf.text,
        url:"/"+file
      });
    }

    /* IMAGE OCR */
    if(file.match(/\.(png|jpg|jpeg)$/)){
      const text = await Tesseract.recognize(full,"kor+eng");

      DOCUMENTS.push({
        type:"image",
        title:file,
        text:text.data.text,
        url:"/"+file
      });
    }
  }

  console.log("📦 INDEX:",DOCUMENTS.length);
}

/* =========================
   VIDEO PROCESSING
========================= */
async function videoToText(videoPath){

  const audio = videoPath+".mp3";

  /* 1. extract audio */
  await new Promise((res,rej)=>{
    exec(`ffmpeg -i "${videoPath}" -vn -acodec mp3 "${audio}"`,err=>{
      if(err)rej(err); else res();
    });
  });

  /* 2. whisper */
  const file = fs.createReadStream(audio);

  const form = new FormData();
  form.append("file",file);
  form.append("model","whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions",{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${OPENAI_API_KEY}`
    },
    body:form
  });

  const data = await res.json();
  return data.text || "";
}

/* =========================
   EMBEDDING
========================= */
async function embed(text){

  if(!OPENAI_API_KEY) return [];

  const res = await fetch("https://api.openai.com/v1/embeddings",{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${OPENAI_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      model:"text-embedding-3-small",
      input:text
    })
  });

  const data = await res.json();
  return data?.data?.[0]?.embedding || [];
}

/* =========================
   VECTOR BUILD
========================= */
async function buildVectors(){

  VECTOR_DB=[];

  for(const d of DOCUMENTS){
    const v = await embed(d.text);
    VECTOR_DB.push({...d,vector:v});
  }

  console.log("🧠 VECTOR READY:",VECTOR_DB.length);
}

/* =========================
   COSINE
========================= */
function cosine(a,b){
  if(!a?.length||!b?.length)return 0;

  let dot=0,ma=0,mb=0;

  for(let i=0;i<a.length;i++){
    dot+=a[i]*b[i];
    ma+=a[i]**2;
    mb+=b[i]**2;
  }

  return dot/(Math.sqrt(ma)*Math.sqrt(mb)+1e-9);
}

/* =========================
   SEARCH CORE
========================= */
async function search(query){

  if(CACHE.has(query))return CACHE.get(query);

  const intent = classifyIntent(query);
  const qvec = await embed(query);

  let results=[];

  for(const d of VECTOR_DB){

    if(intent!=="general"){
      if(intent==="hygiene"&&!d.text.includes("손")&&!d.text.includes("씻"))continue;
      if(intent==="health"&&!d.text.includes("감기")&&!d.text.includes("열"))continue;
      if(intent==="safety"&&!d.text.includes("횡단"))continue;
    }

    const sim = cosine(qvec,d.vector);
    let score = sim*2;

    if(normalize(d.title).includes(normalize(query))) score+=2;

    results.push({...d,score});
  }

  results.sort((a,b)=>b.score-a.score);

  /* dedup */
  const seen=new Set();
  results=results.filter(r=>{
    const k=r.text.slice(0,50);
    if(seen.has(k))return false;
    seen.add(k);
    return true;
  });

  const top = results.slice(0,8);

  CACHE.set(query,top);

  return top;
}

/* =========================
   ANSWER (CHATGPT)
========================= */
async function answer(query,docs){

  const context = docs.map(d=>`${d.title}:${d.text}`).join("\n").slice(0,6000);

  const res = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${OPENAI_API_KEY}`,
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      model:"gpt-4o-mini",
      messages:[
        {role:"system",content:"초등학생용 AI 검색엔진. 5줄 설명."},
        {role:"user",content:`질문:${query}\n\n${context}`}
      ],
      temperature:0.3
    })
  });

  const data=await res.json();
  return data?.choices?.[0]?.message?.content || "검색 실패";
}

/* =========================
   API
========================= */
app.post("/api/chat",async(req,res)=>{

  const q=req.body.message||"";

  const docs=await search(q);
  const reply=await answer(q,docs);

  res.json({
    reply,
    results:docs.map(d=>({
      title:d.title,
      url:d.url,
      type:d.type,
      summary:d.text.slice(0,120)
    }))
  });

});

/* =========================
   INIT
========================= */
(async()=>{
  await loadFiles();
  await buildVectors();
})();

/* =========================
   AUTO RELOAD
========================= */
fs.watch(__dirname,async()=>{
  console.log("🔄 REINDEX");
  await loadFiles();
  await buildVectors();
});

/* =========================
   START
========================= */
app.listen(PORT,()=>{
  console.log("🚀 V10 MULTIMODAL GOOGLE RUNNING:",PORT);
});
