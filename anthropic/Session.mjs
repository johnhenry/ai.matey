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

          if (trimmedLine.startsWith("event: ")) {
            currentEvent = trimmedLine.slice(7);
            continue;
          }

          if (trimmedLine.startsWith("data: ")) {
            const data = trimmedLine.slice(6);

            // Correctly check for the "message_stop" event for Anthropic
            if (currentEvent === "message_stop") {
              const assistantResponseText = responseChunks.join("");
              if (typeof input === "string") {
                this._addToHistory(input, assistantResponseText);
              } else if (Array.isArray(input)) {
                // `workingMessages` at this point contains:
                // initialPrompts (non-system) + _getConversationHistory() + input (array from user)
                // This is the complete history *before* the assistant's response.
                this._setConversationHistory([
                  ...workingMessages,
                  { role: "assistant", content: assistantResponseText },
                ]);
              }
              return; // End of stream processing
            }

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
                // No default case needed as we only care about specific events for text
              }
            } catch (error) {
              // console.error("Failed to parse SSE message:", trimmedLine, "Event:", currentEvent);
              // console.error("Parse error:", error);
              // It's possible some non-JSON data or keep-alive pings might appear.
              // Depending on strictness, might log or ignore. For now, log.
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      // Final history update if loop exited unexpectedly (e.g. stream closed without message_stop)
      // This is a fallback, primary history update should be on "message_stop"
      // Fallback history update if stream ends without 'message_stop'
      if (currentEvent !== "message_stop" && responseChunks.length > 0) {
        const assistantResponseText = responseChunks.join("");
        if (typeof input === "string") {
          this._addToHistory(input, assistantResponseText);
        } else if (Array.isArray(input)) {
          this._setConversationHistory([
            ...workingMessages,
            { role: "assistant", content: assistantResponseText },
          ]);
        }
      }
    }
  }
}

export default Session;
