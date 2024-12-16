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

// Base Session class
export declare class Session {
  constructor(options?: SessionOptions, useWindowAI?: boolean, config?: AIConfig);
  prompt(prompt: string, options?: PromptOptions): Promise<string>;
  promptStreaming(prompt: string, options?: PromptOptions): Promise<ReadableStream<string>>;
  destroy(): Promise<void>;
}

// Language Model
export declare class LanguageModel {
  constructor(config?: AIConfig);
  capabilities(): Promise<AILanguageModelCapabilities>;
  create(options?: SessionOptions): Promise<Session>;
}

// Summarizer Types
export interface SummarizerOptions extends SessionOptions {
  type?: 'headline' | 'tl;dr' | 'bullet-points' | 'paragraph';
  length?: 'short' | 'medium' | 'long';
  sharedContext?: string;
}

export interface SummarizeOptions {
  type?: 'headline' | 'tl;dr' | 'bullet-points' | 'paragraph';
  length?: 'short' | 'medium' | 'long';
  context?: string;
}

export declare class SummarizerSession extends Session {
  constructor(options?: SummarizerOptions, useWindowAI?: boolean, config?: AIConfig);
  summarize(text: string, options?: SummarizeOptions): Promise<string>;
  summarizeStreaming(text: string, options?: SummarizeOptions): Promise<ReadableStream<string>>;
}

export declare class Summarizer {
  constructor(config?: AIConfig);
  capabilities(): Promise<AILanguageModelCapabilities>;
  create(options?: SummarizerOptions): Promise<SummarizerSession>;
}

// Writer Types
export interface WriterOptions extends SessionOptions {
  tone?: 'formal' | 'casual' | 'neutral';
  length?: 'short' | 'medium' | 'long';
  sharedContext?: string;
}

export interface WriteOptions {
  tone?: 'formal' | 'casual' | 'neutral';
  length?: 'short' | 'medium' | 'long';
  context?: string;
}

export declare class WriterSession extends Session {
  constructor(options?: WriterOptions, useWindowAI?: boolean, config?: AIConfig);
  write(task: string, options?: WriteOptions): Promise<string>;
  writeStreaming(task: string, options?: WriteOptions): Promise<ReadableStream<string>>;
}

export declare class Writer {
  constructor(config?: AIConfig);
  capabilities(): Promise<AILanguageModelCapabilities>;
  create(options?: WriterOptions): Promise<WriterSession>;
}

// ReWriter Types
export interface ReWriterOptions extends SessionOptions {
  tone?: 'formal' | 'casual' | 'neutral';
  goal?: 'simplify' | 'formalize' | 'constructive' | 'improve';
  sharedContext?: string;
}

export interface ReWriteOptions {
  tone?: 'formal' | 'casual' | 'neutral';
  goal?: 'simplify' | 'formalize' | 'constructive' | 'improve';
  context?: string;
}

export declare class ReWriterSession extends Session {
  constructor(options?: ReWriterOptions, useWindowAI?: boolean, config?: AIConfig);
  rewrite(text: string, options?: ReWriteOptions): Promise<string>;
  rewriteStreaming(text: string, options?: ReWriteOptions): Promise<ReadableStream<string>>;
}

export declare class ReWriter {
  constructor(config?: AIConfig);
  capabilities(): Promise<AILanguageModelCapabilities>;
  create(options?: ReWriterOptions): Promise<ReWriterSession>;
}
