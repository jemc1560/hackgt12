import { config } from "./config.js";

const GOOGLE_API_KEY = config.GOOGLE_API_KEY;
const SEARCH_ENGINE_ID = config.SEARCH_ENGINE_ID;

async function verifyQuote(quote) {
  // const query = encodeURIComponent(`"${quote}"`);
  const query = encodeURIComponent(quote);
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${query}`;

  try {
    const response = await fetch(url); 
    if (!response.ok) {
      console.error("API request failed:", response.status, response.statusText);
      return { result: "error", message: "API request failed"};
    }
    const data = await response.json(); 
    if (data.searchInformation.totalResults == "0") {
      return { result: "error", message: "No results found"};
    } else {
      console.log("Found results:", data.items);
      return { result: "success", items: data.items };
    } 
  } catch (error) {
    console.error("Error during fetch:", error); 
    return { result: "error", message: "Fetch error"};
  }
}

// listen for messages from the pop up 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action == "detectMisinformation") {
    console.log("Received quote to verify:", message.quote);
    verifyQuote(message.quote).then(sendResponse);
    return true; 
  }
});