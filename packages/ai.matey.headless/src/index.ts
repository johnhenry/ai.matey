/**
 * ai.matey.headless
 *
 * Framework-agnostic chat client for the AI Matey universal adapter system.
 *
 * This package provides a headless chat client that works directly with the
 * Bridge or BackendAdapter, without requiring any UI framework.
 *
 * @example
 * ```typescript
 * import { createChat } from 'ai.matey.headless';
 * import { AnthropicBackend } from 'ai.matey.backend.anthropic';
 *
 * const chat = createChat({
 *   backend: new AnthropicBackend({ apiKey: process.env.ANTHROPIC_API_KEY }),
 *   systemPrompt: 'You are a helpful assistant.',
 * });
 *
 * // Non-streaming
 * const response = await chat.send('Hello!');
 * console.log(response.content);
 *
 * // Streaming with callbacks
 * await chat.stream('Tell me a story', {
 *   onChunk: ({ delta }) => process.stdout.write(delta),
 * });
 *
 * // Or use stream utilities directly
 * const stream = backend.executeStream(request);
 * for await (const text of streamToText(stream)) {
 *   process.stdout.write(text);
 * }
 * ```
 *
 * @module
 */

// Core chat client
export { Chat, createChat } from './chat.js';

// Stream utilities
export {
  collectStream,
  processStream,
  streamToText,
  streamToLines,
  throttleStream,
  teeStream,
} from './stream-utils.js';

// Types
export type {
  // Configuration
  ChatConfig,
  ChatBackend,
  ToolCallHandler,

  // Request options
  SendOptions,
  StreamOptions,

  // Response types
  ChatResponse,
  ToolCall,
  StreamChunkEvent,

  // State types
  ConversationState,
  ChatEventType,
  ChatEventListener,
  ChatEvents,
} from './types.js';

export type { CollectedStream, TransformStreamOptions } from './stream-utils.js';
