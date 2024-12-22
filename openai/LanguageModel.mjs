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
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.credentials.apiKey}`,
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
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async promptStreaming(prompt, options = {}) {
    if (this.useWindowAI) {
      const session = await window.ai.languageModel.create(this.options);
      return session.promptStreaming(prompt, options);
    }

    // Use OpenAI-compatible endpoint with streaming
    const response = await fetch(this.config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.credentials.apiKey}`,
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
    });

    return (async function* () {
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        const text = decoder.decode(chunk);
        // Extract the JSON data after "data: "
        const jsonStr = text.replace('data: ', '').trim();
        // Return if it's the `[DONE]` message
        if (jsonStr ==='[DONE]') {
          return;
        };
        try {
          const data = JSON.parse(jsonStr);
          // Get the content if it exists in the delta
          const {content} = 'delta' in data.choices[0] ? data.choices[0].delta : data.choices[0];
          yield content
        } catch (e) {
          // Handle any JSON parsing errors
          throw new Error('Failed to parse JSON stream: ' + e?.message);
        }
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
