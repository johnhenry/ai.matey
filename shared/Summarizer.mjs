const create = (Session_, Capabilities) => {

  class Session extends Session_ {
    #sharedContext = "";
    constructor(options = {}, useWindowAI = false, config = {}) {
      // Add default system prompt for summarization
      const systemPrompt =
        options.systemPrompt ||
        "You are a highly skilled summarizer. Provide ONLY the summary without any introductions, explanations, or conclusions. Your summaries should be clear, accurate, and concise while preserving key information and main points. Never add phrases like 'Here's a summary' or 'In conclusion'. Just provide the summary directly.";
      super({ ...options, systemPrompt }, useWindowAI, config);
      this.#sharedContext = options.sharedContext;
    }

    #generateSummaryPrompt(text, options = {}) {
      const type = options.type || this.options.type || "teaser"; // headline, tl;dr, key-points, teaser
      const length = options.length || this.options.length || "medium"; // short, medium, long
      const context = options.context || "";
      const sharedContext = this.#sharedContext || "";

      let prompt = "";
      if (sharedContext) {
        prompt += `Context: ${sharedContext}\n\n`;
      }
      if (context) {
        prompt += `Additional context: ${context}\n\n`;
      }

      prompt += "Text to summarize:\n" + text + "\n\n";
      prompt += "Provide ONLY the requested summary in the following format:\n\n";

      switch (type) {
        case "headline":
          prompt += "Generate a concise headline that captures the main point.";
          break;
        case "tl;dr":
          prompt +=
            "Provide a TL;DR (Too Long; Didn't Read) summary. that is no more that two sentences long.";
          break;
        case "key-points":
          prompt += "List the key points in bullet (*) format.";
          break;
        case "teaser":
          prompt += "Write a teaser summary that piques interest.";
          break;
        default: // paragraph
          prompt += `Write a ${length} summary in paragraph form.`;
      }

      return prompt;
    }

    async summarize(text, options = {}) {
      const prompt = this.#generateSummaryPrompt(text, options);
      return this.prompt(prompt);
    }

    async summarizeStreaming(text, options = {}) {
      const prompt = this.#generateSummaryPrompt(text, options);
      return this.promptStreaming(prompt);
    }
  }

  class Summarizer {
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

  return { Session, Summarizer };
}
export default create;