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

    /* 제거 */
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,"")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi,"")
    .replace(/<nav[\s\S]*?>[\s\S]*?<\/nav>/gi,"")
    .replace(/<header[\s\S]*?>[\s\S]*?<\/header>/gi,"")
    .replace(/<footer[\s\S]*?>[\s\S]*?<\/footer>/gi,"")

    /* 메뉴 제거 */
    .replace(
        /로그인|회원가입|회원정보|개인정보 수정|회원탈퇴|Q&A|공지사항|놀이학습자료|다운로드|영상보기|진행중인 영상|자주 묻는 질문|문의|자료 다운로드/gi,
        ""
    )

    /* html 제거 */
    .replace(/<[^>]*>/g," ")

    /* 공백 정리 */
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
        .filter(t=>

            t.length > 40 &&

            !t.includes("로그인") &&
            !t.includes("회원가입") &&
            !t.includes("회원탈퇴") &&
            !t.includes("개인정보") &&
            !t.includes("Q&A") &&
            !t.includes("공지사항")
        );
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
   HTML CRAWL
========================= */
async function crawlSite(){

    const files =
        fs.readdirSync(__dirname);

    const htmlFiles =
        files.filter(f=>
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

            const paragraphs =
                splitParagraphs(clean);

            paragraphs.forEach(p=>{

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
        files.filter(f=>
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

            if(
                q.length &&
                d.vector.length
            ){

                score +=
                    cosine(q,d.vector);
            }

            const text =
                normalize(d.text);

            keywords.forEach(k=>{

                if(
                    k &&
                    text.includes(k)
                ){

                    score += 0.7;
                }
            });

            if(
                normalize(d.title)
                .includes(normalize(query))
            ){

                score += 1.5;
            }

            return {
                ...d,
                score
            };

        })

        .filter(r=>r.score > 0.8)

        .sort((a,b)=>
            b.score - a.score
        )

        .slice(0,5);

    return results;
}

/* =========================
   GPT RESPONSE
========================= */
async function generateAIResponse(
    query,
    docs
){

    try{

        const context =
            docs
            .map(d=>`
제목:
${d.title}

내용:
${d.text}
            `)
            .join("\n\n");

        const response =
            await fetch(
                "https://api.openai.com/v1/chat/completions",
                {
                    method:"POST",

                    headers:{
                        "Content-Type":"application/json",
                        "Authorization":
                        `Bearer ${OPENAI_API_KEY}`
                    },

                    body:JSON.stringify({

                        model:"gpt-4o-mini",

                        messages:[

                            {
                                role:"system",

                                content:`
너는 어린이 건강교육 AI야.

규칙:
- 질문과 관련된 내용만 설명
- 관련 없는 내용 절대 금지
- 핵심만 자연스럽게 요약
- 메뉴/네비게이션 문구 제거
- 어린이가 이해하기 쉽게 설명
- 5줄 이하로 답변
                                `
                            },

                            {
                                role:"user",

                                content:`
질문:
${query}

자료:
${context}

질문과 관련된 내용만
짧고 자연스럽게
설명해줘.
                                `
                            }
                        ],

                        temperature:0.3,

                        max_tokens:300
                    })
                }
            );

        const data =
            await response.json();

        return data
            ?.choices?.[0]
            ?.message?.content
            ?.trim()
            ||
            "관련 자료를 찾았어요 😊";

    }catch(e){

        console.log(
            "GPT 실패:",
            e
        );

        return
        "AI 요약 생성 실패 😢";
    }
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

        /* GPT 요약 */
        const aiReply =
            await generateAIResponse(
                message,
                results
            );

        /* 결과 반환 */
        res.json({

            reply:aiReply,

            results:results.map(r=>({

                title:r.title,

                url:r.url,

                type:r.type,

                thumbnail:
                    r.thumbnail || ""
            }))
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

    console.log(
        "초기화 시작"
    );

    DOCUMENTS = [];

    await crawlSite();
    await loadPdfFiles();
    await loadVideos();
    await rebuildVector();

    console.log(
        "초기화 완료"
    );

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
