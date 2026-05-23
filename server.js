const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const pdfParse = require("pdf-parse");

const app = express();

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY =
    process.env.OPENAI_API_KEY;

/* =========================
   DATABASE
========================= */
let DOCUMENTS = [];
let VECTOR_DB = [];

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(express.json({
  limit:"50mb"
}));

app.use(express.urlencoded({
  extended:true,
  limit:"50mb"
}));

app.use(express.static(__dirname));
/* =========================
   UPLOAD
========================= */
const upload = multer({
    dest:"uploads/"
});

/* =========================
   HTML CLEAN
========================= */
function stripHtml(html){

    return html

    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,"")

    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi,"")

    .replace(/<nav[\s\S]*?>[\s\S]*?<\/nav>/gi,"")

    .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi,"")

    .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi,"")

    .replace(/로그인|회원가입|회원정보|개인정보 수정|회원탈퇴/g,"")

    .replace(/<[^>]*>/g," ")

    .replace(/\s+/g," ")

    .trim();
}

/* =========================
   NORMALIZE
========================= */
function normalize(text){

    return text
        .toLowerCase()
        .replace(/[^\w가-힣]/g," ")
        .replace(/\s+/g," ")
        .trim();
}

/* =========================
   SPLIT
========================= */
function splitParagraphs(text){

    return text
        .split(/\n\s*\n|(?<=[.!?])\s+/g)
        .map(t=>t.trim())
        .filter(t=>t.length > 25);
}

/* =========================
   TITLE
========================= */
function getTitle(html,file){

    const m =
        html.match(/<title>(.*?)<\/title>/i);

    if(m && m[1]){

        return m[1].trim();
    }

    return file.replace(".html","");
}

/* =========================
   LINK EXTRACT
========================= */
function extractLinks(html){

    const regex =
        /href=["']([^"'#]+)["']/g;

    const links = [];

    let match;

    while((match = regex.exec(html)) !== null){

        const href = match[1];

        if(href.endsWith(".html")){

            links.push(href);
        }
    }

    return [...new Set(links)];
}

/* =========================
   HTML CRAWL
========================= */
async function crawlSite(){

    const files =
        fs.readdirSync(__dirname);

    const htmlFiles =
        files.filter(f =>
            f.endsWith(".html")
        );

    for(const file of htmlFiles){

        try{

            const fullPath =
                path.join(__dirname,file);

            const html =
                fs.readFileSync(
                    fullPath,
                    "utf-8"
                );

            const clean =
                stripHtml(html);

            const title =
                getTitle(html,file);

            splitParagraphs(clean)
            .forEach(p=>{

                DOCUMENTS.push({

                    title,

                    text:p,

                    url:"/" + file,

                    type:"html"
                });

            });

            console.log(
                "크롤링:",
                file
            );

        }catch(e){

            console.log(
                "크롤 실패:",
                file
            );
        }
    }

    console.log(
        "HTML 문서:",
        DOCUMENTS.length
    );
}

/* =========================
   PDF LOAD
========================= */
async function loadPdfFiles(){

    const files =
        fs.readdirSync(__dirname);

    const pdfs =
        files.filter(f =>
            f.endsWith(".pdf")
        );

    for(const pdf of pdfs){

        try{

            const buffer =
                fs.readFileSync(
                    path.join(__dirname,pdf)
                );

            const parsed =
                await pdfParse(buffer);

            splitParagraphs(parsed.text)
            .forEach(p=>{

                DOCUMENTS.push({

                    title:
                        pdf.replace(".pdf",""),

                    text:p,

                    url:"/" + pdf,

                    type:"pdf"
                });

            });

            console.log(
                "PDF:",
                pdf
            );

        }catch(e){

            console.log(
                "PDF 실패:",
                pdf
            );
        }
    }
}

/* =========================
   VIDEO LOAD
========================= */
async function loadVideos(){

    const file =
        path.join(
            __dirname,
            "video-data.json"
        );

    if(!fs.existsSync(file)){

        console.log(
            "video-data.json 없음"
        );

        return;
    }

    try{

        const videos =
            JSON.parse(
                fs.readFileSync(
                    file,
                    "utf-8"
                )
            );

        videos.forEach(v=>{

            DOCUMENTS.push({

                title:v.title,

                text:`
${v.title}
${v.description || ""}
${v.summary || ""}
${v.education || ""}
${v.keywords || ""}
                `,

                url:v.url,

                thumbnail:
                    v.thumbnail || "",

                type:"video"
            });

        });

        console.log(
            "영상:",
            videos.length
        );

    }catch(e){

        console.log(
            "영상 로드 실패"
        );
    }
}

/* =========================
   EMBEDDING
========================= */
async function embed(text){

    if(!OPENAI_API_KEY){

        return [];
    }

    try{

        const response =
            await fetch(
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

        const data =
            await response.json();

        return data?.data?.[0]?.embedding || [];

    }catch(e){

        console.log(
            "Embedding 실패"
        );

        return [];
    }
}

/* =========================
   VECTOR
========================= */
async function rebuildVector(){

    VECTOR_DB = [];

    for(const d of DOCUMENTS){

        const vector =
            await embed(d.text);

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

        dot += a[i]*b[i];

        ma += a[i]**2;

        mb += b[i]**2;
    }

    return dot / (
        Math.sqrt(ma) *
        Math.sqrt(mb) +
        1e-9
    );
}

/* =========================
   SEARCH
========================= */
async function search(query){

    const q =
        await embed(query);

    const keywords =
        normalize(query).split(" ");

    const results =
        VECTOR_DB.map(d=>{

            let score = 0;

            if(q.length && d.vector.length){

                score += cosine(q,d.vector);
            }

            const text =
                normalize(d.text);

            keywords.forEach(k=>{

                if(
                    k &&
                    text.includes(k)
                ){
                    score += 0.45;
                }
            });

            if(
                normalize(d.title)
                .includes(normalize(query))
            ){
                score += 1;
            }

            return {
                ...d,
                score
            };

        })
        .filter(r=>r.score > 0.4)

        .sort((a,b)=>b.score-a.score)

        .slice(0,5);

    return results.map(r=>({

        title:r.title,

        summary:
            r.text
            .replace(/\s+/g," ")
            .trim()
            .slice(0,180),

        url:r.url,

        type:r.type,

        thumbnail:
            r.thumbnail || ""
    }));
}

/* =========================
   CHAT API
========================= */
app.post("/api/chat", async (req,res)=>{

    try{

        const message =
            req.body.message || "";

        const results =
            await search(message);

        if(!results.length){

            return res.json({

                reply:
                "앗 😊 아직 관련 자료가 없어요.",

                results:[]
            });
        }

        res.json({

            reply:
            "관련 자료를 찾았어요 😊",

            results
        });

    }catch(e){

        console.log(e);

        res.status(500).json({

            reply:
            "서버 연결 문제가 있어요 😢",

            results:[]
        });
    }
});

/* =========================
   FILE UPLOAD
========================= */
app.post(
    "/upload",
    upload.single("file"),
    async (req,res)=>{

        try{

            const file =
                req.file;

            if(!file){

                return res.json({
                    success:false
                });
            }

            const newPath =
                path.join(
                    __dirname,
                    file.originalname
                );

            fs.renameSync(
                file.path,
                newPath
            );

            DOCUMENTS = [];

            await crawlSite();

            await loadPdfFiles();

            await loadVideos();

            await rebuildVector();

            console.log(
                "업로드 후 재빌드 완료"
            );

            res.json({
                success:true
            });

        }catch(e){

            console.log(e);

            res.json({
                success:false
            });
        }
    }
);

/* =========================
   REALTIME WATCH
========================= */
fs.watch(
    __dirname,
    async (event,filename)=>{

        if(
            filename &&
            (
                filename.endsWith(".html") ||
                filename.endsWith(".pdf") ||
                filename.endsWith(".json")
            )
        ){

            console.log(
                "파일 변경:",
                filename
            );

            DOCUMENTS = [];

            await crawlSite();

            await loadPdfFiles();

            await loadVideos();

            await rebuildVector();

            console.log(
                "자동 업데이트 완료"
            );
        }
    }
);

/* =========================
   INIT
========================= */
(async ()=>{

    console.log("초기화 시작");

    DOCUMENTS = [];

    await crawlSite();

    await loadPdfFiles();

    await loadVideos();

    await rebuildVector();

    console.log("초기화 완료");

})();

/* =========================
   START
========================= */
app.listen(PORT,()=>{

    console.log(
        "헬시키즈 서버 실행:",
        PORT
    );
});
