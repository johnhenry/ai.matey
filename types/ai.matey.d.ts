// Base Types
export interface AIConfig {
  endpoint?: string;
  credentials: {
    apiKey: string;
    [key: string]: any;
  };
  model?: string;
}

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

// Session Types
export interface SessionOptions {
  temperature?: number;
  topK?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
  initialPrompts?: ConversationMessage[];
  monitor?: (monitor: ProgressMonitor) => void;
}

export interface PromptOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
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

// Language Model Types
export interface LanguageModel {
  capabilities(): Promise<AICapabilities>;
  create(options?: SessionOptions): Promise<AILanguageModelSession>;
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

export declare class WriterSession extends Session {
  constructor(options?: WriterOptions, useWindowAI?: boolean, config?: AIConfig);
  write(task: string, options?: WriteOptions): Promise<string>;
  writeStreaming(task: string, options?: WriteOptions): Promise<ReadableStream<string>>;
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

export declare class ReWriterSession extends Session {
  constructor(options?: ReWriterOptions, useWindowAI?: boolean, config?: AIConfig);
  rewrite(text: string, options?: ReWriteOptions): Promise<string>;
  rewriteStreaming(text: string, options?: ReWriteOptions): Promise<ReadableStream<string>>;
}

export interface ReWriter {
  capabilities(): Promise<AICapabilities>;
  create(options?: ReWriterOptions): Promise<ReWriterSession>;
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

export declare class SummarizerSession extends Session {
  constructor(options?: SummarizerOptions, useWindowAI?: boolean, config?: AIConfig);
  summarize(text: string, options?: SummarizeOptions): Promise<string>;
  summarizeStreaming(text: string, options?: SummarizeOptions): Promise<ReadableStream<string>>;
}

export interface Summarizer {
  capabilities(): Promise<AICapabilities>;
  create(options?: SummarizerOptions): Promise<SummarizerSession>;
}

// Main AI Interface and Class
export interface ai {
  languageModel: LanguageModel;
  summarizer: Summarizer;
  writer: Writer;
  rewriter: ReWriter;
}

export class AI implements ai {
  constructor(config: AIConfig);
  languageModel: LanguageModel;
  summarizer: Summarizer;
  writer: Writer;
  rewriter: ReWriter;
}
// Module Declarations

export class Gemini implements AI {}
export class Anthropic implements AI {}
export class HuggingFace implements AI {}
export class OpenAI implements AI {}
export class Ollama implements AI {}
export class Mistral implements AI {}
export class Groq implements AI {}
export class NVIDIA implements AI {}

declare module "ai.matey/gemini" {
  export default Gemini;
}
declare module "ai.matey/anthropic" {
  export default Anthropic;
}
declare module "ai.matey/huggingface" {
  export default HuggingFace;
}
declare module "ai.matey/openai" {
  export default OpenAI;
}
declare module "ai.matey/ollama" {
  export default Ollama;
}
declare module "ai.matey/mistral" {
  export default Mistral;
}
declare module "ai.matey/groq" {
  export default Groq;
}
declare module "ai.matey/nvidia" {
  export default NVIDIA;
}

declare module "ai.matey" {
  export {
    Gemini,
    Anthropic,
    HuggingFace,
    Mistral,
    NVIDIA,
    Ollama,
    OpenAI,
    Groq,
    createClient };
  export
  export default function createClient(
    string:
      | "openai"
      | "ollama"
      | "gemini"
      | "anthropic"
      | "mistral"
      | "groq"
      | "nvidia"
      | "huggingface",
    config: {
      endpoint?: string;
      credentials: {
        apiKey: string;
      };
      model?: string;
    }
  ): AI;
}

declare module "ai.matey/mock" {
  export default ai;
}

declare module "ai.matey/mock-polyfill" {}

declare module "ai.matey/mock-polyfill-overwrite" {}