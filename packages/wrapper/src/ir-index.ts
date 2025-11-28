/**
 * ai.matey.wrapper.ir
 *
 * IR-native chat wrapper for the AI Matey universal adapter system.
 *
 * This package provides a chat client that works directly with the
 * IR (Intermediate Representation) format.
 *
 * @example
 * ```typescript
 * import { createChat } from 'ai.matey.wrapper.ir';
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
