import SharedSession from "../shared/Session.mjs";

// Helper function to convert Blob to Data URI
async function blobToDataURI(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper function to convert ArrayBuffer to Data URI
async function arrayBufferToDataURI(buffer, mimeType = "image/jpeg") { // Default mimeType
  const blob = new Blob([buffer], { type: mimeType });
  return blobToDataURI(blob);
}

// Helper function to convert plain base64 string to Data URI
function base64ToDataURI(base64String, mimeType = "image/jpeg") {
  return `data:${mimeType};base64,${base64String}`;
}


class Session extends SharedSession {
  async prompt(input, options = {}) {
    // Utilizes promptStreaming to make the API call and handle history
    const output = [];
    for await (const message of this.promptStreaming(input, options)) {
      output.push(message);
    }
    // History update is handled within promptStreaming
    return output.join("");
  }

  async *promptStreaming(input, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.credentials?.apiKey || ""}`,
      Accept: "text/event-stream", // Changed for streaming
    };
    options.temperature =
      options.temperature ??
      this.ai.languageModel._capabilities.defaultTemperature;

    // This variable will store messages in the LanguageModelMessage format for history updates.
    let historyInputMessages_before_openai_transform = [];
    // This variable will store messages transformed for the OpenAI API.
    let openAIMessagesForAPI = [];

    // 1. System Prompt
    let systemContent = "";
    if (this.options.systemPrompt) {
      systemContent = this.options.systemPrompt;
    }
    // Concatenate any system messages from initialPrompts
    (this.options.initialPrompts || []).forEach(msg => {
      if (msg.role === "system") {
        if (systemContent) systemContent += "\n"; // Add newline if appending
        systemContent += msg.content;
      }
    });
    if (systemContent) {
      openAIMessagesForAPI.push({ role: "system", content: systemContent });
      // System messages are generally not part of `historyInputMessages_before_openai_transform`
      // as they are implicitly part of the session's configuration.
    }

    // 2. User/Assistant/Tool Prompts from initialPrompts (non-system)
    (this.options.initialPrompts || []).forEach(msg => {
      if (msg.role !== "system") {
        historyInputMessages_before_openai_transform.push(msg);
        openAIMessagesForAPI.push(JSON.parse(JSON.stringify(msg))); // Deep copy for transformation
      }
    });
    
    // 3. Conversation History
    const conversationHistory = this._getConversationHistory();
    historyInputMessages_before_openai_transform.push(...conversationHistory);
    openAIMessagesForAPI.push(...conversationHistory.map(m => JSON.parse(JSON.stringify(m)))); // Deep copy

    // 4. Current Input
    if (typeof input === "string") {
      const userMessage = { role: "user", content: input };
      historyInputMessages_before_openai_transform.push(userMessage);
      openAIMessagesForAPI.push(JSON.parse(JSON.stringify(userMessage))); // Deep copy
    } else if (Array.isArray(input)) { // LanguageModelMessage[]
      historyInputMessages_before_openai_transform.push(...input);
      openAIMessagesForAPI.push(...input.map(m => JSON.parse(JSON.stringify(m)))); // Deep copy
    } else {
      throw new Error("Invalid input type for promptStreaming. Must be string or array.");
    }

    // 5. Transform openAIMessagesForAPI Content for Multimodal
    const processedOpenAIMessages = await Promise.all(
      openAIMessagesForAPI.map(async (msg) => {
        // Only transform user messages, and only if content is array or model is vision-capable
        // Forcing transformation if content is already an array (LanguageModelMessageContent[])
        // or checking if the model is a known vision model.
        const isVisionModel = this.config.model && (this.config.model.includes("vision") || this.config.model.includes("gpt-4-turbo"));

        if (msg.role === "user" && (Array.isArray(msg.content) || isVisionModel)) {
          let parts = [];
          if (typeof msg.content === 'string') {
            // If it's a string but for a vision model, wrap it as a text part.
            parts.push({ type: "text", text: msg.content });
          } else if (Array.isArray(msg.content)) { // LanguageModelMessageContent[]
            for (const part of msg.content) {
              if (part.type === "text") {
                parts.push({ type: "text", text: part.value });
              } else if (part.type === "image") {
                let imageUrl;
                if (typeof part.value === 'string') {
                  if (part.value.startsWith('data:')) {
                    imageUrl = part.value;
                  } else { // Assume plain base64
                    imageUrl = base64ToDataURI(part.value, part.mimeType || 'image/jpeg');
                  }
                } else if (part.value instanceof Blob) {
                  imageUrl = await blobToDataURI(part.value);
                } else if (part.value instanceof ArrayBuffer) {
                  imageUrl = await arrayBufferToDataURI(part.value, part.mimeType || 'image/jpeg');
                } else {
                  console.warn("Unsupported image content value type:", typeof part.value, "for OpenAI. Skipping part.");
                  continue; 
                }
                parts.push({ type: "image_url", image_url: { url: imageUrl, detail: "auto" } });
              }
            }
          }
          // If parts is empty (e.g. only unsupported image types), and original content was a string, keep original string.
          // Otherwise, OpenAI API might error on empty content array for user message.
          if (parts.length === 0 && typeof msg.content === 'string') {
             return { ...msg, content: msg.content }; // Keep original string content
          }
          return { ...msg, content: parts };
        }
        return msg; // Return as is if not a user message needing multimodal transform or not a vision model
      })
    );
    
    const requestBody = {
      model: this.config.model,
      messages: processedOpenAIMessages,
      temperature: options.temperature, // Ensure temperature is passed
      // any other options from `options` should be spread if they are valid OpenAI params
      ...(options.maxTokens != null ? { max_tokens: options.maxTokens } : {}),
      stream: true,
    };
    // Remove undefined options to avoid issues with OpenAI API
    Object.keys(requestBody).forEach(key => requestBody[key] === undefined && delete requestBody[key]);


    const response = await fetch(
      `${this.config.endpoint}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseChunks = [];
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          const assistantResponseText = responseChunks.join("");
          // History Update
          if (typeof input === "string") {
            // For string input, _addToHistory takes the original string prompt
            this._addToHistory(input, assistantResponseText);
          } else if (Array.isArray(input)) {
            // For array input, _setConversationHistory takes the full history before this turn + this turn's input + assistant response
            // historyInputMessages_before_openai_transform correctly represents this.
            this._setConversationHistory([
              ...historyInputMessages_before_openai_transform,
              { role: "assistant", content: assistantResponseText },
            ]);
          }
          break;
        }

        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine === "" || trimmedLine === "data: [DONE]") {
            continue;
          }
          if (trimmedLine.startsWith("data: ")) {
            const jsonStr = trimmedLine.substring(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                responseChunks.push(content);
                yield content;
              }
            } catch (e) {
              console.error("Failed to parse JSON stream chunk for OpenAI:", jsonStr, e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export default Session;
