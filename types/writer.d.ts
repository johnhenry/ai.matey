import { SessionOptions, Session, AIConfig, AILanguageModelCapabilities } from './languageModel';

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
