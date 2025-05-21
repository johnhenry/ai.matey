import SharedSession from "../shared/Session.mjs";

class Session extends SharedSession {
  async prompt(prompt, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.credentials?.apiKey || ""}`,
      Accept: "application/json", 
    };
    options.temperature =
      options.temperature ??
      this.ai.languageModel._capabilities.defaultTemperature;

    const messages = [
      ...(this.options.systemPrompt
        ? [{ role: "system", content: this.options.systemPrompt }]
        : []),
      ...(this.options.initialPrompts || []),
      ...this._getConversationHistory(),
      { role: "user", content: prompt },
    ];

    const body = {
      model: this.config.model,
      messages, // Directly use messages array
      ...options,
    };

    const response = await fetch(
      `${this.config.endpoint}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Qwen API Error Body:", errorText); // Log Qwen error
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    try {
      const data = await response.json();
      // Expecting response in data.choices[0].message.content
      const assistantResponse = data.choices[0].message.content; 
      
      this._addToHistory(prompt, assistantResponse);
      return assistantResponse;
    } catch (error) {
      console.error("Error parsing Qwen API response:", error);
      throw error; 
    }
  }

  async *promptStreaming(prompt, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.credentials?.apiKey || ""}`,
      Accept: "text/event-stream", // For SSE
    };
    options.temperature =
      options.temperature ??
      this.ai.languageModel._capabilities.defaultTemperature;

    const messages = [
      ...(this.options.systemPrompt
        ? [{ role: "system", content: this.options.systemPrompt }]
        : []),
      ...(this.options.initialPrompts || []),
      ...this._getConversationHistory(),
      { role: "user", content: prompt },
    ];
    
    const body = {
      model: this.config.model,
      messages, // Directly use messages array
      ...options,
      stream: true, // Enable streaming
    };

    const response = await fetch(
      `${this.config.endpoint}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Qwen API Streaming Error Body:", errorText); // Log Qwen error
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const responseChunks = [];
    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          this._addToHistory(prompt, responseChunks.join(""));
          break;
        }

        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === "data: [DONE]") {
            continue;
          }
          
          if (trimmedLine.startsWith("data:")) {
            const jsonStr = trimmedLine.substring(5).trim();
            try {
              const data = JSON.parse(jsonStr);
              let content = "";
              // Expecting content in data.choices[0].delta.content or data.choices[0].message.content
              if (data.choices && data.choices.length > 0) {
                if (data.choices[0].delta && data.choices[0].delta.content) {
                  content = data.choices[0].delta.content;
                } else if (data.choices[0].message && data.choices[0].message.content) {
                  // Fallback for potential last message or different chunk format
                  content = data.choices[0].message.content;
                }
              }

              if (content) {
                responseChunks.push(content);
                yield content;
              }
            } catch (error) {
              console.error("Qwen API: Error parsing stream data JSON:", error, "Original line:", trimmedLine);
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
