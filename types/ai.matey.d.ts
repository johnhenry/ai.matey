declare module "ai.matey/openai" {
  export interface AIConfig {
    endpoint?: string;
    credentials: {
      apiKey: string;
    };
    model?: string;
  }

  export interface LanguageModel {
    prompt: <T = string>(
      text: string,
      options: {
        signal: AbortSignal;
        max_tokens?: number;
        stop_sequences?: string[];
      }
    ) => Promise<T>;
    destroy: () => void;
  }

  export class AI {
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

declare module "ai.matey/mock" {
  export interface AICapabilities {
    available: string;
    defaultTopK: number;
    maxTopK: number;
    defaultTemperature: number;
  }

  export interface ProgressMonitor {
    addEventListener(
      event: "downloadprogress",
      callback: (progress: { loaded: number; total: number }) => void
    ): void;
  }

  export interface ConversationMessage {
    role: "system" | "user" | "assistant";
    content: string;
  }

  export interface SessionOptions {
    temperature?: number;
    topK?: number;
    systemPrompt?: string;
    signal?: AbortSignal;
    initialPrompts?: ConversationMessage[];
    monitor?: (monitor: ProgressMonitor) => void;
  }

  export interface AILanguageModelSession {
    readonly tokensSoFar: number;
    readonly maxTokens: number;
    readonly tokensLeft: number;
    prompt(text: string, options?: { signal?: AbortSignal }): Promise<string>;
    promptStreaming(
      text: string,
      options?: { signal?: AbortSignal }
    ): Promise<ReadableStream>;
    clone(options?: { signal?: AbortSignal }): Promise<AILanguageModelSession>;
    destroy(): void;
  }

  export interface LanguageModel {
    capabilities(): Promise<AICapabilities>;
    create(options?: SessionOptions): Promise<AILanguageModelSession>;
  }

  export interface MocAIkAI {
    languageModel: LanguageModel;
  }

  const ai: MockAI;
  export default ai;
}
