import SharedSession from "../shared/Session.mjs";

class Session extends SharedSession {
  async prompt(prompt, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.credentials?.apiKey || ""}`,
      'Accept': 'application/json',
    };
    options.temperature = options.temperature ?? this.ai.languageModel._capabilities.defaultTemperature;
    
    const messages = [
      ...(this.options.systemPrompt
        ? [{ role: "system", content: this.options.systemPrompt }]
        : []),
      ...(this.options.initialPrompts || []),
      ...this._getConversationHistory(),
      { role: "user", content: prompt },
    ];

    const response = await fetch(
      `${this.config.endpoint}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.config.model,
          messages,
          ...options,
        }),
      }
    );
    if (!response.ok) {
      const error = await response.text();
      console.error("Error body:", error);
      throw new Error(`HTTP error! status: ${response.status}, body: ${error}`);
    }
    try {
      const data = await response.json();
      const assistantResponse = data.choices[0].message.content;
      this._addToHistory(prompt, assistantResponse);
      return assistantResponse;
    } catch (error) {
      throw error;
    }
  }

  async promptStreaming(prompt, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.credentials?.apiKey || ""}`,
      'Accept': 'text/event-stream',
    };
    options.temperature = options.temperature ?? this.ai.languageModel._capabilities.defaultTemperature;
    
    const messages = [
      ...(this.options.systemPrompt
        ? [{ role: "system", content: this.options.systemPrompt }]
        : []),
      ...(this.options.initialPrompts || []),
      ...this._getConversationHistory(),
      { role: "user", content: prompt },
    ];

    const response = await fetch(
      `${this.config.endpoint}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.config.model,
          messages,
          ...options,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${error}`);
    }

    const responseChunks = [];
    const self = this;

    return (async function* () {
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = "";
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            // Update conversation history with complete response
            self._addToHistory(prompt, responseChunks.join(''));
            break;
          }
          
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
            
            if (trimmedLine.startsWith("data: ")) {
              try {
                const jsonStr = trimmedLine.slice(6);
                const data = JSON.parse(jsonStr);
                if (data.choices?.[0]?.delta?.content) {
                  const content = data.choices[0].delta.content;
                  responseChunks.push(content);
                  yield content;
                } else if (data.choices?.[0]?.message?.content) {
                  const content = data.choices[0].message.content;
                  responseChunks.push(content);
                  yield content;
                }
              } catch (error) {
                console.error("Parse error:", error);
              }
            } else {
              console.warn("Unexpected line format:", trimmedLine);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }
}

export default Session;
