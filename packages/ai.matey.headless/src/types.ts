/**
 * Headless Chat Client Types
 *
 * Type definitions for the framework-agnostic chat client.
 *
 * @module
 */

import type {
  IRMessage,
  IRChatResponse,
  IRStreamChunk,
  IRUsage,
  IRParameters,
  IRTool,
} from 'ai.matey.types';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration options for creating a chat instance.
 */
export interface ChatConfig {
  /**
   * The Bridge or BackendAdapter to use for requests.
   * Can be either a Bridge instance or a raw BackendAdapter.
   */
  readonly backend: ChatBackend;

  /**
   * System prompt to prepend to all conversations.
   * Can be a string or a function that returns a string (for dynamic prompts).
   */
  readonly systemPrompt?: string | (() => string | Promise<string>);

  /**
   * Maximum number of messages to keep in history.
   * Older messages are dropped when limit is exceeded.
   * @default 100
   */
  readonly historyLimit?: number;

  /**
   * Default parameters for all requests.
   * Can be overridden per-request.
   */
  readonly defaultParameters?: IRParameters;

  /**
   * Available tools for the conversation.
   */
  readonly tools?: readonly IRTool[];

  /**
   * Called when a tool needs to be executed.
   * If not provided, tool calls will be included in responses but not executed.
   */
  readonly onToolCall?: ToolCallHandler;

  /**
   * Auto-execute tool calls and continue the conversation.
   * Requires onToolCall to be set.
   * @default false
   */
  readonly autoExecuteTools?: boolean;

  /**
   * Maximum number of consecutive tool call rounds.
   * Prevents infinite loops when autoExecuteTools is enabled.
   * @default 10
   */
  readonly maxToolRounds?: number;
}

/**
 * Backend interface - either a Bridge or BackendAdapter.
 * Both have execute() and executeStream() methods.
 */
export interface ChatBackend {
  execute(
    request: import('ai.matey.types').IRChatRequest,
    signal?: AbortSignal
  ): Promise<IRChatResponse>;

  executeStream?(
    request: import('ai.matey.types').IRChatRequest,
    signal?: AbortSignal
  ): AsyncGenerator<IRStreamChunk, void, undefined>;
}

/**
 * Handler for tool calls.
 */
export type ToolCallHandler = (
  toolName: string,
  toolInput: Record<string, unknown>,
  toolId: string
) => Promise<string | { content: string; isError?: boolean }>;

// ============================================================================
// Request Options
// ============================================================================

/**
 * Options for a single chat request.
 */
export interface SendOptions {
  /**
   * Override default parameters for this request.
   */
  readonly parameters?: IRParameters;

  /**
   * AbortSignal to cancel the request.
   */
  readonly signal?: AbortSignal;

  /**
   * Custom metadata to include in the request.
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Options for streaming requests.
 */
export interface StreamOptions extends SendOptions {
  /**
   * Called for each content chunk.
   */
  readonly onChunk?: (chunk: StreamChunkEvent) => void;

  /**
   * Called when streaming starts.
   */
  readonly onStart?: (metadata: { requestId: string }) => void;

  /**
   * Called when streaming completes.
   */
  readonly onDone?: (response: ChatResponse) => void;

  /**
   * Called on error.
   */
  readonly onError?: (error: Error) => void;

  /**
   * Called for tool use chunks.
   */
  readonly onToolUse?: (tool: { id: string; name: string; input: string }) => void;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Simplified chat response.
 */
export interface ChatResponse {
  /**
   * The assistant's response content as a string.
   */
  readonly content: string;

  /**
   * The full message object.
   */
  readonly message: IRMessage;

  /**
   * Why generation stopped.
   */
  readonly finishReason: IRChatResponse['finishReason'];

  /**
   * Token usage for this response.
   */
  readonly usage?: IRUsage;

  /**
   * Tool calls in the response, if any.
   */
  readonly toolCalls?: readonly ToolCall[];

  /**
   * Request ID for correlation.
   */
  readonly requestId: string;
}

/**
 * Tool call extracted from response.
 */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: Record<string, unknown>;
}

/**
 * Stream chunk event for callbacks.
 */
export interface StreamChunkEvent {
  /**
   * The delta content (new text only).
   */
  readonly delta: string;

  /**
   * Accumulated content so far.
   */
  readonly accumulated: string;

  /**
   * Chunk sequence number.
   */
  readonly sequence: number;
}

// ============================================================================
// State Types
// ============================================================================

/**
 * Conversation state snapshot.
 */
export interface ConversationState {
  /**
   * All messages in the conversation.
   */
  readonly messages: readonly IRMessage[];

  /**
   * Whether a request is currently in progress.
   */
  readonly isLoading: boolean;

  /**
   * Current error, if any.
   */
  readonly error: Error | null;

  /**
   * Cumulative token usage across the conversation.
   */
  readonly totalUsage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };

  /**
   * Number of requests made.
   */
  readonly requestCount: number;
}

/**
 * Event types emitted by the chat instance.
 */
export type ChatEventType =
  | 'message'
  | 'stream-start'
  | 'stream-chunk'
  | 'stream-done'
  | 'error'
  | 'state-change';

/**
 * Event listener callback.
 */
export type ChatEventListener<T = unknown> = (event: T) => void;

/**
 * Event data for each event type.
 */
export interface ChatEvents {
  message: { message: IRMessage; response: ChatResponse };
  'stream-start': { requestId: string };
  'stream-chunk': StreamChunkEvent;
  'stream-done': { response: ChatResponse };
  error: { error: Error };
  'state-change': { state: ConversationState };
}
