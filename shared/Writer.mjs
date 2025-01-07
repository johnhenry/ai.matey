import LanguageModel from "./LanguageModel.mjs";

const Writer = class extends LanguageModel {
  constructor(Session, config = {}) {
    super(Session, config);
    this.session =  class extends Session{
      #sharedContext = "";

      constructor(options = {}, config = {}) {
        // Add default system prompt for writing
        const systemPrompt =
          options.systemPrompt ||
          "You are a skilled writer. Provide ONLY the requested content without any introductions, explanations, or conclusions. Never add phrases like 'Here's what I wrote' or 'I hope this helps'. Never explain your writing choices. Just provide the content directly in the requested tone and length.";
        super({ ...options, systemPrompt }, config);
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
  }
  async create(options = {}) {
    return new this.session(options, this.config);
  }
}

export default Writer;