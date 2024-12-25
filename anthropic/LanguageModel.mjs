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

    // Use Anthropic API endpoint
    const response = await fetch(`${this.config.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.credentials?.apiKey || "",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.config.model || "claude-3-opus-20240229",
        system: this.options.systemPrompt,
        messages: [
          ...(this.options.initialPrompts || []).filter(
            (msg) => msg.role === "user" || msg.role === "assistant"
          ),
          { role: "user", content: prompt },
        ],
        temperature: options.temperature ?? this.options.temperature ?? 1.0,
        max_tokens: options.maxTokens ?? this.options.maxTokens ?? 4096,
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Anthropic API Error: ${data.error.message}`);
    }
    return data.content[0].text;
  }

  async promptStreaming(prompt, options = {}) {
    if (this.useWindowAI) {
      const session = await window.ai.languageModel.create(this.options);
      return session.promptStreaming(prompt, options);
    }

    // Use Anthropic API endpoint with streaming
    const response = await fetch(`${this.config.endpoint}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.credentials?.apiKey || "",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: this.config.model || "claude-3-opus-20240229",
        system: this.options.systemPrompt,
        messages: [
          ...(this.options.initialPrompts || []).filter(
            (msg) => msg.role === "user" || msg.role === "assistant"
          ),
          { role: "user", content: prompt },
        ],
        temperature: options.temperature ?? this.options.temperature ?? 1.0,
        max_tokens: options.maxTokens ?? this.options.maxTokens ?? 4096,
        stream: true,
      }),
    });

    return (async function* () {
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        const text = decoder.decode(new Uint8Array(chunk));
        // Split into separate messages
        const messages = text.split("\n");

        for (const message of messages) {
          // Skip empty messages
          if (!message.trim()) continue;

          // Extract the JSON data after "data: "
          const jsonStr = message.replace("data: ", "").trim();
          if (jsonStr === "[DONE]") {
            return;
          }

          try {
            const data = JSON.parse(jsonStr);
            const content = data.content?.[0]?.text;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip parsing errors for empty or incomplete messages
            if (message.trim() && !message.includes("data: ")) {
              throw new Error("Failed to parse JSON stream: " + e?.message);
            }
          }
        }
      }
    })();
  }

  async destroy() {
    if (this.useWindowAI) {
      const session = await window.ai.languageModel.create(this.options);
      await session.destroy();
    }
    // For Anthropic API endpoints, no explicit cleanup needed
  }
}

const Capabilities = {
  available: "readily",
  defaultTemperature: 1.0,
  maxTemperature: 2.0,
  defaultMaxTokens: 4096,
  maxMaxTokens: 4096,
};

class LanguageModel {
  constructor(config = {}) {
    this.config = {
      ...config,
    };
    this.useWindowAI = Object.keys(config).length === 0;
  }

  async capabilities() {
    if (this.useWindowAI) {
      return await window.ai.languageModel.capabilities();
    }
    // For Anthropic API endpoints, return default capabilities
    return Capabilities;
  }

  async create(options = {}) {
    return new Session(options, this.useWindowAI, this.config);
  }
}

export { LanguageModel, Session, Capabilities };
export default LanguageModel;
