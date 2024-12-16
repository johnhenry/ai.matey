import { Session as Session_, Capabilities } from "./LanguageModel.mjs";

class Session extends Session_ {
  constructor(options = {}, useWindowAI = false, config = {}) {
    // Add default system prompt for rewriting
    const systemPrompt = options.systemPrompt || 
      "You are an expert editor specializing in text transformation and improvement. Your task is to rewrite text while preserving its core meaning, adapting the tone and style as requested, and enhancing clarity and effectiveness. You excel at making text more accessible, formal, or constructive while maintaining the author's intent.";
    
    super({ ...options, systemPrompt }, useWindowAI, config);
  }

  #generateRewritePrompt(text, options = {}) {
    const tone = options.tone || this.options.tone || "neutral";
    const context = options.context || "";
    const sharedContext = this.options.sharedContext || "";
    const goal = options.goal || "improve";

    let prompt = "";
    if (sharedContext) {
      prompt += `Context: ${sharedContext}\n\n`;
    }
    if (context) {
      prompt += `Additional context: ${context}\n\n`;
    }

    prompt += "Original text:\n" + text + "\n\n";
    prompt += `Please rewrite this text with a ${tone} tone. `;

    switch (goal) {
      case "simplify":
        prompt += "Make it simpler and easier to understand.";
        break;
      case "formalize":
        prompt += "Make it more formal and professional.";
        break;
      case "constructive":
        prompt += "Make it more constructive and positive.";
        break;
      default: // improve
        prompt += "Improve its clarity and effectiveness while maintaining the original meaning.";
    }

    return prompt;
  }

  async rewrite(text, options = {}) {
    const prompt = this.#generateRewritePrompt(text, options);
    return this.prompt(prompt);
  }

  async rewriteStreaming(text, options = {}) {
    const prompt = this.#generateRewritePrompt(text, options);
    return this.promptStreaming(prompt);
  }
}

class ReWriter {
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

export { ReWriter, Session };
export default ReWriter;
