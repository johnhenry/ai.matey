import { Session as Session_, Capabilities } from "./LanguageModel.mjs";

class Session extends Session_ {
  constructor(options = {}, useWindowAI = false, config = {}) {
    // Add default system prompt for writing
    const systemPrompt = options.systemPrompt || 
      "You are a skilled writer with expertise in various writing styles and tones. Your task is to create high-quality, engaging content that matches the requested tone and length while maintaining clarity and effectiveness. You excel at adapting your writing style to different contexts and purposes.";
    
    super({ ...options, systemPrompt }, useWindowAI, config);
  }

  #generateWritePrompt(task, options = {}) {
    const tone = options.tone || this.options.tone || "neutral";
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

    prompt += `Task: ${task}\n\n`;
    prompt += `Please write in a ${tone} tone and aim for ${length} length.`;

    return prompt;
  }

  async write(task, options = {}) {
    const prompt = this.#generateWritePrompt(task, options);
    return this.prompt(prompt);
  }

  async writeStreaming(task, options = {}) {
    const prompt = this.#generateWritePrompt(task, options);
    return this.promptStreaming(prompt);
  }
}

class Writer {
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

export { Writer, Session };
export default Writer;
