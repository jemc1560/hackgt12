import { GEMINI_API_KEY } from "./config.js";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function requireKey() {
  if (!GEMINI_API_KEY || typeof GEMINI_API_KEY !== "string") {
    throw new Error("GEMINI_API_KEY missing or invalid in config.js");
  }
  return GEMINI_API_KEY;
}

async function generateContentREST(modelName, body) {
  const key = requireKey();
  const url = `${BASE_URL}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const msg = err?.error?.message || `${res.status} ${res.statusText}`;
    throw new Error(`Gemini API error: ${msg}`);
  }
  return res.json();
}

export async function generateText(prompt, opts = {}) {
  const modelName = opts.model || "gemini-2.0-flash";
  const finalPrompt = `I am curious about this quote: "${prompt}" Please explain the context, what happened, and provide balanced, verifiable details.`;
  const data = await generateContentREST(modelName, {
    contents: [{ role: "user", parts: [{ text: finalPrompt }]}],
  });
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
  if (!text) throw new Error("No text returned from Gemini");
  return text;
}
