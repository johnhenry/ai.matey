/**
 * AI Matey Wrappers
 *
 * Consolidated package containing SDK wrappers and IR utilities.
 * These wrappers allow using provider SDK patterns with any backend.
 *
 * @module ai.matey.wrapper
 */

// OpenAI SDK Wrapper - namespaced exports
export {
  OpenAI,
  ChatCompletions as OpenAIChatCompletions,
  Models as OpenAIModels,
  Chat as OpenAIChat,
} from './openai-sdk.js';

export type {
  OpenAIChatCompletionParams,
  OpenAIChatCompletionChoice,
  OpenAIChatCompletion,
  OpenAIChatCompletionChunk,
  OpenAIModelsPage,
} from './openai-sdk.js';

// Anthropic SDK Wrapper - namespaced exports
export {
  Anthropic,
  Messages as AnthropicMessages,
  Models as AnthropicModels,
} from './anthropic-sdk.js';

export type {
  AnthropicMessageParams,
  AnthropicMessage,
  AnthropicStreamEvent,
  AnthropicModelsResponse,
} from './anthropic-sdk.js';

// AnyMethod wrapper
export * from './anymethod.js';

// Chrome AI Wrappers
export * from './chrome-ai.js';
export * from './chrome-ai-legacy.js';

// IR Chat utilities (primary Chat export)
export { Chat, createChat } from './chat.js';
export type {
  ChatConfig,
  ChatBackend,
  ToolCallHandler,
  SendOptions,
  StreamOptions,
  ChatResponse,
  ToolCall,
  StreamChunkEvent,
  ConversationState,
  ChatEventType,
  ChatEventListener,
  ChatEvents,
} from './types.js';

// Stream utilities
export {
  collectStream,
  processStream,
  streamToText,
  streamToLines,
  throttleStream,
  teeStream,
} from './stream-utils.js';

export type { CollectedStream, TransformStreamOptions } from './stream-utils.js';
