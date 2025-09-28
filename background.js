import { config } from "./config.js";
import { isInformative } from "./utils.js";
const GOOGLE_API_KEY = config.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID_BROAD = config.SEARCH_ENGINE_ID_BROAD;
const SEARCH_ENGINE_ID_SPECIFIC = config.SEARCH_ENGINE_ID_SPECIFIC;

async function verifyQuote(quote, engineId, numEntries) {
  const query = encodeURIComponent(quote);
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${engineId}&q=${query}&num=${numEntries}`;

  try {
    const response = await fetch(url); 
    if (!response.ok) {
      console.error("API request failed:", response.status, response.statusText);
      console.log("URL: ", url);
      return { result: "error", message: "API request failed"};
    }

    const data = await response.json(); 
    if (data.searchInformation.totalResults == "0") {
      return { result: "error", message: "No results found"};
    } else {
      console.log("Found results:", data.items);
      console.log(data.items[0].link);
      // const trueSrcs = [];
      // for (let i = 0; i < data.items.length; i++) {
      //   if (isInformative(data.items[i].link) === "true") {

      //   }
        
      // }
      

      return { result: "success", items: data.items };
    } 
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

  return { credible: credibleResults, general: generalResults };
}


// listen for messages from the pop up 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action == "detectMisinformation") {
    fetchAllSources(message.quote).then(sendResponse);
    return true; 
  }
});