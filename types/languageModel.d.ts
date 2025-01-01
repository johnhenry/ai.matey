export { AIConfig } from './ai.matey';
export { AICapabilities } from './ai.matey';
export { SessionOptions } from './ai.matey';
export { AILanguageModelSession } from './ai.matey';

export interface PromptOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
}

export declare class Session implements AILanguageModelSession {
  constructor(options?: SessionOptions, useWindowAI?: boolean, config?: AIConfig);
  readonly tokensSoFar: number;
  readonly maxTokens: number;
  readonly tokensLeft: number;
  prompt(text: string, options?: PromptOptions): Promise<string>;
  promptStreaming(text: string, options?: PromptOptions): Promise<ReadableStream<string>>;
  clone(options?: { signal?: AbortSignal }): Promise<AILanguageModelSession>;
  destroy(): void;
}

export declare class LanguageModel {
  constructor(config?: AIConfig);
  capabilities(): Promise<AICapabilities>;
  create(options?: SessionOptions): Promise<Session>;
}
