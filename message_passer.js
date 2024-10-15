chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("to popup", request);
  if (extensionIframe && extensionIframe.contentWindow) {
    extensionIframe.contentWindow.postMessage(request, "*");
  } else {
    console.error("Extension iframe not found or not ready");
  }
});

window.addEventListener("message", function (event) {
  console.log("from popup", event.data);
  chrome.runtime.sendMessage(event.data, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error sending message:", chrome.runtime.lastError.message);
    }
  });
});
