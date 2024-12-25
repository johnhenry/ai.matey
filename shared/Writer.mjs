const create = (Session_, Capabilities) => {
  class Session extends Session_ {
    #sharedContext = "";
  
    constructor(options = {}, useWindowAI = false, config = {}) {
      // Add default system prompt for writing
      const systemPrompt =
        options.systemPrompt ||
        "You are a skilled writer. Provide ONLY the requested content without any introductions, explanations, or conclusions. Never add phrases like 'Here's what I wrote' or 'I hope this helps'. Never explain your writing choices. Just provide the content directly in the requested tone and length.";
      super({ ...options, systemPrompt }, useWindowAI, config);
      this.#sharedContext = options.sharedContext;
    }
  
    #generateWritePrompt(task, options = {}) {
      const tone = options.tone || this.options.tone || "neutral"; // formal, neutral, casusal
      const length = options.length || this.options.length || "medium"; // short, medium, long
      const context = options.context || "";
      const format = options.format || "plain-text"; // plain-text, markdown
      const sharedContext = this.#sharedContext || "";
  
      let prompt = "";
      if (sharedContext) {
        prompt += `Context: ${sharedContext}\n\n`;
      }
      if (context) {
        prompt += `Additional context: ${context}\n\n`;
      }
  
      prompt += `Writing task: ${task}\n\n`;
      prompt += `Output Format: ${format}\n\n`;
      prompt += `Write the content in a ${tone} tone, aiming for ${length} length. Provide ONLY the content with no additional commentary.`;
  
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

  return { Session, Writer };
}
export default create;
