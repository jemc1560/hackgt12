// listen for messages from the pop up 
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action == "detectMisinformation") {
    const quote = message.quote; 
    console.log("Have received quote to verify:", quote);

    // this is where to actually fact check 
    setTimeout(() => {
      sendResponse({result: "success"});
    }, 1000);

    return true; 
  }
  
});