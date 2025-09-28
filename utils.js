import { config } from "./config.js";

const GEMINI_API_KEY = config.GEMINI_API_KEY;


const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function requireKey() {
  if (!GEMINI_API_KEY || typeof GEMINI_API_KEY !== "string") {
    throw new Error("GEMINI_API_KEY missing or invalid in config.js");
  }
  return GEMINI_API_KEY;
}

// calls the gemini API
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

// takes in a prompt and outputs text from Gemini
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

// // takes in a source (link) and outputs True/False depending on whether the source is biased 
// export async function isInformative(source, opts = {}) {
// //   console.log("checking the following source:", source);
//   const modelName = opts.model || "gemini-2.0-flash";
//   const respond = `Here is a source website: "${source}" Please evauluate if the source is purely informational. If the source contains biased language, then reply with "false". If the source is informative, then reply with "true". If the source comes from social media domains such as facebook, snapchat, twitter, instagram, X, etc., then assume "false"`;
//   const data = await generateContentREST(modelName, {
//     contents: [{ role: "user", parts: [{ text: respond }]}],
//   });
//   const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
//   if (!text) throw new Error("No text returned from Gemini");

// //   console.log(`source: ${source}, isInformative? ${text}`);
//   return text;
// }


// searchResults is an array of items from the Google Search API
export async function rankAndSelectBestSources(searchResults, opts = {}) {
    console.log(`Gemini is ranking through ${searchResults.length} sources...`);
    if (!searchResults || searchResults.length === 0) {
        return []; 
    }

    const formattedSourceList = searchResults
        .map((item, index) => `${index + 1}. ${item.link}`)
        .join('\n');

    const modelName = opts.model || "gemini-2.0-flash"; 

    const respond = `
        You are an unbiased, well-informed researcher. You will be given a list of website URLs and a user's quote. Your task is to analyze the sources and 
        identify the top 10 most credible sources that are directly relevant to the quote's central claim. If there are not 10 releveant sources, return as many as you can find.

        First, in your own words, state the specific claim the user's quote is making. This will be your lens for evaluating the sources.

        Here are the rules for your evaluation:
        1. Prioritize Strict Relevance: A source is only relevant if it discusses the exact same subject and claim as the quote. It must address 
        the quote's meaning, not just its keywords. For example, if the quote is "cats are allergic" (implying cats can have allergies), an article about 
        "humans being allergic to cats" is NOT relevant and must be disqualified.
        2. Prioritize Credibility: News agencies (like AP, Reuters, BBC), academic journals, and research institutions are the most credible.
        3. Penalize Bias: Sources with strong emotional or biased language should be ranked lower.
        4. Reject Social Media: Automatically disqualify any sources from social media domains (Facebook, Twitter, X, Reddit, Instagram, etc.).

        After analyzing all sources, respond with ONLY a single JSON object. Do not include any other text or markdown formatting. The JSON object should contain a single key, "best_sources", which is an array of the top 10 sources, ranked from best to worst.

        Each object in the "best_sources" array should have the following structure:
        {
        "rank": The numerical rank (1-10),
        "source": The original URL of the source,
        "reasoning": "A brief, one-sentence explanation for why this source was chosen and considered credible."
        }

        Here is the list of sources to analyze:
        ${formattedSourceList}
    `;

    console.log("Sending the prompt to Gemini");
    const data = await generateContentREST(modelName, {
        contents: [{ role: "user", parts: [{ text: respond }]}],
    });

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) {
        console.error("No text returned from Gemini");
        return [];
    }

    // raw response from gemini has extra text, so need to extract only the JSON part 
    try {
        // start and end of the json object start/end with curly brackets  
        const startIndex = text.indexOf('{');
        const endIndex = text.lastIndexOf('}');

        if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
            throw new Error("No valid JSON object found in the response.");
        }

        // slice based on the curly brackets 
        const jsonString = text.slice(startIndex, endIndex + 1);

        const result = JSON.parse(jsonString);

        console.log("best results:", result);
        return result.best_sources || [];

    } catch (error) {
        console.error("Error parsing JSON response from Gemini:", error);
        // It's helpful to log the original text for debugging
        console.error("Original text from Gemini:", text); 
        return [];
    }
}

