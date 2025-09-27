import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import google.generativeai as genai

app = Flask(__name__)
CORS(app)  # allow extension calls

# --- Config ---
NEWS_API_KEY = "4d7b44d8e7c0f1a4d4ad654f94c78de2"   # GNews API key
NEWS_URL = "https://gnews.io/api/v4/search"

# Gemini API key (⚠️ DO NOT PUSH TO GITHUB)
GEMINI_API_KEY = "AlzaSyAZFTm4gwK7FtXyKanBABSIlHylhnO7hPA0"
genai.configure(api_key=GEMINI_API_KEY)

# Bias words for quick detection
BIAS_WORDS = [
    "shocking", "disaster", "chaos", "crisis", "unprecedented",
    "slam", "slammed", "furious", "outrage", "explosive",
    "catastrophic", "rigged", "fake", "corrupt", "witch hunt"
]

# --- AI Summary with Gemini ---
def gemini_summary(selected_text: str, sources: list) -> str:
    if not sources:
        return "No sources to summarize."

    # format sources
    lines = [f"- {s.get('title','Untitled')} ({s.get('url','')})" for s in sources[:3]]
    sources_block = "\n".join(lines)

    prompt = (
        "You are a neutral news summarizer. Write 3–4 concise factual sentences. "
        "Do not use persuasive or biased words. Only rely on the following sources.\n\n"
        f"Highlighted text: {selected_text}\n\nSources:\n{sources_block}"
    )

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"Gemini summary unavailable: {e}"

# --- Flask Route ---
@app.route("/check", methods=["POST"])
def check():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    sources = []
    summary = "No summary available."

    # Query GNews API
    if NEWS_API_KEY and text:
        try:
            params = {"q": text[:180], "lang": "en", "token": NEWS_API_KEY, "max": 3}
            r = requests.get(NEWS_URL, params=params, timeout=8)
            r.raise_for_status()
            articles = r.json().get("articles", []) or []

            for a in articles:
                sources.append({"title": a.get("title", "Untitled"), "url": a.get("url", "#")})

            if sources:
                summary = gemini_summary(text, sources)
            else:
                summary = "No closely related sources found."
        except Exception as e:
            summary = f"News lookup failed: {e}"

    # Bias detection
    lowered = text.lower()
    found = [w for w in BIAS_WORDS if w in lowered]
    bias_output = ", ".join(found) if found else "No strong bias words detected."

    return jsonify({
        "selected_text": text,
        "summary": summary,
        "bias_notes": bias_output,
        "sources": sources
    })

# --- Run App ---
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

