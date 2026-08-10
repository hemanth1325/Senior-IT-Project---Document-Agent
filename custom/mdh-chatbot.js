(function () {
  "use strict";

  /*
   * ============================================================
   * MDH BookStack Chatbot
   * ============================================================
   *
   * SECURITY DESIGN
   *
   * Browser:
   *   BookStack -> /mdh/chat
   *
   * Server:
   *   /mdh/chat -> authenticate BookStack user
   *             -> determine BookStack user ID
   *             -> create Langflow session ID
   *             -> add Langflow API key
   *             -> call Langflow
   *
   * IMPORTANT:
   *
   * - No Langflow API key exists in this JavaScript.
   * - No Langflow URL exists in this JavaScript.
   * - No Langflow Flow ID exists in this JavaScript.
   * - Browser does NOT provide BookStack user ID to Langflow.
   * - Browser does NOT create Langflow session IDs.
   * - Browser does NOT create LiteLLM user IDs.
   *
   * The backend /mdh/chat endpoint is responsible for all
   * security-sensitive identity and Langflow configuration.
   *
   * ============================================================
   */


  /*
   * ============================================================
   * 1. Pages where chatbot must not be loaded
   * ============================================================
   */

  const blockedPaths = [
    "/login",
    "/register",
    "/password",
    "/password/email",
    "/password/reset",
    "/mfa",
    "/logout"
  ];

  const currentPath =
    window.location.pathname.toLowerCase();

  const isBlockedPage =
    blockedPaths.some(function (path) {
      return (
        currentPath === path ||
        currentPath.startsWith(path + "/")
      );
    });

  if (isBlockedPage) {
    return;
  }


  /*
   * ============================================================
   * 2. Configuration
   * ============================================================
   */

  /*
   * This is the ONLY backend endpoint the browser needs.
   *
   * Caddy:
   *
   * /mdh/chat
   *     ->
   * mdh-chat-gateway:8000/mdh/chat
   */

  const MDH_CHAT_ENDPOINT =
    "/mdh/chat";

  /*
   * Existing BookStack session information endpoint.
   *
   * It should return:
   *
   * {
   *   "authenticated": true,
   *   "bookstack_user_id": 8,
   *   "bookstack_user_name": "Vaman Reddy",
   *   "bookstack_user_email": "..."
   * }
   */

  const MDH_SESSION_ENDPOINT =
    "/mdh/session-info";


  /*
   * Maximum size accepted from the browser.
   *
   * Backend should ALSO enforce its own maximum.
   */

  const MAX_MESSAGE_LENGTH =
    10000;


  /*
   * ============================================================
   * 3. Start after DOM has loaded
   * ============================================================
   */

  document.addEventListener(
    "DOMContentLoaded",
    async function () {

      /*
       * Prevent duplicate chatbot initialization.
       */

      if (
        document.getElementById(
          "mdh-chatbot-root"
        )
      ) {
        return;
      }


      /*
       * --------------------------------------------------------
       * First verify that a BookStack user is authenticated.
       *
       * If nobody is logged in, the chatbot is not even inserted
       * into the page.
       *
       * NOTE:
       *
       * This frontend check is only for UI behavior.
       *
       * REAL SECURITY MUST STILL BE ENFORCED by /mdh/chat.
       * --------------------------------------------------------
       */

      let initialBookStackUser;

      try {

        initialBookStackUser =
          await getBookStackUser(true);

      } catch (error) {

        console.info(
          "MDH chatbot not loaded:",
          error.message
        );

        return;
      }


      /*
       * ========================================================
       * 4. Create chatbot HTML
       * ========================================================
       */

      const chatbotHtml = `

        <div id="mdh-chatbot-root">

          <div id="mdh-chatbot-window">

            <div id="mdh-chatbot-header">

              <div class="mdh-chatbot-header-row">

                <div class="mdh-chatbot-title-block">

                  <div class="mdh-chatbot-avatar">
                    AI
                  </div>

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

              <div
                id="mdh-chatbot-welcome"
                class="mdh-message mdh-message-bot"
              >
                Hello!
                How can I help you today?
              </div>

            </div>


            <div id="mdh-chatbot-input-area">

              <input
                id="mdh-chatbot-input"
                type="text"
                placeholder="Ask about MDH documents..."
                autocomplete="off"
                maxlength="${MAX_MESSAGE_LENGTH}"
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
       * ========================================================
       * 5. DOM elements
       * ========================================================
       */

      const chatbotButton =
        document.getElementById(
          "mdh-chatbot-button"
        );

      const chatbotWindow =
        document.getElementById(
          "mdh-chatbot-window"
        );

      const chatbotClose =
        document.getElementById(
          "mdh-chatbot-close"
        );

      const chatbotMessages =
        document.getElementById(
          "mdh-chatbot-messages"
        );

      const chatbotWelcome =
        document.getElementById(
          "mdh-chatbot-welcome"
        );

      const chatbotInput =
        document.getElementById(
          "mdh-chatbot-input"
        );

      const chatbotSend =
        document.getElementById(
          "mdh-chatbot-send"
        );


      /*
       * ========================================================
       * 6. State
       * ========================================================
       */

      let isOpen = false;

      let isSending = false;


      /*
       * ========================================================
       * 7. Welcome message
       * ========================================================
       */

      updateWelcomeMessage(
        initialBookStackUser
      );


      /*
       * ========================================================
       * 8. Basic chatbot controls
       * ========================================================
       */

      function openChatbot() {

        isOpen = true;

        chatbotWindow.style.display =
          "flex";

        chatbotInput.focus();
      }


      function closeChatbot() {

        isOpen = false;

        chatbotWindow.style.display =
          "none";
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


      /*
       * ========================================================
       * 9. Add message to UI
       * ========================================================
       */

      function addMessage(
        text,
        sender
      ) {

        const messageElement =
          document.createElement("div");

        messageElement.classList.add(
          "mdh-message"
        );


        if (sender === "user") {

          messageElement.classList.add(
            "mdh-message-user"
          );

        } else if (
          sender === "error"
        ) {

          messageElement.classList.add(
            "mdh-message-error"
          );

        } else {

          messageElement.classList.add(
            "mdh-message-bot"
          );
        }


        /*
         * Use textContent instead of innerHTML.
         *
         * This prevents chatbot responses from injecting HTML
         * or JavaScript into BookStack.
         */

        messageElement.textContent =
          text;


        chatbotMessages.appendChild(
          messageElement
        );


        scrollToBottom();


        return messageElement;
      }


      /*
       * ========================================================
       * 10. Clean Langflow/RAG debug information
       * ========================================================
       */

      function removeDebugLines(text) {

        if (!text) {
          return "";
        }


        return text

          .split(/\r?\n/)

          .filter(function (line) {

            const cleaned =
              line
                .trim()
                .toLowerCase();


            if (!cleaned) {
              return true;
            }


            const blockedDebugPrefixes = [

              "search input:",

              "search type:",

              "number of results:",

              "search results:",

              "context:",

              "retrieved documents:"
            ];


            return !blockedDebugPrefixes.some(
              function (prefix) {

                return cleaned.startsWith(
                  prefix
                );
              }
            );
          })

          .join("\n")

          .trim();
      }


      /*
       * ========================================================
       * 11. Remove repeated full responses
       * ========================================================
       */

      function removeRepeatedFullAnswers(
        text
      ) {

        if (!text) {
          return "";
        }


        const normalized =
          text.trim();


        const length =
          normalized.length;


        /*
         * Detect:
         *
         * answeranswer
         *
         * answeransweranswer
         *
         * etc.
         */

        for (
          let parts = 2;
          parts <= 5;
          parts++
        ) {

          if (
            length % parts !== 0
          ) {
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

                (i + 1) *
                  partLength
              );


            if (
              nextPart !== firstPart
            ) {

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

        let cleaned =
          text || "";


        cleaned =
          removeDebugLines(
            cleaned
          );


        cleaned =
          removeRepeatedFullAnswers(
            cleaned
          );


        return cleaned.trim();
      }


      /*
       * ========================================================
       * 12. Extract text from Langflow responses
       * ========================================================
       */

      function extractLangflowText(
        responseData
      ) {

        if (!responseData) {
          return "";
        }


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


          responseData
            ?.data
            ?.chunk,


          responseData
            ?.data
            ?.text,


          responseData
            ?.data
            ?.token,


          responseData
            ?.chunk,


          responseData
            ?.text,


          responseData
            ?.token,


          responseData
            ?.result,


          responseData
            ?.message,


          responseData
            ?.output
        ];


        for (
          const value
          of possiblePaths
        ) {

          if (
            typeof value ===
              "string" &&
            value.trim()
          ) {

            return value;
          }
        }


        return "";
      }


      /*
       * ========================================================
       * 13. Parse one SSE event block
       * ========================================================
       */

      function parseSseBlock(
        block
      ) {

        let eventName = "";

        const dataLines = [];


        const lines =
          block.split(/\r?\n/);


        for (
          const line
          of lines
        ) {

          const cleanLine =
            line.trim();


          if (!cleanLine) {
            continue;
          }


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


          /*
           * Some reverse proxies / Langflow responses may
           * return JSON without explicit "data:".
           */

          if (
            cleanLine.startsWith("{") &&
            cleanLine.endsWith("}")
          ) {

            dataLines.push(
              cleanLine
            );
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

            type:
              "ignore",

            text:
              ""
          };
        }


        try {

          const json =
            JSON.parse(
              dataText
            );


          const extractedText =
            extractLangflowText(
              json
            );


          if (
            !extractedText
          ) {

            return {

              type:
                "ignore",

              text:
                ""
            };
          }


          /*
           * Events that represent actual token streaming.
           */

          const tokenEvents = [

            "token",

            "stream",

            "message_token",

            "on_chat_model_stream"
          ];


          if (
            tokenEvents.includes(
              eventName
            )
          ) {

            return {

              type:
                "token",

              text:
                extractedText
            };
          }


          /*
           * Any other response carrying text is considered
           * a possible final response.
           */

          return {

            type:
              "final",

            text:
              extractedText
          };


        } catch (error) {

          /*
           * Plain-text token fallback.
           */

          const tokenEvents = [

            "token",

            "stream",

            "message_token",

            "on_chat_model_stream"
          ];


          if (
            tokenEvents.includes(
              eventName
            )
          ) {

            return {

              type:
                "token",

              text:
                dataText
            };
          }


          return {

            type:
              "ignore",

            text:
              ""
          };
        }
      }


      /*
       * ========================================================
       * 14. Typewriter fallback
       * ========================================================
       */

      async function typeTextFallback(
        botMessage,
        text
      ) {

        const cleaned =
          cleanBotText(
            text
          );


        botMessage.textContent =
          "";


        for (
          let i = 0;
          i < cleaned.length;
          i++
        ) {

          botMessage.textContent +=
            cleaned[i];


          if (
            i % 3 === 0
          ) {

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


      /*
       * ========================================================
       * 15. Read streaming response from gateway
       * ========================================================
       *
       * Gateway forwards Langflow SSE response.
       */

      async function streamChatResponse(
        response,
        botMessage
      ) {

        if (!response.body) {

          throw new Error(
            "The chat server returned an empty response."
          );
        }


        const reader =
          response.body.getReader();


        const decoder =
          new TextDecoder(
            "utf-8"
          );


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


          if (
            result.done
          ) {
            break;
          }


          const chunk =
            decoder.decode(

              result.value,

              {
                stream: true
              }
            );


          rawResponse +=
            chunk;


          buffer +=
            chunk;


          const blocks =
            buffer.split(
              /\r?\n\r?\n/
            );


          /*
           * Last block may be incomplete.
           */

          buffer =
            blocks.pop() || "";


          for (
            const block
            of blocks
          ) {

            processStreamBlock(
              block
            );
          }
        }


        /*
         * Flush decoder.
         */

        rawResponse +=
          decoder.decode();


        /*
         * Process final partial block.
         */

        if (
          buffer.trim()
        ) {

          processStreamBlock(
            buffer
          );
        }


        /*
         * ------------------------------------------------------
         * Internal stream block processor
         * ------------------------------------------------------
         */

        function processStreamBlock(
          block
        ) {

          const parsed =
            parseSseBlock(
              block
            );


          const cleanedText =
            cleanBotText(
              parsed.text
            );


          if (
            !cleanedText
          ) {

            return;
          }


          /*
           * Real streaming token
           */

          if (
            parsed.type ===
              "token"
          ) {

            hasRealTokens =
              true;


            /*
             * Avoid exact duplicate.
             */

            if (
              cleanedText ===
                fullText
            ) {

              return;
            }


            /*
             * Some APIs send cumulative text:
             *
             * H
             * He
             * Hel
             * Hell
             * Hello
             */

            if (
              fullText &&
              cleanedText.includes(
                fullText
              )
            ) {

              fullText =
                cleanedText;


            /*
             * Ignore repeated older chunks.
             */

            } else if (

              fullText &&

              fullText.includes(
                cleanedText
              ) &&

              cleanedText.length >
                20

            ) {

              return;


            /*
             * Normal token append.
             */

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


          /*
           * Final candidate.
           */

          if (
            parsed.type ===
              "final"
          ) {

            if (
              seenFinalMessages.has(
                cleanedText
              )
            ) {

              return;
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


        /*
         * ======================================================
         * Case 1: Real token streaming worked
         * ======================================================
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
         * ======================================================
         * Case 2: Langflow provided a final answer
         * ======================================================
         */

        if (
          finalText.trim()
        ) {

          await typeTextFallback(

            botMessage,

            finalText
          );

          return;
        }


        /*
         * ======================================================
         * Case 3: Gateway/Langflow returned normal JSON
         * ======================================================
         */

        try {

          const finalJson =
            JSON.parse(
              rawResponse
            );


          const extractedFinal =
            cleanBotText(

              extractLangflowText(
                finalJson
              )
            );


          if (
            extractedFinal
          ) {

            await typeTextFallback(

              botMessage,

              extractedFinal
            );

            return;
          }

        } catch (error) {

          /*
           * Not JSON.
           */
        }


        /*
         * ======================================================
         * Case 4: Plain-text fallback
         * ======================================================
         */

        const rawText =
          cleanBotText(
            rawResponse
          );


        if (
          rawText
        ) {

          await typeTextFallback(

            botMessage,

            rawText
          );

          return;
        }


        botMessage.textContent =
          "I received an empty response from the chat server.";
      }


      /*
       * ========================================================
       * 16. Read useful error returned by gateway
       * ========================================================
       */

      async function getResponseError(
        response
      ) {

        const fallback =
          "Chat request failed.";


        try {

          const contentType =
            response.headers.get(
              "content-type"
            ) || "";


          if (
            contentType.includes(
              "application/json"
            )
          ) {

            const data =
              await response.json();


            return (
              data.detail ||
              data.message ||
              fallback
            );
          }


          const text =
            await response.text();


          if (
            text.trim()
          ) {

            return text.trim();
          }


          return fallback;


        } catch (error) {

          return fallback;
        }
      }


      /*
       * ========================================================
       * 17. Send message
       * ========================================================
       */

      async function sendMessage() {

        const userText =
          chatbotInput
            .value
            .trim();


        if (
          !userText ||
          isSending
        ) {

          return;
        }


        if (
          userText.length >
            MAX_MESSAGE_LENGTH
        ) {

          addMessage(

            "Your message is too long.",

            "error"
          );

          return;
        }


        isSending =
          true;


        chatbotInput.value =
          "";


        chatbotSend.disabled =
          true;


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
           * ----------------------------------------------------
           * Optional frontend session re-check.
           *
           * This verifies the BookStack UI session before
           * sending.
           *
           * The backend /mdh/chat MUST verify again.
           * ----------------------------------------------------
           */

          await getBookStackUser(
            true
          );


          /*
           * ----------------------------------------------------
           * SECURITY-SENSITIVE CHANGE
           * ----------------------------------------------------
           *
           * OLD:
           *
           * Browser
           *   -> langflow.mdhbookstack.duckdns.org
           *   -> x-api-key
           *   -> user_id
           *   -> session_id
           *   -> tweaks
           *
           *
           * NEW:
           *
           * Browser
           *   -> /mdh/chat
           *   -> only sends message
           *
           *
           * The backend creates:
           *
           * bookstack_user_id
           * bookstack_user_name
           * litellm_user
           * langflow_session_id
           * Langflow API key
           * Langflow Flow ID
           * ----------------------------------------------------
           */

          const response =
            await fetch(

              MDH_CHAT_ENDPOINT,

              {

                method:
                  "POST",

                /*
                 * Send the BookStack session cookie.
                 */

                credentials:
                  "same-origin",

                cache:
                  "no-store",

                headers: {

                  "Content-Type":
                    "application/json",

                  "Accept":
                    "text/event-stream",

                  /*
                   * Gateway checks this header.
                   *
                   * This also forces browser cross-origin
                   * requests to undergo CORS preflight.
                   */

                  "X-MDH-Chat-Request":
                    "1"
                },


                /*
                 * IMPORTANT:
                 *
                 * Browser sends ONLY the question.
                 */

                body:
                  JSON.stringify({

                    message:
                      userText
                  })
              }
            );


          /*
           * ----------------------------------------------------
           * Authentication failure
           * ----------------------------------------------------
           */

          if (
            response.status === 401
          ) {

            currentBookStackUser =
              null;


            const message =
              await getResponseError(
                response
              );


            throw new Error(
              message ||
              "Your BookStack session has expired. Please log in again."
            );
          }


          /*
           * Authorization failure
           */

          if (
            response.status === 403
          ) {

            const message =
              await getResponseError(
                response
              );


            throw new Error(
              message ||
              "You are not authorized to use this chat."
            );
          }


          /*
           * Other gateway/Langflow errors
           */

          if (
            !response.ok
          ) {

            const errorText =
              await getResponseError(
                response
              );


            throw new Error(
              errorText
            );
          }


          /*
           * Remove "Thinking..."
           */

          botMessage.textContent =
            "";


          /*
           * Forwarded Langflow SSE response.
           */

          await streamChatResponse(

            response,

            botMessage
          );


        } catch (error) {

          botMessage.remove();


          addMessage(

            "Error: " +
              (
                error.message ||
                "Unable to contact the MDH assistant."
              ),

            "error"
          );


          console.error(
            "MDH chatbot error:",
            error
          );


        } finally {

          isSending =
            false;


          chatbotSend.disabled =
            false;


          chatbotInput.focus();
        }
      }


      /*
       * ========================================================
       * 18. Event listeners
       * ========================================================
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

          if (
            event.key ===
              "Enter"
          ) {

            event.preventDefault();

            sendMessage();
          }
        }
      );

    }
  );


  /*
   * ============================================================
   * 19. BookStack user authentication
   * ============================================================
   *
   * Browser uses this ONLY to:
   *
   * - determine whether chatbot should appear
   * - show user name in welcome message
   *
   * It must NOT be considered sufficient backend authorization.
   *
   * /mdh/chat must independently verify the BookStack session.
   * ============================================================
   */

  let currentBookStackUser =
    null;


  let bookStackUserRequest =
    null;


  async function getBookStackUser(
    forceRefresh
  ) {

    if (
      currentBookStackUser &&
      !forceRefresh
    ) {

      return currentBookStackUser;
    }


    /*
     * Prevent simultaneous duplicate requests.
     */

    if (
      bookStackUserRequest
    ) {

      return bookStackUserRequest;
    }


    bookStackUserRequest =
      fetch(

        MDH_SESSION_ENDPOINT,

        {

          method:
            "GET",

          credentials:
            "same-origin",

          cache:
            "no-store",

          headers: {

            "Accept":
              "application/json"
          }
        }
      )


      .then(
        async function (
          response
        ) {

          /*
           * BookStack may redirect unauthenticated requests
           * to /login.
           */

          if (
            response.redirected ||
            response.url.includes(
              "/login"
            )
          ) {

            currentBookStackUser =
              null;


            throw new Error(
              "Your BookStack login session has expired. Please log in again."
            );
          }


          /*
           * Authentication failure.
           */

          if (
            response.status === 401 ||
            response.status === 403
          ) {

            currentBookStackUser =
              null;


            throw new Error(
              "You must be logged in to BookStack to use the MDH assistant."
            );
          }


          /*
           * Other errors.
           */

          if (
            !response.ok
          ) {

            let errorMessage =
              "Unable to verify the logged-in BookStack user.";


            try {

              const errorData =
                await response.json();


              errorMessage =
                errorData.message ||
                errorData.detail ||
                errorMessage;


            } catch (error) {

              /*
               * Keep default message.
               */
            }


            throw new Error(
              errorMessage
            );
          }


          /*
           * Parse response.
           */

          const data =
            await response.json();


          /*
           * ==================================================
           * IMPORTANT SECURITY CHANGE
           * ==================================================
           *
           * OLD:
           *
           * authenticated=false
           *      ->
           * guest
           *      ->
           * continue to Langflow
           *
           *
           * NEW:
           *
           * authenticated=false
           *      ->
           * STOP
           * ==================================================
           */

          if (
            data.authenticated !==
              true
          ) {

            currentBookStackUser =
              null;


            throw new Error(
              "You must be logged in to BookStack to use the MDH assistant."
            );
          }


          /*
           * BookStack user ID is required.
           */

          if (
            data.bookstack_user_id ===
              undefined ||

            data.bookstack_user_id ===
              null
          ) {

            currentBookStackUser =
              null;


            throw new Error(
              "Unable to identify the logged-in BookStack user."
            );
          }


          /*
           * Save user information only for frontend display.
           *
           * The backend must NOT trust values from this browser
           * when determining Langflow identity.
           */

          currentBookStackUser = {

            id:
              String(
                data.bookstack_user_id
              ),

            name:
              data.bookstack_user_name ||
              "BookStack User",

            email:
              data.bookstack_user_email ||
              ""
          };


          return currentBookStackUser;
        }
      )


      .finally(
        function () {

          bookStackUserRequest =
            null;
        }
      );


    return bookStackUserRequest;
  }


  /*
   * ============================================================
   * 20. Update welcome message
   * ============================================================
   */

  function updateWelcomeMessage(
    bookStackUser
  ) {

    const chatbotWelcome =
      document.getElementById(
        "mdh-chatbot-welcome"
      );


    if (
      !chatbotWelcome
    ) {

      return;
    }


    if (
      bookStackUser &&
      bookStackUser.name
    ) {

      chatbotWelcome.textContent =
        "Hello " +
        bookStackUser.name +
        "! How can I help you today?";


    } else {

      chatbotWelcome.textContent =
        "Hello! How can I help you today?";
    }
  }

})();