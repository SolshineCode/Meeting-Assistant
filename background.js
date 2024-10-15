/* global chrome */
let contentScriptReady = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "content_script_ready") {
    contentScriptReady = true; // Set the flag when content script is ready
  }
});

chrome.action.onClicked.addListener(function (tab) {
  if (contentScriptReady) {
    chrome.tabs.sendMessage(tab.id, { message: "load" });
  } else {
    console.error("Content script is not ready yet.");
  }
});

chrome.webNavigation.onCompleted.addListener(function (details) {
  if (details.frameId === 0) {
    chrome.storage.sync.get(["currentPage"], (data) => {
      if (details.url.includes(data.currentPage)) {
        if (contentScriptReady) {
          chrome.tabs.sendMessage(details.tabId, { message: "load" });
        } else {
          console.error("Content script is not ready yet.");
        }
      }
    });
  }
});

console.log("Background!!");

let chats = {}; // { meetId: [ { ticId, role, content } ] }
let chatGptResponses = {}; // { meetId: { generatedResponse, startChatIndex, endChatIndex } }

// Function to fetch the API key
async function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(["apiKey"], (data) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(data.apiKey);
      }
    });
  });
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === "CURRENT_CHAT") {
    console.log("CURRENT_CHAT", request.data.chat);
    const meetId = request.data.meetId;
    const passedChat = request.data.chat;
    if (!chats[meetId]) {
      chats[meetId] = [];
    }
    const chat = chats[meetId];
    passedChat.forEach((passedChatInstance) => {
      const chatIndex = chat.findIndex(
        (chatInstance) => chatInstance.ticId === passedChatInstance.ticId
      );
      if (chatIndex > -1) {
        chat[chatIndex].content = passedChatInstance.content;
      } else {
        chat.push(passedChatInstance);
      }
    });

    try {
      const apiKey = await getApiKey(); // Get the API key from storage

      // Send chat to Groq API for response
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}` // Use the retrieved API key
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile", // Specify the model you want to use
          messages: chat.map(chatInstance => ({
            role: chatInstance.role,
            content: chatInstance.content
          })),
          max_tokens: 150, // Adjust as needed
          temperature: 1 // Adjust as needed
        })
      });

      const responseJson = await response.json();
      console.log("Groq API response:", responseJson);

      // Handle the response from Groq API
      if (responseJson.choices && responseJson.choices.length > 0) {
        const generatedResponse = responseJson.choices[0].message.content;

        chatGptResponses[meetId] = {
          generatedResponse,
          startChatIndex: 0, // Adjust as needed
          endChatIndex: chat.length - 1 // Adjust as needed
        };

        // Send the generated response back to the popup
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: "CHATGPT_RESPONSE",
              data: chatGptResponses[meetId],
            }, function (response) {
              if (chrome.runtime.lastError) {
                console.log("Error sending message:", chrome.runtime.lastError.message);
              }
            });
          } else {
            console.error("No active tab found.");
          }
        });
      } else {
        console.error("No response from Groq API");
      }
    } catch (error) {
      console.error("Error retrieving API key:", error);
    }
  }

  // Handle other request types as needed...
});
