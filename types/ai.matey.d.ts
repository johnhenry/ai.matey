declare module "ai.matey/openai" {
  interface AIConfig {
    endpoint?: string;
    credentials?: {
      apiKey: string;
    };
    model?: string;
  }

  interface LanguageModel {
    prompt: (text: string, options: { signal: AbortSignal }) => Promise<string>;
    destroy: () => void;
  }

  class AI {
    constructor(config: AIConfig);
    languageModel: {
      create: (config: {
        temperature?: number;
        topK?: number;
        systemPrompt?: string;
      }) => Promise<LanguageModel>;
    };
  }

  export default AI;
}
