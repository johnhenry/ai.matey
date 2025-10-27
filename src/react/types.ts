/**
 * React Hooks Types
 *
 * TypeScript types for React hooks integration with ai.matey.
 * These types are compatible with Vercel AI SDK API.
 *
 * @module
 */

import type { BackendAdapter } from '../types/adapters.js';

// ============================================================================
// Message Types
// ============================================================================

/**
 * UI message type compatible with Vercel AI SDK.
 */
export interface UIMessage {
  /**
   * Unique message ID.
   */
  id: string;

  /**
   * Message role.
   */
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool';

  /**
   * Message content.
   */
  content: string;

  /**
   * Creation timestamp.
   */
  createdAt?: Date;

  /**
   * Experimental: Tool invocations.
   */
  toolInvocations?: ToolInvocation[];
}

/**
 * Tool invocation data.
 */
export interface ToolInvocation {
  /**
   * Tool call ID.
   */
  toolCallId: string;

  /**
   * Tool name.
   */
  toolName: string;

  /**
   * Tool arguments.
   */
  args: Record<string, unknown>;

  /**
   * Tool result (if completed).
   */
  result?: unknown;

  /**
   * Tool call state.
   */
  state: 'partial-call' | 'call' | 'result';
}

// ============================================================================
// Hook Options
// ============================================================================

/**
 * Options for useChat hook.
 */
export interface UseChatOptions {
  /**
   * Unique chat ID for shared state.
   */
  id?: string;

  /**
   * Initial messages.
   */
  initialMessages?: UIMessage[];

  /**
   * Backend adapter to use.
   */
  backend: BackendAdapter;

  /**
   * Model to use.
   * @default 'gpt-4'
   */
  model?: string;

  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * Temperature (0-2).
   */
  temperature?: number;

  /**
   * Callback when response finishes.
   */
  onFinish?: (message: UIMessage) => void | Promise<void>;

  /**
   * Error callback.
   */
  onError?: (error: Error) => void;

  /**
   * Callback for each response chunk (streaming).
   */
  onResponse?: (response: string) => void;

  /**
   * Enable/disable streaming.
   * @default true
   */
  streaming?: boolean;

  /**
   * Custom headers for HTTP requests (if using HTTP backend).
   */
  headers?: Record<string, string>;

  /**
   * Custom request body additions.
   */
  body?: Record<string, unknown>;

  /**
   * Request credentials mode.
   */
  credentials?: 'omit' | 'same-origin' | 'include';
}

/**
 * Options for useCompletion hook.
 */
export interface UseCompletionOptions {
  /**
   * Unique completion ID for shared state.
   */
  id?: string;

  /**
   * Initial input value.
   */
  initialInput?: string;

  /**
   * Initial completion value.
   */
  initialCompletion?: string;

  /**
   * Backend adapter to use.
   */
  backend: BackendAdapter;

  /**
   * Model to use.
   */
  model?: string;

  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * Temperature (0-2).
   */
  temperature?: number;

  /**
   * Callback when completion finishes.
   */
  onFinish?: (prompt: string, completion: string) => void | Promise<void>;

  /**
   * Error callback.
   */
  onError?: (error: Error) => void;

  /**
   * Callback for each response chunk (streaming).
   */
  onResponse?: (text: string) => void;

  /**
   * Enable/disable streaming.
   * @default true
   */
  streaming?: boolean;

  /**
   * Custom headers for HTTP requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom request body additions.
   */
  body?: Record<string, unknown>;
}

/**
 * Options for useObject hook.
 */
export interface UseObjectOptions<T = any> {
  /**
   * Unique object generation ID for shared state.
   */
  id?: string;

  /**
   * Backend adapter to use.
   */
  backend: BackendAdapter;

  /**
   * Model to use.
   * @default 'gpt-4'
   */
  model?: string;

  /**
   * Schema for validation (Zod schema).
   * If provided, the generated object will be validated against this schema.
   *
   * @example
   * ```typescript
   * import { z } from 'zod';
   *
   * const schema = z.object({
   *   name: z.string(),
   *   age: z.number(),
   * });
   * ```
   */
  schema?: any; // Zod schema type (any to avoid hard dependency)

  /**
   * Maximum tokens to generate.
   */
  maxTokens?: number;

  /**
   * Temperature (0-2).
   */
  temperature?: number;

  /**
   * Callback when object generation finishes.
   */
  onFinish?: (object: T) => void | Promise<void>;

  /**
   * Error callback.
   */
  onError?: (error: Error) => void;

  /**
   * Enable/disable streaming.
   * @default true
   */
  streaming?: boolean;

  /**
   * Custom headers for HTTP requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom request body additions.
   */
  body?: Record<string, unknown>;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Chat status.
 */
export type ChatStatus = 'idle' | 'streaming' | 'error';

/**
 * Return type for useChat hook.
 */
export interface UseChatHelpers {
  /**
   * All messages in the chat.
   */
  messages: UIMessage[];

  /**
   * Current input value.
   */
  input: string;

  /**
   * Set input value.
   */
  setInput: (input: string) => void;

  /**
   * Handle input change event.
   */
  handleInputChange: (event: {
    target: { value: string };
    preventDefault?: () => void;
  }) => void;

  /**
   * Handle form submit event.
   */
  handleSubmit: (event?: {
    preventDefault?: () => void;
  }) => void;

  /**
   * Send a message programmatically.
   */
  sendMessage: (message: string) => Promise<void>;

  /**
   * Append a message to the chat.
   */
  append: (message: UIMessage | Omit<UIMessage, 'id'>) => Promise<void>;

  /**
   * Reload/regenerate the last assistant response.
   */
  reload: () => Promise<void>;

  /**
   * Stop the current stream.
   */
  stop: () => void;

  /**
   * Set messages array.
   */
  setMessages: (messages: UIMessage[]) => void;

  /**
   * Current status.
   */
  status: ChatStatus;

  /**
   * Is currently streaming.
   */
  isLoading: boolean;

  /**
   * Current error (if any).
   */
  error: Error | undefined;
}

/**
 * Completion status.
 */
export type CompletionStatus = 'idle' | 'loading' | 'error';

/**
 * Return type for useCompletion hook.
 */
export interface UseCompletionHelpers {
  /**
   * Current completion result.
   */
  completion: string;

  /**
   * Current input value.
   */
  input: string;

  /**
   * Set input value.
   */
  setInput: (input: string) => void;

  /**
   * Handle input change event.
   */
  handleInputChange: (event: {
    target: { value: string };
    preventDefault?: () => void;
  }) => void;

  /**
   * Handle form submit event.
   */
  handleSubmit: (event?: {
    preventDefault?: () => void;
  }) => void;

  /**
   * Trigger completion programmatically.
   */
  complete: (prompt: string) => Promise<string | null>;

  /**
   * Set completion value.
   */
  setCompletion: (completion: string) => void;

  /**
   * Stop the current stream.
   */
  stop: () => void;

  /**
   * Is currently loading.
   */
  isLoading: boolean;

  /**
   * Current error (if any).
   */
  error: Error | undefined;
}

/**
 * Return type for useObject hook.
 */
export interface UseObjectHelpers<T = any> {
  /**
   * The generated object (progressively updated during streaming).
   */
  object: T | undefined;

  /**
   * Submit a prompt to generate an object.
   */
  submit: (prompt: string) => Promise<T | null>;

  /**
   * Set the object value directly.
   */
  setObject: (object: T | undefined) => void;

  /**
   * Stop the current stream.
   */
  stop: () => void;

  /**
   * Is currently loading/generating.
   */
  isLoading: boolean;

  /**
   * Current error (if any).
   */
  error: Error | undefined;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * React types (will be loaded dynamically).
 */
export type React = any;
