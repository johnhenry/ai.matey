import { SessionOptions, Session, AIConfig, AILanguageModelCapabilities } from './languageModel';

export interface SummarizerOptions extends SessionOptions {
  type?: 'headline' | 'tl;dr' | 'key-points' | 'teaser';
  length?: 'short' | 'medium' | 'long';
  sharedContext?: string;
}

export interface SummarizeOptions {
  type?: 'headline' | 'tl;dr' | 'key-points' | 'teaser';
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
