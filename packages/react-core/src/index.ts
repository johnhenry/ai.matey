/**
 * AI Matey React Core
 *
 * Core React hooks for building AI-powered applications.
 *
 * @packageDocumentation
 */

// Hooks
export { useChat } from './use-chat.js';
export { useCompletion } from './use-completion.js';
export { useObject } from './use-object.js';

// Types
export type {
  Message,
  ToolCall,
  ToolInvocation,
  Tool,
  UseChatOptions,
  UseChatReturn,
  ChatRequestOptions,
  UseCompletionOptions,
  UseCompletionReturn,
  CompletionRequestOptions,
  UseObjectOptions,
  UseObjectReturn,
  // Direct mode types
  DirectBackend,
  DirectModeOptions,
  DirectToolCallHandler,
} from './types.js';
