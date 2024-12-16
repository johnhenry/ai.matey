import { Session as Session_, Capabilities } from "./LanguageModel.mjs";

class Session extends Session_ {
  #sharedContext = "";
  constructor(options = {}, useWindowAI = false, config = {}) {
    // Add default system prompt for rewriting
    const systemPrompt =
      options.systemPrompt ||
      "You are an expert editor. Provide ONLY the rewritten text without any introductions, explanations, or conclusions. Never add phrases like 'Here's the rewritten version' or 'I hope this helps'. Never explain your changes. Just provide the rewritten content directly in the requested style.";
    super({ ...options, systemPrompt }, useWindowAI, config);
    this.#sharedContext = options.sharedContext;
  }
  #generateRewritePrompt(text, options = {}) {
    const tone = options.tone || this.options.tone || "as-is"; // "as-is", "more-formal", "more-casual"
    const format = options.format || "as-is"; // "as-is", "plain-text", "markdown"
    const length = this.options.length || "as-is"; // "as-is", "shorter", "longer"
    const context = options.context || "";
    const sharedContext = this.#sharedContext || "";

    let prompt = "";
    if (sharedContext) {
      prompt += `Context: ${sharedContext}\n\n`;
    }
    if (context) {
      prompt += `Additional context: ${context}\n\n`;
    }

    prompt += "Original text:\n" + text + "\n\n";
    prompt += "Rewrite the text with the following requirements:\n";
    switch (format) {
      case "plain-text":
        prompt += "- Provide the rewritten text in plain text\n";
        break;
      case "markdown":
        prompt += "- Provide the rewritten text in markdown format\n";
        break;
      default: // as-is
        prompt +=
          "- Provide the rewritten text in the same format as the original\n";
    }
    switch (length) {
      case "shorter":
        prompt += "- Make it shorter while maintaining the original meaning\n";
        break;
      case "longer":
        prompt += "- Make it longer while maintaining the original meaning\n";
        break;
      default: // as-is
        prompt += "- Keep the length as-is\n";
    }
    switch (tone) {
      case "more-formal":
        prompt += "- Use a more formal tone\n";
        break;
      case "more-casual":
        prompt += "- Use a more casual tone\n";
        break;
      default: // as-is
        prompt += "- Keep the tone as-is\n";
    }

    prompt +=
      "\nProvide ONLY the rewritten text with no additional commentary.";

    return prompt;
  }

  async rewrite(text, options = {}) {
    const prompt = this.#generateRewritePrompt(text, options);
    return this.prompt(prompt);
  }

  async rewriteStreaming(text, options = {}) {
    const prompt = this.#generateRewritePrompt(text, options);
    console.log(prompt);
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
