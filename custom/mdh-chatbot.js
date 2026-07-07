(function () {
    const blockedPaths = [
      "/login",
      "/register",
      "/password",
      "/password/email",
      "/password/reset",
      "/mfa",
      "/logout"
    ];

    const currentPath = window.location.pathname.toLowerCase();

    const isBlockedPage = blockedPaths.some(function (path) {
      return currentPath === path || currentPath.startsWith(path + "/");
    });

    if (isBlockedPage) return;

    document.addEventListener("DOMContentLoaded", function () {
      if (document.getElementById("mdh-chatbot-root")) return;

      const chatbotHtml = `
        <div id="mdh-chatbot-root">
          <div id="mdh-chatbot-window">
            <div id="mdh-chatbot-header">
              <div class="mdh-chatbot-header-row">
                <div class="mdh-chatbot-title-block">
                  <div class="mdh-chatbot-avatar">AI</div>
                  <div>
                    <p class="mdh-chatbot-title">MDH Student Assistant</p>
                    <div class="mdh-chatbot-status">Online · BookStack knowledge assistant</div>
                  </div>
                </div>
                <button id="mdh-chatbot-close" type="button">×</button>
              </div>
            </div>

            <div id="mdh-chatbot-messages">
              <div class="mdh-message mdh-message-bot">
                Hello! I am your MDH BookStack Student Assistant. Ask me about programs, campus information, timetable, or documents.
              </div>
            </div>

            <div id="mdh-chatbot-input-area">
              <input
                id="mdh-chatbot-input"
                type="text"
                placeholder="Ask about MDH documents..."
                autocomplete="off"
              />
              <button id="mdh-chatbot-send" type="button">Send</button>
            </div>
          </div>

          <button id="mdh-chatbot-button" type="button" title="Open MDH Student Assistant">
            <span>AI</span>
          </button>
        </div>
      `;

      document.body.insertAdjacentHTML("beforeend", chatbotHtml);

      const MDH_LANGFLOW_HOST = "https://langflow.mdhbookstack.duckdns.org";
      const MDH_LANGFLOW_FLOW_ID = "ac2aa735-1ee6-4e88-9cd2-029200d6d740";

      /*
        Testing only:
        This key is visible in browser DevTools.
        For production, use backend proxy.
      */
      const MDH_LANGFLOW_API_KEY = "77a73a18aefeef9d160104cefac162559521d8e824bbc15057fab7743dc0b09f";

      const chatbotButton = document.getElementById("mdh-chatbot-button");
      const chatbotWindow = document.getElementById("mdh-chatbot-window");
      const chatbotClose = document.getElementById("mdh-chatbot-close");
      const chatbotMessages = document.getElementById("mdh-chatbot-messages");
      const chatbotInput = document.getElementById("mdh-chatbot-input");
      const chatbotSend = document.getElementById("mdh-chatbot-send");

      let isOpen = false;
      let isSending = false;

      function getSessionId() {
        const existing = localStorage.getItem("mdh_bookstack_chat_session_id");

        if (existing) return existing;

        const created =
          window.crypto && window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : "mdh-session-" + Date.now();

        localStorage.setItem("mdh_bookstack_chat_session_id", created);
        return created;
      }

      function openChatbot() {
        isOpen = true;
        chatbotWindow.style.display = "flex";
        chatbotInput.focus();
      }

      function closeChatbot() {
        isOpen = false;
        chatbotWindow.style.display = "none";
      }

      function toggleChatbot() {
        isOpen ? closeChatbot() : openChatbot();
      }

      function scrollToBottom() {
        chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
      }

      function addMessage(text, sender) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("mdh-message");

        if (sender === "user") {
          messageElement.classList.add("mdh-message-user");
        } else if (sender === "error") {
          messageElement.classList.add("mdh-message-error");
        } else {
          messageElement.classList.add("mdh-message-bot");
        }

        messageElement.textContent = text;
        chatbotMessages.appendChild(messageElement);
        scrollToBottom();

        return messageElement;
      }

      function removeDebugLines(text) {
        if (!text) return "";

        return text
          .split(/\r?\n/)
          .filter(function (line) {
            const cleaned = line.trim().toLowerCase();

            if (!cleaned) return true;

            if (cleaned.startsWith("search input:")) return false;
            if (cleaned.startsWith("search type:")) return false;
            if (cleaned.startsWith("number of results:")) return false;
            if (cleaned.startsWith("search results:")) return false;
            if (cleaned.startsWith("context:")) return false;
            if (cleaned.startsWith("retrieved documents:")) return false;

            return true;
          })
          .join("\n")
          .trim();
      }

      function removeRepeatedFullAnswers(text) {
        if (!text) return "";

        const normalized = text.trim();

        /*
          Fix repeated full-answer blocks.
          Example:
          Hello...today?Hello...today?Hello...today?
        */
        const length = normalized.length;

        for (let parts = 2; parts <= 5; parts++) {
          if (length % parts !== 0) continue;

          const partLength = length / parts;
          const firstPart = normalized.slice(0, partLength);

          let repeated = true;

          for (let i = 1; i < parts; i++) {
            const nextPart = normalized.slice(i * partLength, (i + 1) * partLength);

            if (nextPart !== firstPart) {
              repeated = false;
              break;
            }
          }

          if (repeated) {
            return firstPart.trim();
          }
        }

        return normalized;
      }

      function cleanBotText(text) {
        let cleaned = text || "";

        cleaned = removeDebugLines(cleaned);
        cleaned = removeRepeatedFullAnswers(cleaned);

        return cleaned.trim();
      }

      function extractLangflowText(responseData) {
        const possiblePaths = [
          responseData?.outputs?.[0]?.outputs?.[0]?.results?.message?.text,
          responseData?.outputs?.[0]?.outputs?.[0]?.results?.text?.text,
          responseData?.outputs?.[0]?.outputs?.[0]?.artifacts?.message,
          responseData?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message,
          responseData?.data?.chunk,
          responseData?.data?.text,
          responseData?.data?.token,
          responseData?.chunk,
          responseData?.text,
          responseData?.token,
          responseData?.result,
          responseData?.message,
          responseData?.output
        ];

        for (const value of possiblePaths) {
          if (typeof value === "string" && value.trim()) {
            return value;
          }
        }

        return "";
      }

      function parseSseBlock(block) {
        let eventName = "";
        const dataLines = [];

        const lines = block.split(/\r?\n/);

        for (const line of lines) {
          const cleanLine = line.trim();

          if (!cleanLine) continue;

          if (cleanLine.startsWith("event:")) {
            eventName = cleanLine.slice(6).trim().toLowerCase();
            continue;
          }

          if (cleanLine.startsWith("data:")) {
            dataLines.push(cleanLine.slice(5).trim());
            continue;
          }

          if (cleanLine.startsWith("{") && cleanLine.endsWith("}")) {
            dataLines.push(cleanLine);
          }
        }

        const dataText = dataLines.join("\n").trim();

        if (!dataText || dataText === "[DONE]") {
          return {
            type: "ignore",
            text: ""
          };
        }

        try {
          const json = JSON.parse(dataText);

          const extractedText = extractLangflowText(json);

          if (!extractedText) {
            return {
              type: "ignore",
              text: ""
            };
          }

          /*
            Important:
            Only these event types should be treated as real token streaming.
            Final/full messages should not be appended repeatedly.
          */
          if (
            eventName === "token" ||
            eventName === "stream" ||
            eventName === "message_token" ||
            eventName === "on_chat_model_stream"
          ) {
            return {
              type: "token",
              text: extractedText
            };
          }

          /*
            Everything else is treated as final/full answer candidate.
            It will be used once, not appended again and again.
          */
          return {
            type: "final",
            text: extractedText
          };
        } catch (error) {
          /*
            Plain-text streaming fallback.
          */
          if (
            eventName === "token" ||
            eventName === "stream" ||
            eventName === "message_token" ||
            eventName === "on_chat_model_stream"
          ) {
            return {
              type: "token",
              text: dataText
            };
          }

          return {
            type: "ignore",
            text: ""
          };
        }
      }

      async function typeTextFallback(botMessage, text) {
        const cleaned = cleanBotText(text);

        botMessage.textContent = "";

        for (let i = 0; i < cleaned.length; i++) {
          botMessage.textContent += cleaned[i];

          if (i % 3 === 0) {
            scrollToBottom();

            await new Promise(function (resolve) {
              setTimeout(resolve, 8);
            });
          }
        }

        scrollToBottom();
      }

      async function streamLangflowResponse(response, botMessage) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let buffer = "";
        let rawResponse = "";
        let fullText = "";
        let finalText = "";
        let hasRealTokens = false;

        const seenFinalMessages = new Set();

        while (true) {
          const result = await reader.read();

          if (result.done) break;

          const chunk = decoder.decode(result.value, { stream: true });

          rawResponse += chunk;
          buffer += chunk;

          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() || "";

          for (const block of blocks) {
            const parsed = parseSseBlock(block);
            const cleanedText = cleanBotText(parsed.text);

            if (!cleanedText) continue;

            if (parsed.type === "token") {
              hasRealTokens = true;

              /*
                Avoid duplicate token/full-message appending.
              */
              if (cleanedText === fullText) {
                continue;
              }

              if (fullText && cleanedText.includes(fullText)) {
                fullText = cleanedText;
              } else if (fullText && fullText.includes(cleanedText) && cleanedText.length > 20) {
                continue;
              } else {
                fullText += cleanedText;
              }

              fullText = cleanBotText(fullText);
              botMessage.textContent = fullText;
              scrollToBottom();
            }

            if (parsed.type === "final") {
              if (seenFinalMessages.has(cleanedText)) {
                continue;
              }

              seenFinalMessages.add(cleanedText);

              /*
                Store final answer, but do not append it repeatedly.
              */
              if (cleanedText.length > finalText.length) {
                finalText = cleanedText;
              }
            }
          }
        }

        if (buffer.trim()) {
          const parsed = parseSseBlock(buffer);
          const cleanedText = cleanBotText(parsed.text);

          if (cleanedText) {
            if (parsed.type === "token") {
              hasRealTokens = true;

              if (fullText && cleanedText.includes(fullText)) {
                fullText = cleanedText;
              } else if (!(fullText && fullText.includes(cleanedText) && cleanedText.length > 20)) {
                fullText += cleanedText;
              }

              fullText = cleanBotText(fullText);
              botMessage.textContent = fullText;
              scrollToBottom();
            }

            if (parsed.type === "final") {
              if (cleanedText.length > finalText.length) {
                finalText = cleanedText;
              }
            }
          }
        }

        /*
          Case 1:
          Real token streaming worked.
        */
        if (hasRealTokens && fullText.trim()) {
          botMessage.textContent = cleanBotText(fullText);
          scrollToBottom();
          return;
        }

        /*
          Case 2:
          Backend did not stream real tokens.
          Use final answer once with typewriter effect.
        */
        if (finalText.trim()) {
          await typeTextFallback(botMessage, finalText);
          return;
        }

        /*
          Case 3:
          Raw final JSON fallback.
        */
        try {
          const finalJson = JSON.parse(rawResponse);
          const extractedFinal = cleanBotText(extractLangflowText(finalJson));

          if (extractedFinal) {
            await typeTextFallback(botMessage, extractedFinal);
            return;
          }
        } catch (error) {
          const rawText = cleanBotText(rawResponse);

          if (rawText) {
            await typeTextFallback(botMessage, rawText);
            return;
          }
        }

        botMessage.textContent = "I received an empty response from Langflow.";
      }

      async function sendMessage() {
        const userText = chatbotInput.value.trim();

        if (!userText || isSending) return;

        isSending = true;
        chatbotInput.value = "";
        chatbotSend.disabled = true;

        addMessage(userText, "user");
        const botMessage = addMessage("Thinking...", "bot");

        try {
          const response = await fetch(
            `${MDH_LANGFLOW_HOST}/api/v1/run/${MDH_LANGFLOW_FLOW_ID}?stream=true`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
                "x-api-key": MDH_LANGFLOW_API_KEY
              },
              body: JSON.stringify({
                input_type: "chat",
                input_value: userText,
                output_type: "chat",
                session_id: getSessionId(),
                stream: true
              })
            }
          );

          if (!response.ok) {
            let errorText = "Langflow request failed.";

            try {
              const errorData = await response.json();
              errorText = errorData.detail || errorData.message || errorText;
            } catch (e) {
              try {
                errorText = await response.text();
              } catch (e2) {}
            }

            throw new Error(errorText);
          }

          botMessage.textContent = "";

          if (!response.body) {
            const responseData = await response.json();
            const answer = cleanBotText(extractLangflowText(responseData));

            botMessage.textContent =
              answer || "I received a response, but could not read the answer text.";

            return;
          }

          await streamLangflowResponse(response, botMessage);
        } catch (error) {
          botMessage.remove();
          addMessage("Error: " + error.message, "error");
        } finally {
          isSending = false;
          chatbotSend.disabled = false;
          chatbotInput.focus();
        }
      }

      chatbotButton.addEventListener("click", toggleChatbot);
      chatbotClose.addEventListener("click", closeChatbot);
      chatbotSend.addEventListener("click", sendMessage);

      chatbotInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          sendMessage();
        }
      });
    });
  })();
