chrome.tabs.onUpdated.addListener((tabId, tab) => {
    if (tab.url && tab.url.includes(" ")) {
      const queryParameters = tab.url.split("?")[1];
      const urlParameters = new URLSearchParams(queryParameters);
  
      chrome.tabs.sendMessage(tabId, {
        type: "NEW",
        videoId: urlParameters.get("v"),
      });
    }
  });
//event listener for when  user clicks on icon
  chrome.action.onClicked.addListener((tab) => {
  chrome.action.setBadgeText({text: 'ON'});
  chrome.action.setBadgeBackgroundColor({color: '#444a63ff'});
  
  chrome.action.setTitle({
    tabId: tab.id,
    title: `You are on tab: ${tab.id}`});
});
