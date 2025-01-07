import SharedSession from "../shared/Session.mjs";

class Session extends SharedSession {
  async prompt(prompt, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.credentials?.apiKey || ""}`,
      'Accept': 'application/json',
    };
    options.temperature = options.temperature ?? this.ai.languageModel._capabilities.defaultTemperature;
    options.top_k = options.topK ?? this.ai.languageModel._capabilities.defaultTopK;

    const messages = [
      ...(this.options.systemPrompt
        ? [{ role: "system", content: this.options.systemPrompt }]
        : []),
      ...(this.options.initialPrompts || []),
      ...this._getConversationHistory(),
      { role: "user", content: prompt },
    ];

    const response = await fetch(
      `${this.config.endpoint}/models/${this.config.model}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
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
    options.top_k = options.topK ?? this.ai.languageModel._capabilities.defaultTopK;

    const messages = [
      ...(this.options.systemPrompt
        ? [{ role: "system", content: this.options.systemPrompt }]
        : []),
      ...(this.options.initialPrompts || []),
      ...this._getConversationHistory(),
      { role: "user", content: prompt },
    ];

    const response = await fetch(
      `${this.config.endpoint}/models/${this.config.model}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
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
            self._addToHistory(prompt, responseChunks.join(''));
            break;
          }

          buffer += value;
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim() === "") continue;
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                self._addToHistory(prompt, responseChunks.join(''));
                return;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed?.choices?.[0]?.delta?.content) {
                  const content = parsed.choices[0].delta.content;
                  responseChunks.push(content);
                  yield content;
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    })();
  }

  clone() {
    const clonedSession = new Session(this.options, this.ai);
    clonedSession._conversationHistory = [...this._conversationHistory];
    return clonedSession;
  }

  destroy() {
    this._conversationHistory = [];
  }
}

export default Session;
