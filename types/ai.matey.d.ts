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

declare module "ai.matey/ollama" {
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
declare module "ai.matey/gemini" {
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

declare module "ai.matey/anthropic" {
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

declare module "ai.matey/mistral" {
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

declare module "ai.matey/groq" {
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
    available: "no" | "readily" | "after-download";
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

  // Summarizer Types
  export interface SummarizerOptions extends SessionOptions {
    type?: "headline" | "tl;dr" | "key-points" | "teaser";
    length?: "short" | "medium" | "long";
    sharedContext?: string;
  }

  export interface SummarizeOptions {
    type?: "headline" | "tl;dr" | "key-points" | "teaser";
    length?: "short" | "medium" | "long";
    context?: string;
  }

  export interface SummarizerSession extends AILanguageModelSession {
    summarize(text: string, options?: SummarizeOptions): Promise<string>;
    summarizeStreaming(
      text: string,
      options?: SummarizeOptions
    ): Promise<ReadableStream>;
  }

  export interface Summarizer {
    capabilities(): Promise<AICapabilities>;
    create(options?: SummarizerOptions): Promise<SummarizerSession>;
  }

  // Writer Types
  export interface WriterOptions extends SessionOptions {
    tone?: "formal" | "casual" | "neutral";
    length?: "short" | "medium" | "long";
    sharedContext?: string;
  }

  export interface WriteOptions {
    tone?: "formal" | "casual" | "neutral";
    length?: "short" | "medium" | "long";
    context?: string;
  }

  export interface WriterSession extends AILanguageModelSession {
    write(task: string, options?: WriteOptions): Promise<string>;
    writeStreaming(
      task: string,
      options?: WriteOptions
    ): Promise<ReadableStream>;
  }

  export interface Writer {
    capabilities(): Promise<AICapabilities>;
    create(options?: WriterOptions): Promise<WriterSession>;
  }

  // ReWriter Types
  export interface ReWriterOptions extends SessionOptions {
    tone?: "formal" | "casual" | "neutral";
    goal?: "simplify" | "formalize" | "constructive" | "improve";
    sharedContext?: string;
  }

  export interface ReWriteOptions {
    tone?: "formal" | "casual" | "neutral";
    goal?: "simplify" | "formalize" | "constructive" | "improve";
    context?: string;
  }

  export interface ReWriterSession extends AILanguageModelSession {
    rewrite(text: string, options?: ReWriteOptions): Promise<string>;
    rewriteStreaming(
      text: string,
      options?: ReWriteOptions
    ): Promise<ReadableStream>;
  }

  export interface ReWriter {
    capabilities(): Promise<AICapabilities>;
    create(options?: ReWriterOptions): Promise<ReWriterSession>;
  }

  export interface MockAI {
    languageModel: LanguageModel;
    summarizer: Summarizer;
    writer: Writer;
    rewriter: ReWriter;
  }

  const ai: MockAI;
  export default ai;
}
