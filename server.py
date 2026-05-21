from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

# ================================
# Flask 앱 생성
# ================================

app = Flask(__name__)

# CORS 허용
CORS(app)

# ================================
# OpenAI API 연결
# ================================

client = OpenAI(

    # 본인 API 키 입력
    api_key="YOUR_OPENAI_API_KEY"
)

# ================================
# 챗봇 API
# ================================

@app.route("/chat", methods=["POST"])

def chat():

    try:

        # 프론트에서 보낸 데이터 받기
        data = request.json

        user_message = data.get("prompt", "")

        # ================================
        # GPT 요청
        # ================================

        response = client.chat.completions.create(

            model="gpt-4.1-mini",

            messages=[

                {
                    "role": "system",

                    "content": """

                    너는 어린이 건강교육 사이트 AI 챗봇이다.

                    사용자의 질문에 대해:

                    1. 친절한 답변
                    2. 연관검색어 3개
                    3. 관련 메뉴 추천

                    을 JSON 형식으로 제공해라.

                    메뉴는 아래 중에서만 추천 가능하다.

                    - 위생안전 → /hygiene.html
                    - 실외안전 → /outdoor.html
                    - 생활건강 → /health.html
                    - 질병예방 → /disease.html
                    - 놀이자료 다운로드 → /play.html
                    - 안전수칙자료 다운로드 → /safety.html
                    - Q&A → /qna.html

                    반드시 아래 JSON 형식으로만 답해라.

                    {
                      "reply": "...",
                      "related": ["...", "...", "..."],
                      "menus": [
                        {
                          "title": "...",
                          "description": "...",
                          "url": "..."
                        }
                      ]
                    }

                    """
                },

                {
                    "role": "user",

                    "content": user_message
                }
            ]
        )

        # GPT 응답 가져오기
        result = response.choices[0].message.content

        # 문자열 → JSON 변환
        import json

        parsed_result = json.loads(result)

        # 프론트로 반환
        return jsonify(parsed_result)

    except Exception as e:

        print(e)

        return jsonify({

            "reply": "죄송합니다 😢 AI 응답 생성 중 오류가 발생했어요.",

            "related": [],

            "menus": []
        })


# ================================
# 서버 실행
# ================================

if __name__ == "__main__":

    app.run(

        debug=True,

        host="0.0.0.0",

        port=5000
    )
