// Mock implementation of window.ai API

// Constants for the mock implementation
const MOCK_MAX_TOKENS = 4096; // Session can retain last 4,096 tokens
const MOCK_PER_PROMPT_LIMIT = 1024; // Per prompt limit of 1,024 tokens
const MOCK_CAPABILITIES = {
  available: "readily",
  defaultTopK: 3,
  maxTopK: 8,
  defaultTemperature: 1.0,
};

// Helper function to count tokens (simple approximation)
const countTokens = (text) => Math.ceil(text.length / 4); // 1 token per ~4 characters

// Helper function to validate temperature
const validateTemperature = (temp) => {
  if (temp < 0.0 || temp > 2.0) {
    throw new Error("Temperature must be between 0.0 and 2.0");
  }
};

// Mock session class implementing AILanguageModelSession
class MockAILanguageModelSession {
  #destroyed = false;
  #tokensSoFar = 0;
  #systemPrompt = "";
  #conversationHistory = [];
  #temperature;
  #topK;
  #signal;
  #progressInterval;

  constructor(options = {}) {
    // Validate temperature if provided
    if (options.temperature !== undefined) {
      validateTemperature(options.temperature);
      this.#temperature = options.temperature;
    } else {
      this.#temperature = MOCK_CAPABILITIES.defaultTemperature;
    }

    // Validate topK if provided
    if (options.topK !== undefined) {
      if (options.topK > MOCK_CAPABILITIES.maxTopK) {
        throw new Error(`topK cannot exceed ${MOCK_CAPABILITIES.maxTopK}`);
      }
      this.#topK = options.topK;
    } else {
      this.#topK = MOCK_CAPABILITIES.defaultTopK;
    }

    this.#signal = options.signal;

    // Initialize conversation history with system prompt if provided
    if (options.systemPrompt) {
      this.#systemPrompt = options.systemPrompt;
      this.#conversationHistory.push({
        role: "system",
        content: options.systemPrompt,
      });
      this.#tokensSoFar += countTokens(options.systemPrompt);
    }

    // Add initial prompts if provided
    if (options.initialPrompts) {
      for (const prompt of options.initialPrompts) {
        this.#conversationHistory.push(prompt);
        this.#tokensSoFar += countTokens(prompt.content);
      }
    }

    // Simulate download progress if monitor is provided
    if (options.monitor) {
      const monitor = {
        addEventListener: (event, callback) => {
          if (event === "downloadprogress") {
            // Simulate progress asynchronously
            let loaded = 0;
            const total = 1000000;
            this.#progressInterval = setInterval(() => {
              loaded += 100000;
              callback({ loaded, total });
              if (loaded >= total) {
                clearInterval(this.#progressInterval);
                this.#progressInterval = null;
              }
            }, 10);
          }
        },
      };
      options.monitor(monitor);
    }
  }

  get tokensSoFar() {
    return this.#tokensSoFar;
  }

  get maxTokens() {
    return MOCK_MAX_TOKENS;
  }

  get tokensLeft() {
    return this.maxTokens - this.tokensSoFar;
  }

  #checkDestroyed() {
    if (this.#destroyed) {
      throw new Error("Session has been destroyed");
    }
  }

  #checkSignal(signal) {
    if (signal?.aborted || this.#signal?.aborted) {
      throw new DOMException("Operation was aborted", "AbortError");
    }
  }

  #mockResponse(prompt) {
    // Simple mock response generation based on conversation history
    const responses = {
      "Tell me a joke":
        "Why don't scientists trust atoms? Because they make up everything!",
      "What is the capital of Italy?": "The capital of Italy is Rome.",
      "Write me a poem!":
        "Roses are red\nViolets are blue\nThis is a mock\nJust testing with you!",
      default: `I'm a mock AI assistant. I understand your prompt was: ${prompt}`,
    };

    // Consider system prompt in response if set
    if (this.#systemPrompt && this.#systemPrompt.includes("translator")) {
      return `Translated: ${prompt}`;
    }

    return responses[prompt] || responses.default;
  }

  async prompt(text, options = {}) {
    this.#checkDestroyed();
    this.#checkSignal(options.signal);

    // Count tokens for the prompt
    const promptTokens = countTokens(text);
    if (promptTokens > MOCK_PER_PROMPT_LIMIT) {
      throw new Error("Prompt exceeds token limit");
    }

    // Generate response
    const response = this.#mockResponse(text);
    const responseTokens = countTokens(response);

    // Check if total tokens would exceed limit
    const totalNewTokens = promptTokens + responseTokens;
    if (this.#tokensSoFar + totalNewTokens > this.maxTokens) {
      throw new Error("Session token limit exceeded");
    }

    // Add user prompt to history and count its tokens
    this.#conversationHistory.push({
      role: "user",
      content: text,
    });
    this.#tokensSoFar += promptTokens;

    // Add response to history and count its tokens
    this.#conversationHistory.push({
      role: "assistant",
      content: response,
    });
    this.#tokensSoFar += responseTokens;

    return response;
  }

  async promptStreaming(text, options = {}) {
    this.#checkDestroyed();
    this.#checkSignal(options.signal);

    // Count tokens for the prompt
    const promptTokens = countTokens(text);
    if (promptTokens > MOCK_PER_PROMPT_LIMIT) {
      throw new Error("Prompt exceeds token limit");
    }

    // Generate response
    const response = this.#mockResponse(text);
    const responseTokens = countTokens(response);

    // Check if total tokens would exceed limit
    const totalNewTokens = promptTokens + responseTokens;
    if (this.#tokensSoFar + totalNewTokens > this.maxTokens) {
      throw new Error("Session token limit exceeded");
    }

    // Add user prompt to history and count its tokens
    this.#conversationHistory.push({
      role: "user",
      content: text,
    });
    this.#tokensSoFar += promptTokens;

    const self = this;
    // Create ReadableStream for response
    return new ReadableStream({
      async pull(controller) {
        try {
          self.#checkSignal(options.signal);

          // Add response to history and count its tokens
          self.#conversationHistory.push({
            role: "assistant",
            content: response,
          });
          self.#tokensSoFar += responseTokens;

          controller.enqueue(response);
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  async clone(options = {}) {
    this.#checkDestroyed();

    return new MockAILanguageModelSession({
      systemPrompt: this.#systemPrompt,
      temperature: this.#temperature,
      topK: this.#topK,
      signal: options.signal,
    });
  }

  destroy() {
    if (this.#progressInterval) {
      clearInterval(this.#progressInterval);
      this.#progressInterval = null;
    }
    this.#destroyed = true;
    this.#conversationHistory = [];
  }
}

// Mock implementation of window.ai.languageModel namespace
const languageModel = {
  async capabilities() {
    return { ...MOCK_CAPABILITIES };
  },

  async create(options = {}) {
    // Simulate download progress if monitor is provided
    if (options.monitor) {
      const monitor = {
        addEventListener: (event, callback) => {
          if (event === "downloadprogress") {
            // Simulate progress asynchronously
            let loaded = 0;
            const total = 1000000;
            const interval = setInterval(() => {
              loaded += 100000;
              callback({ loaded, total });
              if (loaded >= total) {
                clearInterval(interval);
              }
            }, 10);
          }
        },
      };
      options.monitor(monitor);
    }

    return new MockAILanguageModelSession(options);
  },
};

export { languageModel };

export default languageModel;
