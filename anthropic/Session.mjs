import SharedSession from "../shared/Session.mjs";

class Session extends SharedSession {
  // constructor(ai, config, options = {}) {
  //   super(ai, config, options);
  //   options.max_tokens =
  //     options.maxTokens ??
  //     this.ai.languageModel._capabilities.maxTokens ??
  //     4096;
  //   this.#$;

  //   this.config = {
  //     endpoint: "https://api.anthropic.com",
  //     credentials: null,
  //     model: "claude-3-opus-20240229",
  //     ...config,
  //   };
  //   this.options = {
  //     systemPrompt: "",
  //     initialPrompts: [],
  //     ...options,
  //   };
  // }
  async prompt(input, options = {}) {
    // Utilizes promptStreaming to make the API call and handle history
    const output = [];
    for await (const message of this.promptStreaming(input, options)) {
      output.push(message);
    }
    // The history update (_addToHistory or _setConversationHistory)
    // is now handled within promptStreaming based on the input type.
    return output.join("");
  }

  async *promptStreaming(input, options = {}) {
    options.temperature =
      options.temperature ??
      this.ai.languageModel._capabilities.defaultTemperature;
    options.max_tokens =
      options.maxTokens ??
      this.ai.languageModel._capabilities.maxTokens ??
      4096;

    // System Prompt Construction
    const systemPromptsContent = [];
    if (this.options.systemPrompt) {
      systemPromptsContent.push(this.options.systemPrompt);
    }
    (this.options.initialPrompts || [])
      .filter((msg) => msg.role === "system")
      .forEach((msg) => systemPromptsContent.push(msg.content));
    const system = systemPromptsContent.join("\n");

    // Message Construction (messagesToAnthropic)
    let workingMessages = []; // Stores messages in LanguageModelMessage format

    // Add initial non-system prompts
    (this.options.initialPrompts || [])
      .filter((msg) => msg.role !== "system")
      .forEach((msg) => workingMessages.push(msg));

    // Add conversation history & current input
    if (typeof input === "string") {
      workingMessages.push(...this._getConversationHistory());
      workingMessages.push({ role: "user", content: input });
    } else if (Array.isArray(input)) {
      // If input is an array of LanguageModelMessage,
      // it means the calling context (e.g. shared/Session chat())
      // has already set the history appropriately via _setConversationHistory.
      // `_getConversationHistory()` here will return messages *up to* the current user turn.
      // `input` then contains the actual user messages for *this* turn.
      workingMessages.push(...this._getConversationHistory());
      workingMessages.push(...input); // input is LanguageModelMessage[]
    } else {
      throw new Error(
        "Invalid input type for promptStreaming. Must be string or array."
      );
    }

    const messagesToAnthropic = await Promise.all(
      workingMessages.map(async (message) => {
        let anthropicContent;
        if (typeof message.content === "string") {
          anthropicContent = [{ type: "text", text: message.content }];
        } else if (Array.isArray(message.content)) {
          anthropicContent = await Promise.all(
            message.content.map(async (part) => {
              if (part.type === "text") {
                return { type: "text", text: part.value };
              }
              if (part.type === "image") {
                let base64Data;
                let mediaType = "image/jpeg"; // Default media type
                if (typeof part.value === "string") {
                  if (part.value.startsWith("data:")) {
                    mediaType = part.value.substring(
                      part.value.indexOf(":") + 1,
                      part.value.indexOf(";")
                    );
                    base64Data = part.value.substring(
                      part.value.indexOf(",") + 1
                    );
                  } else {
                    // Assume it's already base64 if no data URI prefix
                    base64Data = part.value;
                  }
                } else if (part.value instanceof Blob) {
                  mediaType = part.value.type || mediaType;
                  base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () =>
                      resolve(reader.result.split(",")[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(part.value);
                  });
                } else if (part.value instanceof ArrayBuffer) {
                  let binary = "";
                  const bytes = new Uint8Array(part.value);
                  const len = bytes.byteLength;
                  for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                  }
                  base64Data = btoa(binary);
                } else {
                  throw new Error(
                    "Unsupported image content type for Anthropic: " +
                      typeof part.value
                  );
                }
                return {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Data,
                  },
                };
              }
              throw new Error(
                "Unsupported part type for Anthropic: " + part.type
              );
            })
          );
        } else {
           throw new Error("Unsupported message content type: " + typeof message.content);
        }
        return { role: message.role, content: anthropicContent };
      })
    );
    
    // Filter out any messages that might be empty after processing (e.g. system prompts that were already handled)
    // Also, ensure roles are appropriate (user or assistant). System messages are handled by the 'system' parameter.
    const finalMessagesForAPI = messagesToAnthropic.filter(msg => msg.role === 'user' || msg.role === 'assistant');


    const response = await fetch(`${this.config.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.credentials?.apiKey || "",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: this.config.model || "claude-3-opus-20240229",
        system: system, // Use the constructed system string
        messages: finalMessagesForAPI, // Use the transformed messages
        ...options,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${error}`);
    }

    const responseChunks = []; // Accumulates text parts of the response

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let buffer = "";
    let currentEvent = null;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          if (trimmedLine.startsWith("event:")) { // Ensure matching "event:" exactly
            currentEvent = trimmedLine.substring(6).trim(); // More robust: get text after "event:"
            continue;
          }

          if (trimmedLine.startsWith("data:")) { // Ensure matching "data:" exactly
            const data = trimmedLine.substring(5).trim(); // More robust: get text after "data:"
            
            // Note: The actual "message_stop" event itself doesn't carry data that needs parsing here for content.
            // Its occurrence (setting currentEvent to "message_stop") is the signal.
            // Parsing of data happens for other events like content_block_delta.

            try {
              const parsed = JSON.parse(data);

              switch (currentEvent) {
                case "message_start":
                  // Potentially useful for other things, but not for text content
                  break;
                case "content_block_start":
                  // Indicates start of a content block (e.g., text, image)
                  break;
                case "content_block_delta":
                  if (parsed.delta?.type === "text_delta") {
                    responseChunks.push(parsed.delta.text);
                    yield parsed.delta.text;
                  }
                  // Could handle other delta types here if needed, e.g., tool_use
                  break;
                case "content_block_stop":
                  // Indicates end of a content block
                  break;
                case "message_delta":
                  // This event might contain deltas for various things, including stop_reason
                  // The primary text delta is usually in content_block_delta
                  break;
                // No default case needed as we only care about specific events for text,
                // and message_stop is handled by checking currentEvent after the loop.
              }
            } catch (error) {
              // console.warn("Failed to parse SSE message data:", data, "for event:", currentEvent, error);
            }
          }
        } // End for (const line of lines)

        // After processing all lines in the current chunk, check if message_stop was received.
        if (currentEvent === "message_stop") {
          break; // Exit the while(true) loop, history will be updated in finally.
        }
      } // End while (true)
    } finally {
      reader.releaseLock();
      // Consolidated history update: This runs once the stream is fully processed or message_stop caused a break.
      if (responseChunks.length > 0 || currentEvent === "message_stop") { // Ensure history updates even for empty responses if message_stop occurred
        const assistantResponseText = responseChunks.join("");
        if (typeof input === "string") {
          this._addToHistory(input, assistantResponseText);
        } else if (Array.isArray(input)) {
          this._setConversationHistory([
            ...workingMessages, // These are the messages before the current assistant's response
            { role: "assistant", content: assistantResponseText },
          ]);
        }
      }
    }
  }
}

export default Session;
