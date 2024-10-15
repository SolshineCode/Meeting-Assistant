/* global chrome */
/* global tippy */

console.log("Extension loaded");

// Notify background script that the content script is ready
chrome.runtime.sendMessage({ message: "content_script_ready" });

let finder;
(async () => {
  const src = chrome.runtime.getURL("./finder.js");
  finder = await import(src);
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHATGPT_RESPONSE") {
    console.log("Received CHATGPT_RESPONSE:", message.data);
    // Handle the response here
  }
  return true; // Keep the message channel open for async response
});

chrome.runtime.onMessage.addListener(function (event) {
  if (event.message !== "load") {
    return;
  }
  main();
});

let extensionIframe;
const selectNodeOverlay = document.createElement("div");
selectNodeOverlay.classList.add("select-overlay");
const overlayContent = document.createElement("div");
selectNodeOverlay.appendChild(overlayContent);

function createExtensionWindow() {
  const draggable = document.createElement("div");
  draggable.id = "extension-window";
  draggable.style.position = "fixed";
  draggable.style.top = "20px";
  draggable.style.right = "20px";
  draggable.style.width = "400px";
  draggable.style.height = "700px";
  draggable.style.zIndex = "999999999999999";
  draggable.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
  draggable.style.borderRadius = "10px";
  draggable.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
  
  const handle = document.createElement("div");
  handle.classList.add("handle");
  handle.style.cursor = "grab";
  handle.style.height = "40px";
  handle.style.backgroundColor = "#f0f0f0";
  handle.style.borderRadius = "10px 10px 0 0";
  draggable.appendChild(handle);

  const iframe = document.createElement("iframe");
  iframe.id = "extension-iframe";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  draggable.appendChild(iframe);

  document.body.appendChild(draggable);
  dragElement(draggable);
  
  // Load the content into the iframe
  const extensionOrigin = "chrome-extension://" + chrome.runtime.id;
  fetch(chrome.runtime.getURL("index.html"))
    .then((response) => response.text())
    .then((html) => {
      const reactHTML = html.replace(/\/static\//g, `${extensionOrigin}/static/`);
      const iframeDoc = iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(reactHTML);
      iframeDoc.close();
    })
    .catch((error) => {
      console.warn(error);
    });
}

function dragElement(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  document.querySelector("#extension-window .handle").onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function main() {
  const existingWindow = document.querySelector("#extension-window");
  if (existingWindow) {
    existingWindow.parentNode.removeChild(existingWindow);
    chrome.storage.sync.clear();
    return;
  }
  createExtensionWindow();
}
