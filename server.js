const http = require("http");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

/* =========================
   DATABASE
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   HTML CLEAN
========================= */
function stripHtml(html){

  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================
   TEXT SPLIT
========================= */
function splitParagraphs(text){

  return text
    .split(/\n\s*\n|(?<=[.!?])\s+/g)
    .map(t => t.trim())
    .filter(t => t.length > 15);
}

/* =========================
   LINK EXTRACT
========================= */
function extractLinks(html){

  const regex = /href=["']([^"'#]+)["']/g;

  const links = [];

  let match;

  while((match = regex.exec(html)) !== null){

    const href = match[1];

    if(
      href.endsWith(".html") ||
      href.includes(".html?")
    ){

      links.push(
        href.split("?")[0]
      );
    }
  }

  return [...new Set(links)];
}

/* =========================
   HTML TITLE
========================= */
function getTitle(html, fallback){

  const m = html.match(/<title>(.*?)<\/title>/i);

  if(m && m[1]){

    return m[1].trim();
  }

  return fallback.replace(".html","");
}

/* =========================
   AUTO SITE CRAWLER
========================= */
async function crawlSite(start="index.html"){

  DOCUMENTS = [];

  const visited = new Set();

  async function crawl(file){

    try{

      if(visited.has(file)) return;

      visited.add(file);

      const fullPath = path.join(__dirname, file);

      if(!fs.existsSync(fullPath)) return;

      const html = fs.readFileSync(
        fullPath,
        "utf-8"
      );

      const clean = stripHtml(html);

      const title = getTitle(
        html,
        file
      );

      splitParagraphs(clean)
      .forEach((p)=>{

        DOCUMENTS.push({

          title,

          text:p,

          url:"/" + file,

          type:"html"
        });

      });

      console.log("크롤링 완료:", file);

      const links = extractLinks(html);

      for(const link of links){

        await crawl(link);
      }

    }catch(e){

      console.log("크롤 실패:", file);
    }
  }

  await crawl(start);

  console.log("HTML 문서:", DOCUMENTS.length);
}

/* =========================
   PDF LOAD
========================= */
async function loadPdfFiles(){

  const files = fs.readdirSync(__dirname);

  const pdfs = files.filter(f =>
    f.endsWith(".pdf")
  );

  for(const pdf of pdfs){

    try{

      const buffer = fs.readFileSync(
        path.join(__dirname,pdf)
      );

      const parsed = await pdfParse(buffer);

      splitParagraphs(parsed.text)
      .forEach((p)=>{

        DOCUMENTS.push({

          title:pdf.replace(".pdf",""),

          text:p,

          url:"/" + pdf,

          type:"pdf"
        });

      });

      console.log("PDF 로드:", pdf);

    }catch(e){

      console.log("PDF 실패:", pdf);
    }
  }
}

/* =========================
   VIDEO LOAD
========================= */
async function loadVideos(){

  const file = path.join(
    __dirname,
    "video-data.json"
  );

  if(!fs.existsSync(file)){

    console.log("video-data.json 없음");

    return;
  }

  try{

    const videos = JSON.parse(
      fs.readFileSync(file,"utf-8")
    );

    videos.forEach(v=>{

      DOCUMENTS.push({

        title:v.title,

        text:`
영상 제목:
${v.title}

영상 설명:
${v.description || ""}

영상 요약:
${v.summary || ""}

교육 내용:
${v.education || ""}

키워드:
${v.keywords || ""}
        `,

        url:v.url,

        thumbnail:v.thumbnail || "",

        type:"video"
      });

    });

    console.log(
      "영상 데이터:",
      videos.length
    );

  }catch(e){

    console.log("영상 데이터 실패");
  }
}

/* =========================
   EMBEDDING
========================= */
async function embed(text){

  if(!OPENAI_API_KEY){

    console.log("OPENAI_API_KEY 없음");

    return [];
  }

  try{

    const res = await fetch(
      "https://api.openai.com/v1/embeddings",
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json",
          "Authorization":
            `Bearer ${OPENAI_API_KEY}`
        },

        body:JSON.stringify({

          model:"text-embedding-3-small",

          input:text
        })
      }
    );

    const data = await res.json();

    if(data.error){

      console.log(data.error);

      return [];
    }

    return data?.data?.[0]?.embedding || [];

  }catch(e){

    console.log("Embedding 실패");

    return [];
  }
}

/* =========================
   VECTOR BUILD
========================= */
async function rebuildVector(){

  VECTOR_DB = [];

  for(const d of DOCUMENTS){

    const vector = await embed(d.text);

    VECTOR_DB.push({
      ...d,
      vector
    });
  }

  console.log(
    "벡터 생성:",
    VECTOR_DB.length
  );
}

/* =========================
   COSINE
========================= */
function cosine(a,b){

  if(!a.length || !b.length){

    return 0;
  }

  let dot = 0;
  let ma = 0;
  let mb = 0;

  for(let i=0;i<a.length;i++){

    dot += a[i] * b[i];

    ma += a[i] ** 2;

    mb += b[i] ** 2;
  }

  return dot / (
    Math.sqrt(ma) *
    Math.sqrt(mb) +
    1e-9
  );
}

/* =========================
   KOREAN CLEAN
========================= */
function normalize(text){

  return text
    .toLowerCase()
    .replace(/[^\w가-힣]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

/* =========================
   SEARCH
========================= */
async function search(query){

  const q = await embed(query);

  const normalizedQuery =
    normalize(query);

  const keywords =
    normalizedQuery.split(" ");

  const results = VECTOR_DB.map(d=>{

    let score = 0;

    /* 의미 기반 */
    if(q.length && d.vector.length){

      score += cosine(q,d.vector);
    }

    /* 키워드 기반 */
    const docText =
      normalize(d.text);

    keywords.forEach(k=>{

      if(
        k &&
        docText.includes(k)
      ){
        score += 0.35;
      }
    });

    return {
      ...d,
      score
    };

  })
  .filter(r => r.score > 0.2)
  .sort((a,b)=>b.score-a.score)
  .slice(0,6);

  return results.map(r=>({

    title:r.title,

    summary:
      r.text
        .replace(/\s+/g," ")
        .trim()
        .slice(0,260),

    url:r.url,

    type:r.type,

    thumbnail:r.thumbnail || ""
  }));
}

/* =========================
   SAFE JSON
========================= */
function safeJSON(text,fallback){

  try{

    return JSON.parse(text);

  }catch{

    const m =
      text.match(/\{[\s\S]*\}/);

    if(!m) return fallback;

    try{

      return JSON.parse(m[0]);

    }catch{

      return fallback;
    }
  }
}

/* =========================
   AI SUMMARY
========================= */
async function summarize(query, results){

  if(!results.length){

    return {

      reply:
        "앗 😊 아직 등록되지 않은 자료예요. 다른 키워드로 다시 찾아볼까요?",

      results:[]
    };
  }

  if(!GROQ_API_KEY){

    return {

      reply:"자료를 찾았어요 😊",

      results
    };
  }

  const context =
    results.map(r=>`

제목:
${r.title}

내용:
${r.summary}

링크:
${r.url}

타입:
${r.type}

    `).join("\n");

  try{

    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method:"POST",

        headers:{
          "Content-Type":"application/json",
          "Authorization":
            `Bearer ${GROQ_API_KEY}`
        },

        body:JSON.stringify({

          model:"llama-3.1-70b-versatile",

          temperature:0.4,

          messages:[

            {
              role:"system",

              content:`

너는 유치원 선생님과 아이들을 도와주는
따뜻한 헬시키즈 AI야.

반드시 지켜:

1. 말투는 아주 부드럽고 친절하게
2. 아이들도 이해할 수 있게 쉽게 설명
3. 실제 자료만 사용
4. 없는 내용은 지어내지 말기
5. 결과를 3~4줄 정도로 자연스럽게 요약
6. 영상이면 영상 내용도 설명
7. JSON만 출력

출력 형식:

{
  "reply":"",
  "results":[
    {
      "title":"",
      "summary":"",
      "url":"",
      "type":""
    }
  ]
}

              `
            },

            {
              role:"user",

              content:`

질문:
${query}

자료:
${context}

              `
            }
          ]
        })
      }
    );

    const data = await res.json();

    return safeJSON(
      data?.choices?.[0]?.message?.content,
      {

        reply:"자료를 찾았어요 😊",

        results
      }
    );

  }catch(e){

    console.log("Groq 실패");

    return {

      reply:"자료를 찾았어요 😊",

      results
    };
  }
}

/* =========================
   PIPELINE
========================= */
async function pipeline(message){

  const results =
    await search(message);

  return await summarize(
    message,
    results
  );
}

/* =========================
   REALTIME UPDATE
========================= */
fs.watch(
  __dirname,
  async (event, filename)=>{

    if(
      filename &&
      (
        filename.endsWith(".html") ||
        filename.endsWith(".pdf") ||
        filename.endsWith(".json") ||
        filename.endsWith(".mp4")
      )
    ){

      console.log(
        "파일 변경:",
        filename
      );

      try{

        await crawlSite();

        await loadPdfFiles();

        await loadVideos();

        await rebuildVector();

        console.log(
          "자동 업데이트 완료"
        );

      }catch(e){

        console.log(
          "자동 업데이트 실패"
        );
      }
    }
  }
);

/* =========================
   MIME
========================= */
function getContentType(file){

  if(file.endsWith(".html"))
    return "text/html";

  if(file.endsWith(".js"))
    return "application/javascript";

  if(file.endsWith(".css"))
    return "text/css";

  if(file.endsWith(".png"))
    return "image/png";

  if(file.endsWith(".jpg"))
    return "image/jpeg";

  if(file.endsWith(".pdf"))
    return "application/pdf";

  if(file.endsWith(".json"))
    return "application/json";

  if(file.endsWith(".mp4"))
    return "video/mp4";

  return "text/plain";
}

/* =========================
   SERVER
========================= */
const server = http.createServer(
  async (req,res)=>{

    const url =
      req.url.split("?")[0];

    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type"
    );

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,OPTIONS"
    );

    if(req.method === "OPTIONS"){

      res.writeHead(204);

      return res.end();
    }

    /* =========================
       CHAT API
    ========================= */
    if(url === "/api/chat"){

      let body = "";

      req.on("data",chunk=>{

        body += chunk;
      });

      req.on("end", async ()=>{

        try{

          const parsed =
            JSON.parse(body);

          const message =
            parsed.message || "";

          const result =
            await pipeline(message);

          res.writeHead(200,{
            "Content-Type":
              "application/json"
          });

          res.end(
            JSON.stringify(result)
          );

        }catch(e){

          console.log(e);

          res.writeHead(500,{
            "Content-Type":
              "application/json"
          });

          res.end(JSON.stringify({

            reply:
              "서버 연결에 문제가 있어요 😢",

            results:[]
          }));
        }
      });

      return;
    }

    /* =========================
       STATIC FILE
    ========================= */
    const filePath =
      url === "/"
      ? path.join(
          __dirname,
          "index.html"
        )
      : path.join(
          __dirname,
          url
        );

    fs.readFile(
      filePath,
      (err,data)=>{

        if(err){

          res.writeHead(404);

          return res.end(
            "페이지를 찾을 수 없어요"
          );
        }

        res.writeHead(200,{
          "Content-Type":
            getContentType(filePath)
        });

        res.end(data);
      }
    );
  }
);

/* =========================
   INIT
========================= */
(async ()=>{

  console.log("초기화 시작");

  await crawlSite();

  await loadPdfFiles();

  await loadVideos();

  await rebuildVector();

  console.log("초기화 완료");

})();

/* =========================
   START
========================= */
server.listen(PORT, ()=>{

  console.log(
    "헬시키즈 서버 실행:",
    PORT
  );
});
