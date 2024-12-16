export interface AIConfig {
  endpoint?: string;
  credentials?: {
    apiKey: string;
    [key: string]: any;
  };
  model?: string;
}

export interface AILanguageModelCapabilities {
  available: 'no' | 'readily' | 'after-download';
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
}

export interface SessionOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
  systemPrompt?: string;
  initialPrompts?: Array<{ role: string; content: string }>;
  monitor?: (monitor: EventTarget) => void;
}

export interface PromptOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
}

export declare class Session {
  constructor(options?: SessionOptions, useWindowAI?: boolean, config?: AIConfig);
  prompt(prompt: string, options?: PromptOptions): Promise<string>;
  promptStreaming(prompt: string, options?: PromptOptions): Promise<ReadableStream<string>>;
  destroy(): Promise<void>;
}

export declare class LanguageModel {
  constructor(config?: AIConfig);
  capabilities(): Promise<AILanguageModelCapabilities>;
  create(options?: SessionOptions): Promise<Session>;
}
