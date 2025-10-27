/**
 * React Hooks for ai.matey
 *
 * React hooks for building chat and completion UIs.
 * Compatible with Vercel AI SDK API.
 *
 * **Note:** This module requires React as an optional peer dependency.
 *
 * Install with:
 * ```bash
 * npm install react react-dom
 * ```
 *
 * @module
 */

// Hooks
export { useChat, isReactAvailable as isReactAvailableChat } from './use-chat.js';
export { useCompletion, isReactAvailable as isReactAvailableCompletion } from './use-completion.js';
export { useObject, isReactAvailable as isReactAvailableObject } from './use-object.js';

// Types
export type {
  UIMessage,
  ToolInvocation,
  UseChatOptions,
  UseCompletionOptions,
  UseObjectOptions,
  UseChatHelpers,
  UseCompletionHelpers,
  UseObjectHelpers,
  ChatStatus,
  CompletionStatus,
} from './types.js';

/**
 * Check if React is available for hooks.
 *
 * Since React is imported at module load time, this function will only
 * be callable if React is installed. It always returns true.
 *
 * @returns Promise that resolves to true
 *
 * @example
 * ```typescript
 * import { isReactAvailable } from 'ai.matey/react';
 *
 * if (await isReactAvailable()) {
 *   console.log('React hooks are available!');
 * }
 * ```
 */
export async function isReactAvailable(): Promise<boolean> {
  // If this module loaded, React is available
  return true;
}
