import { SessionOptions, Session, AIConfig, AILanguageModelCapabilities } from './languageModel';

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
