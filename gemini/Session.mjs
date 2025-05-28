import SharedSession from "../shared/Session.mjs";
import ensureAsyncIterable from "../util/ensure-async-iterator.mjs";

// Helper function to convert Blob to base64
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // result includes 'data:mime/type;base64,' prefix, remove it
      const base64Data = reader.result.split(",")[1];
      resolve({ mimeType: blob.type, data: base64Data });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Helper function to convert ArrayBuffer to base64
async function arrayBufferToBase64(buffer, mimeType = "application/octet-stream") { // Default mimeType if not known
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { mimeType, data: btoa(binary) };
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
    options.temperature =
      options.temperature ??
      this.ai.languageModel._capabilities.defaultTemperature;
    options.topK = options.topK ?? this.ai.languageModel._capabilities.defaultTopK;
    options.topP = options.topP ?? this.ai.languageModel._capabilities.topP;
    options.maxOutputTokens = options.maxTokens ?? this.ai.languageModel._capabilities.maxTokens;

    let system_instruction_object = null;
    if (this.options.systemPrompt) {
      system_instruction_object = {
        // Gemini uses 'parts' for system instructions, not 'role' directly at this level
        parts: [{ text: this.options.systemPrompt }],
      };
    }

    let working_messages_for_history = []; // Stored in LanguageModelMessage format for history update
    let gemini_api_contents = []; // Stored in Gemini API Content format

    // 1. Initial Prompts
    (this.options.initialPrompts || []).forEach((msg) => {
      working_messages_for_history.push(msg);
    });

    // 2. Conversation History & Current Input
    // Stash current working_messages before adding history and new input, for easier history update later if input is string.
    const initial_prompts_for_history = [...working_messages_for_history];

    if (typeof input === "string") {
      working_messages_for_history.push(...this._getConversationHistory());
      working_messages_for_history.push({ role: "user", content: input });
    } else if (Array.isArray(input)) {
      // input is LanguageModelMessage[]
      // As per shared/Session.mjs chat(), _setConversationHistory is called before promptStreaming.
      // So _getConversationHistory() here gets history *up to* the current user's turn.
      working_messages_for_history.push(...this._getConversationHistory());
      working_messages_for_history.push(...input);
    } else {
      throw new Error("Invalid input type. Must be string or array.");
    }
    
    // Transform for Gemini API
    gemini_api_contents = await Promise.all(working_messages_for_history.map(async (msg) => {
        const role = msg.role === "assistant" ? "model" : msg.role; // Map 'assistant' to 'model'
        let parts = [];
        if (typeof msg.content === "string") {
            parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) { // LanguageModelMessageContent[]
            parts = await Promise.all(msg.content.map(async (part) => {
                if (part.type === "text") {
                    return { text: part.value };
                } else if (part.type === "image") {
                    let mimeType = "image/jpeg"; // Default
                    let data;
                    if (part.value instanceof Blob) {
                        const base64Result = await blobToBase64(part.value);
                        mimeType = base64Result.mimeType;
                        data = base64Result.data;
                    } else if (part.value instanceof ArrayBuffer) {
                        // Try to infer mimeType if available, else use default
                        mimeType = part.mimeType || mimeType; 
                        const base64Result = await arrayBufferToBase64(part.value, mimeType);
                        data = base64Result.data;
                    } else if (typeof part.value === 'string') { // Assume base64 string or data URI
                        if (part.value.startsWith('data:')) {
                            const parts = part.value.split(',');
                            mimeType = parts[0].substring(parts[0].indexOf(':') + 1, parts[0].indexOf(';'));
                            data = parts[1];
                        } else {
                             // Potentially just a base64 string, try to get mimeType from part if provided
                            mimeType = part.mimeType || mimeType;
                            data = part.value;
                        }
                    } else {
                        throw new Error("Unsupported image content value type: " + typeof part.value);
                    }
                    return { inlineData: { mimeType, data } };
                } else {
                    throw new Error("Unsupported message content part type: " + part.type);
                }
            }));
        }
        return { role, parts };
    }));


    const requestBody = {
      contents: gemini_api_contents,
      generationConfig: {
        temperature: options.temperature,
        topK: options.topK,
        topP: options.topP,
        maxOutputTokens: options.maxOutputTokens,
        // candidateCount, stopSequences can be added if needed
      },
      ...(system_instruction_object ? { systemInstruction: system_instruction_object } : {}),
    };
    
    const response = await fetch(
      `${this.config.endpoint}/v1beta/models/${this.config.model ?? 'gemini-1.5-flash-latest'}:streamGenerateContent?alt=sse&key=${this.config.credentials?.apiKey || ""}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const responseChunks = [];
    const decoder = new TextDecoder();
    for await (const chunk of ensureAsyncIterable(response.body)) {
      const text = decoder.decode(new Uint8Array(chunk), { stream: true });
      const lines = text.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.substring("data: ".length).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;

        try {
          const data = JSON.parse(jsonStr);
          // Check if there are candidates and parts
          if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
            const content = data.candidates[0].content.parts[0].text;
            responseChunks.push(content);
            yield content;
          } else if (data.error) {
             throw new Error(`Gemini API Error in stream: ${data.error.message}`);
          }
          // Gemini might also send finishReason or other info in chunks, handle if necessary
        } catch (e) {
          console.error("Failed to parse JSON stream chunk:", jsonStr, e);
          // Decide if this is a fatal error for the stream
        }
      }
    }
    
    const assistantResponseText = responseChunks.join("");
    // History update based on the type of the original 'input'
    if (typeof input === "string") {
      this._addToHistory(input, assistantResponseText);
    } else if (Array.isArray(input)) {
      // working_messages_for_history contains: initialPrompts + _getConversationHistory() + input (array)
      this._setConversationHistory([
        ...working_messages_for_history,
        { role: "assistant", content: assistantResponseText },
      ]);
    }
  }
}
export default Session;
