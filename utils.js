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
export async function generateText(userPrompt, analysisObject, opts = {}) {
  const modelName = opts.model || "gemini-2.0-flash";
  const verdict = analysisObject.finalVerdict;
  const reasoning = analysisObject.finalVerdict.summary; 

  const finalPrompt = `
    You are a helpful analyst that writes clear and concise summaries. 
    Based on the following pre-conducted analysis, write a friendly, easy-to-read summary paragraph for an end-user.

    - The summary should be a maximum of 200 words and should include the quote claim: "${analysisObject.quoteClaim}"
    - The summary should be objective and unbiased.
    - Start by stating the verdict on the user's quote.
    - Then, incorporate the key reasoning.
    - Do not sound robotic; write in a natural, informative tone.

    Here is the analysis to summarize:
    - User's Quote: "${userPrompt}"
    - Verdict: "${verdict}"
    - Key Reasoning: "${reasoning}"
  `;

  const data = await generateContentREST(modelName, {
    contents: [{ role: "user", parts: [{ text: finalPrompt }]}],
  });
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
  if (!text) throw new Error("No text returned from Gemini");
  
  return text.trim();
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
export async function rankAndSelectBestSources(userQuote, searchResults, opts = {}) {
    console.log(`Gemini is ranking through ${searchResults.length} sources...`);
    if (!searchResults || searchResults.length === 0) {
        return []; 
    }
    // format the sources for the prompt
    const sourcesForPrompt = searchResults.map(item => ({
        url: item.link, 
        title: item.title,
        snippet: item.snippet
    }));

    const formattedSourceList = JSON.stringify(sourcesForPrompt, null, 2);

    const modelName = opts.model || "gemini-2.0-flash"; 

    const respond = `
        You are a meticulous, unbiased fact-checking analyst. You will be given a user's quote and a list of sources, each with a URL, title, and snippet from a 
        web search. Your task is to perform a complete analysis and respond with a single JSON object, with no other text. The JSON object must have the following 
        top-level keys: quoteClaim, finalVerdict, and supportingSources.

        Instructions:
        Analyze the Quote: First, determine the specific, falsifiable claim the user's quote is making. Put this analysis in the quoteClaim field in your own words.

        Analyze the Sources: Evaluate each provided source based on its title, snippet, and actual content. Go visit the link and read the article. Use these rules:
        1. Strict Relevance: The source must address the exact claim in quoteClaim. For example, if the claim is that cats can have allergies, a source about humans being allergic to cats is not relevant.
        2. Credibility: News agencies (AP, Reuters, BBC), academic journals, and research institutions are most credible.
        3. Bias: Penalize sources with emotional or biased language.
        4. Rejection: Disqualify all social media.

        Synthesize and Conclude: After analyzing the sources, synthesize the information from the most relevant and credible ones to form a conclusion about the 
        quoteClaim. This conclusion goes in the finalVerdict field and should include:
        A verdict from one of these options: "Factual", "Mostly Factual", "Misleading / Lacks Context", "Mostly False", "False", or "Unverifiable".

        A summary explaining your reasoning in one or two sentences.

        List Evidence: Populate the \`supportingSources\` array with the top sources (up to 10) that you used to reach your verdict, ranked from best to worst. 
        **If you find fewer than 10 relevant and credible sources, return only those that meet the criteria.**

        JSON Output Structure:
        JSON
        {
            "quoteClaim": "The specific claim the user's quote is making.",
            "finalVerdict": {
                "verdict": "Factual",
                "summary": "This is the summary of why the verdict was reached, based on the best sources."
            },
            "supportingSources": [
                {
                    "rank": 1,
                    "source": "The original URL of the best source.",
                    "title": "The original title of the source.",
                    "reasoning": "A brief explanation of why this source is relevant and credible."
                }
            ]
        }
        The User's Quote is: ${userQuote}

        Here is the list of sources to analyze (as a JSON array):
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
        return result || [];

    } catch (error) {
        console.error("Error parsing JSON response from Gemini:", error);
        // It's helpful to log the original text for debugging
        console.error("Original text from Gemini:", text); 
        return [];
    }
}

