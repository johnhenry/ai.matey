/**
 * React Core Types
 *
 * Type definitions for React hooks and utilities.
 *
 * @module
 */

// Types are self-contained for React package portability

// Import IR types for backend mode (optional dependency)
import type {
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk,
  IRParameters,
  IRTool,
} from 'ai.matey.types';

/**
 * Backend adapter interface for direct mode.
 * This allows using a BackendAdapter or Bridge directly without HTTP.
 */
export interface DirectBackend {
  execute(
    request: IRChatRequest,
    signal?: AbortSignal
  ): Promise<IRChatResponse>;

  executeStream?(
    request: IRChatRequest,
    signal?: AbortSignal
  ): AsyncGenerator<IRStreamChunk, void, undefined>;
}

/**
 * Handler for tool calls in direct mode.
 */
export type DirectToolCallHandler = (
  toolName: string,
  toolInput: Record<string, unknown>,
  toolId: string
) => Promise<string | { content: string; isError?: boolean }>;

/**
 * Direct backend mode options.
 */
export interface DirectModeOptions {
  /**
   * The backend adapter to use (Bridge or BackendAdapter).
   */
  backend: DirectBackend;

  /**
   * System prompt to prepend to conversations.
   */
  systemPrompt?: string | (() => string | Promise<string>);

  /**
   * Default IR parameters for requests.
   */
  defaultParameters?: IRParameters;

  /**
   * Available tools for the conversation.
   */
  tools?: readonly IRTool[];

  /**
   * Handler for tool calls.
   */
  onToolCall?: DirectToolCallHandler;

  /**
   * Auto-execute tools and continue the conversation.
   * @default false
   */
  autoExecuteTools?: boolean;

  /**
   * Maximum tool execution rounds.
   * @default 10
   */
  maxToolRounds?: number;
}

/**
 * Message in a chat conversation.
 */
export interface Message {
  /** Unique message ID */
  id: string;
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Creation timestamp */
  createdAt?: Date;
  /** Tool calls made by this message */
  toolCalls?: ToolCall[];
  /** Tool invocations and results */
  toolInvocations?: ToolInvocation[];
}

/**
 * Tool call request.
 */
export interface ToolCall {
  /** Tool call ID */
  id: string;
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * Tool invocation with result.
 */
export interface ToolInvocation {
  /** Tool call ID */
  toolCallId: string;
  /** Tool name */
  toolName: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Tool result */
  result?: unknown;
  /** Invocation state */
  state: 'pending' | 'completed' | 'error';
}

/**
 * Chat hook options.
 *
 * Supports two modes:
 * 1. HTTP Mode (default): Uses `api` endpoint with fetch
 * 2. Direct Mode: Uses `direct.backend` with wrapper-ir for direct backend access
 */
export interface UseChatOptions {
  /** Initial messages */
  initialMessages?: Message[];
  /** Initial input value */
  initialInput?: string;
  /** Chat ID for persistence */
  id?: string;

  // -------------------------------------------------------------------------
  // HTTP Mode Options (default)
  // -------------------------------------------------------------------------

  /** API endpoint for chat */
  api?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body extras */
  body?: Record<string, unknown>;
  /** Stream protocol */
  streamProtocol?: 'text' | 'data';
  /** Called for each response chunk (HTTP mode only) */
  onResponse?: (response: Response) => void;

  // -------------------------------------------------------------------------
  // Direct Mode Options (for using BackendAdapter directly)
  // -------------------------------------------------------------------------

  /**
   * Direct backend mode configuration.
   * When provided, bypasses HTTP and uses the backend adapter directly.
   */
  direct?: DirectModeOptions;

  // -------------------------------------------------------------------------
  // Common Options
  // -------------------------------------------------------------------------

  /** Generate unique message IDs */
  generateId?: () => string;
  /** Called when response stream finishes */
  onFinish?: (message: Message) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Keep last message on error */
  keepLastMessageOnError?: boolean;
  /** Max number of automatic tool retries */
  maxToolRoundtrips?: number;
  /** Send extra message fields */
  sendExtraMessageFields?: boolean;
}

/**
 * Chat hook return value.
 */
export interface UseChatReturn {
  /** Chat messages */
  messages: Message[];
  /** Current input value */
  input: string;
  /** Set input value */
  setInput: (input: string) => void;
  /** Handle input change */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Handle form submit */
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>, options?: ChatRequestOptions) => void;
  /** Submit message programmatically */
  append: (message: Message | string, options?: ChatRequestOptions) => Promise<string | null | undefined>;
  /** Reload last message */
  reload: (options?: ChatRequestOptions) => Promise<string | null | undefined>;
  /** Stop streaming */
  stop: () => void;
  /** Set messages */
  setMessages: (messages: Message[] | ((messages: Message[]) => Message[])) => void;
  /** Whether currently loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | undefined;
  /** Data from API */
  data?: unknown[];
}

/**
 * Chat request options.
 */
export interface ChatRequestOptions {
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body extras */
  body?: Record<string, unknown>;
  /** Data to send */
  data?: Record<string, string>;
  /** Tools to use */
  tools?: Record<string, Tool>;
}

/**
 * Tool definition.
 */
export interface Tool {
  /** Tool description */
  description?: string;
  /** Tool parameter schema */
  parameters: Record<string, unknown>;
  /** Execute the tool */
  execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Completion hook options.
 */
export interface UseCompletionOptions {
  /** Initial prompt */
  initialInput?: string;
  /** Initial completion */
  initialCompletion?: string;
  /** Completion ID */
  id?: string;
  /** API endpoint */
  api?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body extras */
  body?: Record<string, unknown>;
  /** Called when completion finishes */
  onFinish?: (prompt: string, completion: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Called for each response chunk */
  onResponse?: (response: Response) => void;
  /** Stream protocol */
  streamProtocol?: 'text' | 'data';
}

/**
 * Completion hook return value.
 */
export interface UseCompletionReturn {
  /** Current completion */
  completion: string;
  /** Current input */
  input: string;
  /** Set input */
  setInput: (input: string) => void;
  /** Handle input change */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Handle form submit */
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
  /** Complete programmatically */
  complete: (prompt: string, options?: CompletionRequestOptions) => Promise<string | null | undefined>;
  /** Stop streaming */
  stop: () => void;
  /** Set completion */
  setCompletion: (completion: string) => void;
  /** Whether currently loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | undefined;
  /** Data from API */
  data?: unknown[];
}

/**
 * Completion request options.
 */
export interface CompletionRequestOptions {
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body extras */
  body?: Record<string, unknown>;
}

/**
 * Object hook options.
 */
export interface UseObjectOptions<T> {
  /** API endpoint */
  api?: string;
  /** Schema for validation */
  schema?: unknown;
  /** Initial object value */
  initialValue?: Partial<T>;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body extras */
  body?: Record<string, unknown>;
  /** Called on finish */
  onFinish?: (event: { object: T | undefined; error: Error | undefined }) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Object hook return value.
 */
export interface UseObjectReturn<T> {
  /** Partial object being streamed */
  object: Partial<T> | undefined;
  /** Submit a prompt */
  submit: (prompt: string) => void;
  /** Stop streaming */
  stop: () => void;
  /** Whether currently loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | undefined;
}
