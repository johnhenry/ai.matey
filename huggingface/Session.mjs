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

// Deep copy utility
function deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj);
    }
    if (obj instanceof Array) {
        const copy = [];
        for (let i = 0; i < obj.length; i++) {
            copy[i] = deepCopy(obj[i]);
        }
        return copy;
    }
    if (obj instanceof Object) {
        const copy = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                copy[key] = deepCopy(obj[key]);
            }
        }
        return copy;
    }
    throw new Error("Unable to copy obj! Its type isn't supported.");
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
      Accept: "text/event-stream", 
    };
    // Map common option names to Hugging Face specific ones if necessary
    options.temperature = options.temperature ?? this.ai.languageModel._capabilities.defaultTemperature;
    options.top_k = options.topK ?? this.ai.languageModel._capabilities.defaultTopK;
    options.max_tokens = options.maxTokens; // Assuming maxTokens is the HF parameter

    // This variable will store messages in the LanguageModelMessage format for history updates.
    let historyInputMessages_before_hf_transform = [];
    // This variable will store messages transformed for the Hugging Face API.
    let hfMessages = [];

    // 1. System Prompt
    let systemContent = "";
    if (this.options.systemPrompt) {
      systemContent = this.options.systemPrompt;
    }
    (this.options.initialPrompts || []).forEach(msg => {
      if (msg.role === "system") {
        if (systemContent) systemContent += "\n"; 
        systemContent += msg.content;
      }
    });
    if (systemContent) {
      hfMessages.push({ role: "system", content: systemContent });
    }

    // 2. User/Assistant Prompts from initialPrompts (non-system)
    (this.options.initialPrompts || []).forEach(msg => {
      if (msg.role !== "system") {
        historyInputMessages_before_hf_transform.push(deepCopy(msg));
        hfMessages.push(deepCopy(msg)); 
      }
    });
    
    // 3. Conversation History
    const conversationHistory = this._getConversationHistory();
    historyInputMessages_before_hf_transform.push(...deepCopy(conversationHistory));
    hfMessages.push(...deepCopy(conversationHistory));

    // 4. Current Input
    if (typeof input === "string") {
      const userMessage = { role: "user", content: input };
      historyInputMessages_before_hf_transform.push(deepCopy(userMessage));
      hfMessages.push(deepCopy(userMessage)); 
    } else if (Array.isArray(input)) { // LanguageModelMessage[]
      historyInputMessages_before_hf_transform.push(...deepCopy(input));
      hfMessages.push(...deepCopy(input)); 
    } else {
      throw new Error("Invalid input type for promptStreaming. Must be string or array.");
    }
    
    // At this point, `historyInputMessages_before_hf_transform` contains the messages
    // as they should be for history update (original format).
    // `hfMessages` contains the same for now, and will be transformed for multimodal if applicable.
    // For Hugging Face, we'll assume text-only for now as per instructions,
    // and will adjust after documentation check.

    // 5. Multimodal Transformation (Placeholder - ASSUMING TEXT ONLY for now)
    // This section will be revised after checking Hugging Face documentation.
    // For now, ensure content is string and warn/discard image parts.
    const processedHfMessages = await Promise.all(
        hfMessages.map(async (msg) => {
            if (Array.isArray(msg.content)) {
                let textContent = "";
                let hasNonText = false;
                for (const part of msg.content) {
                    if (part.type === "text") {
                        textContent += (textContent ? "\n" : "") + part.value;
                    } else {
                        hasNonText = true;
                        console.warn(`Hugging Face Chat Completions: Non-text part of type '${part.type}' found and will be discarded. Multimodal support TBD.`);
                    }
                }
                if (hasNonText && !textContent) {
                   // If only non-text parts, this might be an issue.
                   // For now, let it pass as an empty string or handle as an error.
                   console.error("Hugging Face Chat Completions: Message content resulted in empty text after discarding non-text parts.");
                   return { ...msg, content: "" }; // Or throw error
                }
                return { ...msg, content: textContent };
            }
            return msg; // Content is already a string or not an array
        })
    );
    
    const requestBody = {
      messages: processedHfMessages,
      temperature: options.temperature,
      top_k: options.top_k,
      max_tokens: options.max_tokens,
      stream: true,
    };
    // Remove undefined options to avoid issues with the API
    Object.keys(requestBody).forEach(key => requestBody[key] === undefined && delete requestBody[key]);

    const response = await fetch(
      `${this.config.endpoint}/models/${this.config.model}/v1/chat/completions`,
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
             // Original input was a string, use it directly for _addToHistory
            this._addToHistory(input, assistantResponseText);
          } else if (Array.isArray(input)) {
            // Original input was an array.
            // `historyInputMessages_before_hf_transform` contains the full context before assistant's reply.
            this._setConversationHistory([
              ...historyInputMessages_before_hf_transform,
              { role: "assistant", content: assistantResponseText },
            ]);
          }
          break;
        }

        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          if (line.trim() === "") continue;
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") {
              // This part is reached if [DONE] is not the last part of the stream / buffer.
              // The main history update is in the `if (done)` block.
              // However, if the stream ends exactly with `data: [DONE]\n\n`, this might be triggered first.
              // To avoid double history update, we ensure the primary one is after the loop.
              // If for some reason the loop doesn't break on `done` but receives `[DONE]` here,
              // we can also update and return.
              if (responseChunks.length > 0) { // Only update if we have some content.
                const assistantResponseText = responseChunks.join("");
                 if (typeof input === "string") {
                    this._addToHistory(input, assistantResponseText);
                  } else if (Array.isArray(input)) {
                    this._setConversationHistory([
                      ...historyInputMessages_before_hf_transform,
                      { role: "assistant", content: assistantResponseText },
                    ]);
                  }
              }
              return; 
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed?.choices?.[0]?.delta?.content) {
                const content = parsed.choices[0].delta.content;
                responseChunks.push(content);
                yield content;
              }
            } catch (e) {
              console.error("Error parsing SSE data for Hugging Face:", dataStr, e);
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
