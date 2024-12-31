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

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.credentials?.apiKey || ""}`,
      'Accept': 'application/json',
    };

    // Use Hugging Face model-specific endpoint
    const response = await fetch(
      `${this.config.endpoint}/${this.config.model}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
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

    if (!response.ok) {
      const error = await response.text();
      console.error("Error body:", error);
      throw new Error(`HTTP error! status: ${response.status}, body: ${error}`);
    }

    try {
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      throw error;
    }
  }

  async promptStreaming(prompt, options = {}) {
    if (this.useWindowAI) {
      const session = await window.ai.languageModel.create(this.options);
      return session.promptStreaming(prompt, options);
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.credentials?.apiKey || ""}`,
      'Accept': 'text/event-stream',
    };

    // Use Hugging Face model-specific endpoint with streaming
    const response = await fetch(
      `${this.config.endpoint}/${this.config.model}/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
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
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim() === "") continue;
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") return;
              try {
                const parsed = JSON.parse(data);
                if (parsed?.choices?.[0]?.delta?.content) {
                  yield parsed.choices[0].delta.content;
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
}

export default Session;
