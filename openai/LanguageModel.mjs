class Session {
  constructor(options = {}, useWindowAI = false, config = {}) {
    this.options = options;
    this.useWindowAI = useWindowAI;
    this.config = config;
  }

  async prompt(prompt, options = {}) {
    if (this.useWindowAI) {
      const session = await window.ai.languageModel.create(this.options);
      const response = await session.prompt(prompt, options);
      return response;
    }

    // Use OpenAI-compatible endpoint
    const response = await fetch(
      `${this.config.endpoint}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.credentials?.apiKey || ""}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            ...(this.options.systemPrompt
              ? [{ role: "system", content: this.options.systemPrompt }]
              : []),
            ...(this.options.initialPrompts || []),
            { role: "user", content: prompt },
          ],
          temperature: options.temperature ?? this.options.temperature,
          top_k: options.topK ?? this.options.topK,
        }),
      }
    );

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async promptStreaming(prompt, options = {}) {
    if (this.useWindowAI) {
      const session = await window.ai.languageModel.create(this.options);
      return session.promptStreaming(prompt, options);
    }

    // Use OpenAI-compatible endpoint with streaming
    const response = await fetch(
      `${this.config.endpoint}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.credentials?.apiKey || ""}`,
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            ...(this.options.systemPrompt
              ? [{ role: "system", content: this.options.systemPrompt }]
              : []),
            ...(this.options.initialPrompts || []),
            { role: "user", content: prompt },
          ],
          temperature: options.temperature ?? this.options.temperature,
          top_k: options.topK ?? this.options.topK,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${error}`);
    }

    return (async function* () {
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader();

      let buffer = "";
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          
          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
            
            if (trimmedLine.startsWith("data: ")) {
              try {
                const jsonStr = trimmedLine.slice(6); // Remove "data: " prefix
                const data = JSON.parse(jsonStr);
                if (data.choices?.[0]?.delta?.content) {
                  yield data.choices[0].delta.content;
                } else if (data.choices?.[0]?.message?.content) {
                  yield data.choices[0].message.content;
                }
              } catch (error) {
                console.error("Failed to parse SSE message:", trimmedLine);
                console.error("Parse error:", error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }

  async destroy() {
    if (this.useWindowAI) {
      const session = await window.ai.languageModel.create(this.options);
      await session.destroy();
    }
    // For OpenAI endpoints, no explicit cleanup needed
  }
}
const Capabilities = {
  available: "readily",
  defaultTopK: 3,
  maxTopK: 8,
  defaultTemperature: 1.0,
};

class LanguageModel {
  constructor(config = {}) {
    this.config = config;
    this.useWindowAI = Object.keys(config).length === 0;
  }

  async capabilities() {
    if (this.useWindowAI) {
      return await window.ai.languageModel.capabilities();
    }
    // For OpenAI endpoints, return default capabilities
    return Capabilities;
  }

  async create(options = {}) {
    return new Session(options, this.useWindowAI, this.config);
  }
}

export { LanguageModel, Session, Capabilities };
export default LanguageModel;
