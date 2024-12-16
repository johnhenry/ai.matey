import { Session as Session_, Capabilities } from "./LanguageModel.mjs";

class Session extends Session_ {
  constructor(options = {}, useWindowAI = false, config = {}) {
    // Add default system prompt for summarization
    const systemPrompt = options.systemPrompt || 
      "You are a highly skilled summarizer. Your task is to create clear, accurate, and concise summaries while preserving the key information and main points of the original text. Adapt your summarization style based on the requested type and length.";
    
    super({ ...options, systemPrompt }, useWindowAI, config);
  }

  #generateSummaryPrompt(text, options = {}) {
    const type = options.type || this.options.type || "paragraph";
    const length = options.length || this.options.length || "medium";
    const context = options.context || "";
    const sharedContext = this.options.sharedContext || "";

    let prompt = "";
    if (sharedContext) {
      prompt += `Context: ${sharedContext}\n\n`;
    }
    if (context) {
      prompt += `Additional context: ${context}\n\n`;
    }

    prompt += "Text to summarize:\n" + text + "\n\n";

    switch (type) {
      case "headline":
        prompt += "Generate a concise headline that captures the main point.";
        break;
      case "tl;dr":
        prompt += "Provide a TL;DR (Too Long; Didn't Read) summary.";
        break;
      case "bullet-points":
        prompt += "Summarize the key points in bullet points.";
        break;
      default: // paragraph
        prompt += `Generate a ${length} summary in paragraph form.`;
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

export { Summarizer, Session };
export default Summarizer;
