import { config } from "./config.js";
import { generateText, rankAndSelectBestSources } from "./utils.js";
const GOOGLE_API_KEY = config.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID_BROAD = config.SEARCH_ENGINE_ID_BROAD;
const SEARCH_ENGINE_ID_SPECIFIC = config.SEARCH_ENGINE_ID_SPECIFIC;


async function verifyQuote(quote, engineId, numToFetch, startIndex) {
    const query = encodeURIComponent(quote);
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${engineId}&q=${query}&num=${numToFetch}&start=${startIndex}`;

    try {
      const response = await fetch(url); 
      if (!response.ok) {
        console.error("API request failed:", response.status, response.statusText);
        console.log("URL: ", url);
        return { result: "error", message: "API request failed"};
      }

      const data = await response.json(); 
      if (!data.items || data.items.length === 0) {
        console.log("No more results from the API found. Will stop search now.");
        return { result: "error", message: "No results found" };
      } 

      return { result: "success", items: data.items };
    } catch (error) {
      console.error("Error during fetch:", error);
      return { result: "error", message: "Fetch error"};
    }
}

// search through both engines in parallel 
async function fetchAllSources(quote) {
  console.log("Beginning parallel searches for quote:", quote);
  
  const [credibleResults, generalResults] = await Promise.all([
    verifyQuote(quote, SEARCH_ENGINE_ID_SPECIFIC, 10), 
    verifyQuote(quote, SEARCH_ENGINE_ID_BROAD, 5)
  ]);

  console.log(`Credible results found: ${credibleResults}\nGeneral results found: ${generalResults}`);

  return { credible: credibleResults, general: generalResults };
}


// fetches 50 search results by making five API calls 
async function fetchAllResults(quote, engineId) {
  const promises = [];
  const numResultsPerPage = 10;
  const totalResultsToFetch = 50;

  // array of promises for each API call 
  for (let i = 1; i < totalResultsToFetch; i += numResultsPerPage) { // 1-indexed 
    promises.push(verifyQuote(quote, engineId, numResultsPerPage, i));
  }

  // run all API calls in parallel 
  const pageResults = await Promise.all(promises);

  // combine everything into one array 
  const allItems = pageResults
    .filter(page => page.result === 'success') 
    .flatMap(page => page.items);            

  console.log(`Fetched a total of ${allItems.length} results.`);
  return allItems;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "detectMisinformation") {
    const performAnalysis = async () => {
      // fetch 50 results from the specific search engine
      const allSearchResults = await fetchAllResults(message.quote, SEARCH_ENGINE_ID_SPECIFIC);

      // rank and select best credible sources (using gemini)
      if (allSearchResults.length > 0) {
        const bestCredibleSources = await rankAndSelectBestSources(message.quote, allSearchResults);
        generateText(message, bestCredibleSources);
        sendResponse({ result: "success", sources: bestCredibleSources });
      } else {
        sendResponse({ result: "error", message: "No search results found." });
      }
    };

    performAnalysis();
    
    return true;
  }
  
});