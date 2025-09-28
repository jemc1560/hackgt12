import os
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import google.generativeai as genai
from dotenv import load_dotenv

# --- Load env file ---
load_dotenv()

# Debug log (only show first 6 chars of key for safety)
key = os.getenv("GEMINI_API_KEY")
print("Gemini key loaded:", key[:6] + "..." if key else None)

# --- Flask Setup ---
app = Flask(__name__)
CORS(app)  # allow extension calls

# --- Config ---
NEWS_API_KEY = os.getenv("GNEWS_API_KEY")
NEWS_URL = "https://gnews.io/api/v4/search"

# Gemini API key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# Bias words for quick detection
BIAS_WORDS = [
    "shocking", "disaster", "chaos", "crisis", "unprecedented",
    "slam", "slammed", "furious", "outrage", "explosive",
    "catastrophic", "rigged", "fake", "corrupt", "witch hunt"
]

# --- AI Summary with Gemini ---
def gemini_summary(selected_text: str, sources: list) -> str:
    print("🔹 Gemini called with text:", selected_text)  # Debug log

    if not sources:
        sources_block = "(no sources provided, summarize text directly)"
    else:
        lines = [f"- {s.get('title','Untitled')} ({s.get('url','')})" for s in sources[:3]]
        sources_block = "\n".join(lines)

    prompt = (
        "You are a neutral news summarizer. Write 3–4 concise factual sentences. "
        "Do not use persuasive or biased words. If sources are given, rely only on them. "
        "If no sources, summarize the highlighted text directly.\n\n"
        f"Highlighted text: {selected_text}\n\nSources:\n{sources_block}"
    )

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print("Gemini error:", e)
        return f"Gemini summary unavailable: {e}"

# --- Flask Route ---
@app.route("/check", methods=["POST"])
def check():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    sources = []

    # --- Clean query for APIs ---
    query = re.sub(r"[^a-zA-Z0-9\s]", "", text)  # strip punctuation
    query = query[:60]  # shorter, avoids 400 errors

    # --- Try GNews first ---
    if NEWS_API_KEY and query:
        try:
            print(f"Using GNews (query: {query})")
            params = {"q": query, "lang": "en", "token": NEWS_API_KEY, "max": 3}
            r = requests.get(NEWS_URL, params=params, timeout=8)
            r.raise_for_status()
            articles = r.json().get("articles", []) or []

            for a in articles:
                sources.append({
                    "title": a.get("title", "Untitled"),
                    "url": a.get("url", "#")
                })
        except Exception as e:
            print("GNews lookup failed:", e)

    # --- Fallback: Google Custom Search ---
    if not sources and os.getenv("GOOGLE_API_KEY") and os.getenv("SEARCH_ENGINE_ID"):
        try:
            google_url = "https://www.googleapis.com/customsearch/v1"

            # Wrap short phrases in quotes for exact match
            search_query = f"\"{query}\"" if len(query.split()) <= 6 else query

            params = {
                "key": os.getenv("GOOGLE_API_KEY"),
                "cx": os.getenv("SEARCH_ENGINE_ID"),
                "q": search_query,
                # comment out siteSearch for testing:
                # "siteSearch": "gov.edu.org",
                # "siteSearchFilter": "i"
            }

            r = requests.get(google_url, params=params, timeout=8)
            r.raise_for_status()
            items = r.json().get("items", []) or []

            # If no results, retry without quotes
            if not items and search_query.startswith('"'):
                params["q"] = query
                r = requests.get(google_url, params=params, timeout=8)
                r.raise_for_status()
                items = r.json().get("items", []) or []

            for it in items[:3]:
                sources.append({
                    "title": it.get("title", "Untitled"),
                    "url": it.get("link", "#")
                })
        except Exception as e:
            print("Google Search lookup failed:", e)


    # --- Always try Gemini (with or without sources) ---
    summary = gemini_summary(text, sources)

    # --- Bias detection ---
    lowered = text.lower()
    found = [w for w in BIAS_WORDS if w in lowered]
    bias_output = ", ".join(found) if found else "No strong bias words detected."

    # If no sources were found, add a placeholder
    if not sources:
        sources.append({
            "title": "No external sources found",
            "url": "#"
        })

    return jsonify({
        "selected_text": text,
        "summary": summary,
        "bias_notes": bias_output,
        "sources": sources or []  # Always return an array
    })

# --- Run App ---
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8080, debug=True)
