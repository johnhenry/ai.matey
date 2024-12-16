import { Session as Session_, Capabilities } from "./LanguageModel.mjs";

class Session extends Session_ {
  constructor(options = {}, useWindowAI = false, config = {}) {
    // Add default system prompt for rewriting
    const systemPrompt = options.systemPrompt || 
      "You are an expert editor. Provide ONLY the rewritten text without any introductions, explanations, or conclusions. Never add phrases like 'Here's the rewritten version' or 'I hope this helps'. Never explain your changes. Just provide the rewritten content directly in the requested style.";
    
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
    prompt += "Rewrite the text with the following requirements:\n";
    prompt += `- Use a ${tone} tone\n`;

    switch (goal) {
      case "simplify":
        prompt += "- Make it simpler and easier to understand\n";
        break;
      case "formalize":
        prompt += "- Make it more formal and professional\n";
        break;
      case "constructive":
        prompt += "- Make it more constructive and positive\n";
        break;
      default: // improve
        prompt += "- Improve clarity and effectiveness while maintaining the original meaning\n";
    }
    
    prompt += "\nProvide ONLY the rewritten text with no additional commentary.";

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
