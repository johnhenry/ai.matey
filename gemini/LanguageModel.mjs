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

    // Use Gemini API endpoint
    const response = await fetch(`${this.config.endpoint}/v1beta/models/gemini-1.5-flash:generateContent?key=${this.config.credentials.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...(this.options.systemPrompt ? [{ text: this.options.systemPrompt }] : []),
              ...(this.options.initialPrompts || []).map(p => ({ text: p.content })),
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: options.temperature ?? this.options.temperature ?? 1.0,
          topK: options.topK ?? this.options.topK ?? 10,
          topP: options.topP ?? this.options.topP ?? 0.8,
          maxOutputTokens: options.maxOutputTokens ?? this.options.maxOutputTokens ?? 800,
        }
      }),
    });

    const data = await response.json();
    if (data.error) {
      throw new Error(`Gemini API Error: ${data.error.message}`);
    }
    return data.candidates[0].content.parts[0].text;
  }

  async promptStreaming(prompt, options = {}) {
    if (this.useWindowAI) {
      const session = await window.ai.languageModel.create(this.options);
      return session.promptStreaming(prompt, options);
    }

    // Use Gemini API endpoint with streaming
    const response = await fetch(`${this.config.endpoint}/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${this.config.credentials.apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...(this.options.systemPrompt ? [{ text: this.options.systemPrompt }] : []),
              ...(this.options.initialPrompts || []).map(p => ({ text: p.content })),
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: options.temperature ?? this.options.temperature ?? 1.0,
          topK: options.topK ?? this.options.topK ?? 10,
          topP: options.topP ?? this.options.topP ?? 0.8,
          maxOutputTokens: options.maxOutputTokens ?? this.options.maxOutputTokens ?? 800,
        }
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
            const content = data.candidates[0]?.content?.parts[0]?.text;
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
    // For Gemini endpoints, no explicit cleanup needed
  }
}

const Capabilities = {
  available: "readily",
  defaultTopK: 10,
  maxTopK: 40,
  defaultTemperature: 1.0,
};

class LanguageModel {
  constructor(config = {}) {
    this.config = {
      endpoint: "https://generativelanguage.googleapis.com",
      ...config
    };
    this.useWindowAI = Object.keys(config).length === 0;
  }

  async capabilities() {
    if (this.useWindowAI) {
      return await window.ai.languageModel.capabilities();
    }
    // For Gemini endpoints, return default capabilities
    return Capabilities;
  }

  async create(options = {}) {
    return new Session(options, this.useWindowAI, this.config);
  }
}

export { LanguageModel, Session, Capabilities };
export default LanguageModel;
