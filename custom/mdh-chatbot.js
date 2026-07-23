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
<p class="mdh-chatbot-title">

                    MDH Student Assistant
</p>
 
                  <div class="mdh-chatbot-status">

                    Online · BookStack knowledge assistant
</div>
</div>
</div>
 
              <button

                id="mdh-chatbot-close"

                type="button"

                aria-label="Close chatbot"
>

                ×
</button>
</div>
</div>
 
          <div id="mdh-chatbot-messages">
<div id="mdh-chatbot-welcome" class="mdh-message mdh-message-bot">

              Hello! I am your MDH BookStack Student Assistant.
              Ask me about programs, campus information,
              timetable, or documents.
</div>
</div>
 
          <div id="mdh-chatbot-input-area">
<input

              id="mdh-chatbot-input"

              type="text"

              placeholder="Ask about MDH documents..."

              autocomplete="off"

            />
 
            <button

              id="mdh-chatbot-send"

              type="button"
>

              Send
</button>
</div>
</div>
 
        <button

          id="mdh-chatbot-button"

          type="button"

          title="Open MDH Student Assistant"

          aria-label="Open MDH Student Assistant"
>
<span>AI</span>
</button>
</div>

    `;
 
    document.body.insertAdjacentHTML(
      "beforeend",
      chatbotHtml

    );
 
    /*

     * Langflow configuration

     */

    const MDH_LANGFLOW_HOST =

      "https://langflow.mdhbookstack.duckdns.org";
 
    const MDH_LANGFLOW_FLOW_ID =

      "41c61bca-3eb8-485a-b223-066567bedb75";
 
    /*

     * Replace this with your Langflow API key.

     *

     * Important:

     * A key stored in frontend JavaScript is visible in

     * browser DevTools. For production, send requests

     * through a BookStack backend proxy.

     */

    const MDH_LANGFLOW_API_KEY =

      "77a73a18aefeef9d160104cefac162559521d8e824bbc15057fab7743dc0b09f";
 
    /*

     * DOM elements

     */

    const chatbotButton =

      document.getElementById("mdh-chatbot-button");
 
    const chatbotWindow =

      document.getElementById("mdh-chatbot-window");
 
    const chatbotClose =

      document.getElementById("mdh-chatbot-close");
 
    const chatbotMessages =

      document.getElementById("mdh-chatbot-messages");
    
    const chatbotWelcome = document.getElementById("mdh-chatbot-welcome");
    
    const chatbotInput =

      document.getElementById("mdh-chatbot-input");
    
    

    const chatbotSend =

      document.getElementById("mdh-chatbot-send");
 
    /*

     * Chatbot state

     */

    let isOpen = false;

    let isSending = false;
 
    /*

     * The BookStack user is cached only during the current

     * page lifecycle.

     */

    let currentBookStackUser = null;

    let bookStackUserRequest = null;
 
    /**

     * Get the logged-in BookStack user.

     *

     * Expected endpoint response:

     *

     * {

     *   "authenticated": true,

     *   "bookstack_session_id": "...",

     *   "bookstack_user_id": 8,

     *   "bookstack_user_name": "kandhi vaman reddy",

     *   "bookstack_user_email":

     *     "vakandhi@stud.mediadesign.de"

     * }

     */

    async function getBookStackUser() {

      if (currentBookStackUser) {

        return currentBookStackUser;

      }
 
      /*

       * Prevent multiple simultaneous calls to the endpoint.

       */

      if (bookStackUserRequest) {

        return bookStackUserRequest;

      }
 
      bookStackUserRequest = fetch(

        "/mdh/session-info",

        {

          method: "GET",

          credentials: "same-origin",

          cache: "no-store",

          headers: {

            Accept: "application/json"

          }

        }

      )

        .then(async function (response) {

          /*

           * BookStack may redirect unauthenticated users

           * to the login page.

           */

          if (

            response.redirected ||

            response.url.includes("/login")

          ) {

            throw new Error(

              "Your BookStack login session has expired. " +

              "Please log in again."

            );

          }
 
          if (!response.ok) {

            let errorMessage =

              "Unable to retrieve the logged-in " +

              "BookStack user.";
 
            try {

              const errorData = await response.json();
 
              errorMessage =

                errorData.message ||

                errorData.detail ||

                errorMessage;

            } catch (error) {

              // Keep the default error message.

            }
 
            throw new Error(errorMessage);

          }
 
          const data = await response.json();
 
          if (!data.authenticated) {

            throw new Error(

              "The BookStack user is not authenticated."

            );

          }
 
          if (

            data.bookstack_user_id === undefined ||

            data.bookstack_user_id === null

          ) {

            throw new Error(

              "The /mdh/session-info endpoint did not " +

              "return bookstack_user_id."

            );

          }
 
          /*

           * Do not use bookstack_session_id as the Langflow

           * session ID because it can change after logout,

           * login, expiration, or browser-session changes.

           */

          currentBookStackUser = {

            id: String(data.bookstack_user_id),
 
            name:

              data.bookstack_user_name ||

              "Unknown BookStack user",
 
            email:

              data.bookstack_user_email || ""

          };
 
          return currentBookStackUser;

        })

        .finally(function () {

          bookStackUserRequest = null;

        });
 
      return bookStackUserRequest;

    }


    async function updateWelcomeMessage() {
  try {
    const bookStackUser =
      await getBookStackUser();
 
    chatbotWelcome.textContent =
      "Hello " +
      bookStackUser.name +
      "! How can I help you today?";
  } catch (error) {
    chatbotWelcome.textContent =
      "Hello! How can I help you today?";
 
    console.error(
      "Could not load welcome username:",
      error
    );
  }
}
  
    



 
    /**

     * Create a deterministic Langflow session ID.

     *

     * The same BookStack user ID always produces the same

     * Langflow session ID.

     *

     * Examples:

     *

     * User 8:

     * mdh-bookstack-user-8

     *

     * User 9:

     * mdh-bookstack-user-9

     *

     * This remains the same:

     * - after page refresh

     * - after logout and login

     * - on another browser

     * - on another device

     */

    function getLangflowSessionId(
      bookStackUserName,
      bookStackUserId
    ) {
      const safeName = String(bookStackUserName).trim().toLowerCase().replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "") .replace(/\-+/g, "-") .replace(/^\-+|\-+$/g, "");
      
      return (

        safeName + "-" +

        String(bookStackUserId)

      );

    }
 
    /**

     * Display logged-in user and Langflow session details

     * in Browser DevTools:

     *

     * F12 → Console

     */

    function displayChatIdentityInConsole(

      user,

      langflowSessionId

    ) {

      console.groupCollapsed(

        "%cMDH Chatbot User: " + user.name,

        "font-weight: bold; font-size: 13px;"

      );
 
      console.table({

        "BookStack User ID": user.id,

        "BookStack User Name": user.name,

        "BookStack User Email": user.email,

        "Langflow Session ID":

          langflowSessionId

      });
 
      console.groupEnd();

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

      if (isOpen) {

        closeChatbot();

      } else {

        openChatbot();

      }

    }
 
    function scrollToBottom() {

      chatbotMessages.scrollTop =

        chatbotMessages.scrollHeight;

    }
 
    function addMessage(text, sender) {

      const messageElement =

        document.createElement("div");
 
      messageElement.classList.add(

        "mdh-message"

      );
 
      if (sender === "user") {

        messageElement.classList.add(

          "mdh-message-user"

        );

      } else if (sender === "error") {

        messageElement.classList.add(

          "mdh-message-error"

        );

      } else {

        messageElement.classList.add(

          "mdh-message-bot"

        );

      }
 
      /*

       * textContent prevents HTML injection.

       */

      messageElement.textContent = text;
 
      chatbotMessages.appendChild(

        messageElement

      );
 
      scrollToBottom();
 
      return messageElement;

    }
 
    /**

     * Remove internal RAG/debug lines from the chatbot

     * response before displaying it.

     */

    function removeDebugLines(text) {

      if (!text) return "";
 
      return text

        .split(/\r?\n/)

        .filter(function (line) {

          const cleaned =

            line.trim().toLowerCase();
 
          if (!cleaned) return true;
 
          if (

            cleaned.startsWith(

              "search input:"

            )

          ) {

            return false;

          }
 
          if (

            cleaned.startsWith(

              "search type:"

            )

          ) {

            return false;

          }
 
          if (

            cleaned.startsWith(

              "number of results:"

            )

          ) {

            return false;

          }
 
          if (

            cleaned.startsWith(

              "search results:"

            )

          ) {

            return false;

          }
 
          if (

            cleaned.startsWith("context:")

          ) {

            return false;

          }
 
          if (

            cleaned.startsWith(

              "retrieved documents:"

            )

          ) {

            return false;

          }
 
          return true;

        })

        .join("\n")

        .trim();

    }
 
    /**

     * Remove repeated complete answers.

     *

     * Example:

     * Hello...Hello...Hello...

     */

    function removeRepeatedFullAnswers(text) {

      if (!text) return "";
 
      const normalized = text.trim();

      const length = normalized.length;
 
      for (

        let parts = 2;

        parts <= 5;

        parts++

      ) {

        if (length % parts !== 0) {

          continue;

        }
 
        const partLength =

          length / parts;
 
        const firstPart =

          normalized.slice(

            0,

            partLength

          );
 
        let repeated = true;
 
        for (

          let i = 1;

          i < parts;

          i++

        ) {

          const nextPart =

            normalized.slice(

              i * partLength,

              (i + 1) * partLength

            );
 
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
 
      cleaned =

        removeDebugLines(cleaned);
 
      cleaned =

        removeRepeatedFullAnswers(

          cleaned

        );
 
      return cleaned.trim();

    }
 
    /**

     * Extract answer text from different possible

     * Langflow response structures.

     */

    function extractLangflowText(

      responseData

    ) {

      const possiblePaths = [

        responseData

          ?.outputs?.[0]

          ?.outputs?.[0]

          ?.results

          ?.message

          ?.text,
 
        responseData

          ?.outputs?.[0]

          ?.outputs?.[0]

          ?.results

          ?.text

          ?.text,
 
        responseData

          ?.outputs?.[0]

          ?.outputs?.[0]

          ?.artifacts

          ?.message,
 
        responseData

          ?.outputs?.[0]

          ?.outputs?.[0]

          ?.messages?.[0]

          ?.message,
 
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

        if (

          typeof value === "string" &&

          value.trim()

        ) {

          return value;

        }

      }
 
      return "";

    }
 
    /**

     * Parse one Server-Sent Events block.

     */

    function parseSseBlock(block) {

      let eventName = "";

      const dataLines = [];
 
      const lines =

        block.split(/\r?\n/);
 
      for (const line of lines) {

        const cleanLine =

          line.trim();
 
        if (!cleanLine) continue;
 
        if (

          cleanLine.startsWith(

            "event:"

          )

        ) {

          eventName =

            cleanLine

              .slice(6)

              .trim()

              .toLowerCase();
 
          continue;

        }
 
        if (

          cleanLine.startsWith(

            "data:"

          )

        ) {

          dataLines.push(

            cleanLine

              .slice(5)

              .trim()

          );
 
          continue;

        }
 
        if (

          cleanLine.startsWith("{") &&

          cleanLine.endsWith("}")

        ) {

          dataLines.push(cleanLine);

        }

      }
 
      const dataText =

        dataLines

          .join("\n")

          .trim();
 
      if (

        !dataText ||

        dataText === "[DONE]"

      ) {

        return {

          type: "ignore",

          text: ""

        };

      }
 
      try {

        const json =

          JSON.parse(dataText);
 
        const extractedText =

          extractLangflowText(json);
 
        if (!extractedText) {

          return {

            type: "ignore",

            text: ""

          };

        }
 
        /*

         * Treat only these events as real streaming tokens.

         */

        if (

          eventName === "token" ||

          eventName === "stream" ||

          eventName === "message_token" ||

          eventName ===

            "on_chat_model_stream"

        ) {

          return {

            type: "token",

            text: extractedText

          };

        }
 
        /*

         * Other messages are treated as final answer

         * candidates.

         */

        return {

          type: "final",

          text: extractedText

        };

      } catch (error) {

        /*

         * Plain text streaming fallback.

         */

        if (

          eventName === "token" ||

          eventName === "stream" ||

          eventName === "message_token" ||

          eventName ===

            "on_chat_model_stream"

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
 
    /**

     * Typewriter fallback when Langflow returns one final

     * answer instead of token streaming.

     */

    async function typeTextFallback(

      botMessage,

      text

    ) {

      const cleaned =

        cleanBotText(text);
 
      botMessage.textContent = "";
 
      for (

        let i = 0;

        i < cleaned.length;

        i++

      ) {

        botMessage.textContent +=

          cleaned[i];
 
        if (i % 3 === 0) {

          scrollToBottom();
 
          await new Promise(

            function (resolve) {

              setTimeout(

                resolve,

                8

              );

            }

          );

        }

      }
 
      scrollToBottom();

    }
 
    /**

     * Read and display Langflow streaming response.

     */

    async function streamLangflowResponse(

      response,

      botMessage

    ) {

      const reader =

        response.body.getReader();
 
      const decoder =

        new TextDecoder("utf-8");
 
      let buffer = "";

      let rawResponse = "";

      let fullText = "";

      let finalText = "";

      let hasRealTokens = false;
 
      const seenFinalMessages =

        new Set();
 
      while (true) {

        const result =

          await reader.read();
 
        if (result.done) break;
 
        const chunk =

          decoder.decode(

            result.value,

            {

              stream: true

            }

          );
 
        rawResponse += chunk;

        buffer += chunk;
 
        const blocks =

          buffer.split(

            /\r?\n\r?\n/

          );
 
        buffer =

          blocks.pop() || "";
 
        for (const block of blocks) {

          const parsed =

            parseSseBlock(block);
 
          const cleanedText =

            cleanBotText(

              parsed.text

            );
 
          if (!cleanedText) {

            continue;

          }
 
          if (

            parsed.type === "token"

          ) {

            hasRealTokens = true;
 
            /*

             * Prevent duplicated streamed content.

             */

            if (

              cleanedText === fullText

            ) {

              continue;

            }
 
            if (

              fullText &&

              cleanedText.includes(

                fullText

              )

            ) {

              fullText =

                cleanedText;

            } else if (

              fullText &&

              fullText.includes(

                cleanedText

              ) &&

              cleanedText.length > 20

            ) {

              continue;

            } else {

              fullText +=

                cleanedText;

            }
 
            fullText =

              cleanBotText(

                fullText

              );
 
            botMessage.textContent =

              fullText;
 
            scrollToBottom();

          }
 
          if (

            parsed.type === "final"

          ) {

            if (

              seenFinalMessages.has(

                cleanedText

              )

            ) {

              continue;

            }
 
            seenFinalMessages.add(

              cleanedText

            );
 
            if (

              cleanedText.length >

              finalText.length

            ) {

              finalText =

                cleanedText;

            }

          }

        }

      }
 
      /*

       * Process remaining buffer.

       */

      if (buffer.trim()) {

        const parsed =

          parseSseBlock(buffer);
 
        const cleanedText =

          cleanBotText(

            parsed.text

          );
 
        if (cleanedText) {

          if (

            parsed.type === "token"

          ) {

            hasRealTokens = true;
 
            if (

              fullText &&

              cleanedText.includes(

                fullText

              )

            ) {

              fullText =

                cleanedText;

            } else if (

              !(

                fullText &&

                fullText.includes(

                  cleanedText

                ) &&

                cleanedText.length > 20

              )

            ) {

              fullText +=

                cleanedText;

            }
 
            fullText =

              cleanBotText(

                fullText

              );
 
            botMessage.textContent =

              fullText;
 
            scrollToBottom();

          }
 
          if (

            parsed.type === "final" &&

            cleanedText.length >

              finalText.length

          ) {

            finalText =

              cleanedText;

          }

        }

      }
 
      /*

       * Case 1:

       * Real token streaming worked.

       */

      if (

        hasRealTokens &&

        fullText.trim()

      ) {

        botMessage.textContent =

          cleanBotText(

            fullText

          );
 
        scrollToBottom();

        return;

      }
 
      /*

       * Case 2:

       * Langflow returned a final answer.

       */

      if (finalText.trim()) {

        await typeTextFallback(

          botMessage,

          finalText

        );
 
        return;

      }
 
      /*

       * Case 3:

       * Raw JSON fallback.

       */

      try {

        const finalJson =

          JSON.parse(rawResponse);
 
        const extractedFinal =

          cleanBotText(

            extractLangflowText(

              finalJson

            )

          );
 
        if (extractedFinal) {

          await typeTextFallback(

            botMessage,

            extractedFinal

          );
 
          return;

        }

      } catch (error) {

        const rawText =

          cleanBotText(

            rawResponse

          );
 
        if (rawText) {

          await typeTextFallback(

            botMessage,

            rawText

          );
 
          return;

        }

      }
 
      botMessage.textContent =

        "I received an empty response from Langflow.";

    }
 
    /**

     * Send user message to Langflow.

     */

    async function sendMessage() {

      const userText =

        chatbotInput.value.trim();
 
      if (

        !userText ||

        isSending

      ) {

        return;

      }
 
      isSending = true;
 
      chatbotInput.value = "";

      chatbotSend.disabled = true;
 
      addMessage(

        userText,

        "user"

      );
 
      const botMessage =

        addMessage(

          "Thinking...",

          "bot"

        );
 
      try {

        /*

         * Get the logged-in BookStack user.

         */

        const bookStackUser =

          await getBookStackUser();
 
        /*

         * Create the stable Langflow session.

         *

         * User ID 8 always gets:

         * mdh-bookstack-user-8

         */

        const langflowSessionId =

          getLangflowSessionId(
            bookStackUser.name,
            bookStackUser.id

          );
 
        /*

         * Display details in:

         * F12 → Console

         */

        displayChatIdentityInConsole(

          bookStackUser,

          langflowSessionId

        );
 
        console.log(

          "Sending Langflow request with session ID:",

          langflowSessionId

        );

        // webhook
 
        const response = await fetch(

          MDH_LANGFLOW_HOST +

            "/api/v1/run/" +

            MDH_LANGFLOW_FLOW_ID +

            "?stream=true",

          {

            method: "POST",
 
            headers: {

              "Content-Type":

                "application/json",
 
              Accept:

                "text/event-stream",
 
              "x-api-key":

                MDH_LANGFLOW_API_KEY

            },
 
            body: JSON.stringify({

              input_type: "chat",

              input_value: userText,

              output_type: "chat",
 
              /*

               * This is the Langflow chat session ID.

               */

              session_id:

                langflowSessionId,
 
              stream: true

            })

          }

        );
 
        if (!response.ok) {

          let errorText =

            "Langflow request failed.";
 
          try {

            const errorData =

              await response.json();
 
            errorText =

              errorData.detail ||

              errorData.message ||

              errorText;

          } catch (error) {

            try {

              errorText =

                await response.text();

            } catch (

              responseReadError

            ) {

              // Keep default error.

            }

          }
 
          throw new Error(

            errorText

          );

        }
 
        botMessage.textContent = "";
 
        /*

         * Non-streaming fallback.

         */

        if (!response.body) {

          const responseData =

            await response.json();
 
          const answer =

            cleanBotText(

              extractLangflowText(

                responseData

              )

            );
 
          botMessage.textContent =

            answer ||

            "I received a response, but could not read the answer text.";
 
          return;

        }
 
        await streamLangflowResponse(

          response,

          botMessage

        );

      } catch (error) {

        botMessage.remove();
 
        addMessage(

          "Error: " +

            error.message,

          "error"

        );
 
        console.error(

          "MDH chatbot error:",

          error

        );

      } finally {

        isSending = false;

        chatbotSend.disabled = false;

        chatbotInput.focus();

      }

    }
    updateWelcomeMessage();
 
    /*

     * Event listeners

     */

    chatbotButton.addEventListener(

      "click",

      toggleChatbot

    );
 
    chatbotClose.addEventListener(

      "click",

      closeChatbot

    );
 
    chatbotSend.addEventListener(

      "click",

      sendMessage

    );
 
    chatbotInput.addEventListener(

      "keydown",

      function (event) {

        if (event.key === "Enter") {

          event.preventDefault();

          sendMessage();

        }

      }

    );

  });

})();
 