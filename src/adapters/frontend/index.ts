/**
 * Frontend Adapters
 *
 * Export all frontend adapters and related types for creating custom frontends.
 *
 * @example Creating a custom frontend
 * ```typescript
 * import type {
 *   FrontendAdapter,
 *   AdapterMetadata
 * } from 'ai.matey/adapters/frontend';
 * import type { IRChatRequest, IRChatResponse } from 'ai.matey/adapters/frontend';
 *
 * export class MyCustomFrontend implements FrontendAdapter<MyRequest, MyResponse, MyChunk> {
 *   readonly metadata: AdapterMetadata = {
 *     name: 'my-custom-frontend',
 *     version: '1.0.0',
 *     provider: 'MyProvider',
 *     capabilities: { // ... }
 *   };
 *
 *   async toIR(request: MyRequest): Promise<IRChatRequest> {
 *     // Convert to IR
 *   }
 *
 *   async fromIR(response: IRChatResponse): Promise<MyResponse> {
 *     // Convert from IR
 *   }
 *
 *   async *fromIRStream(stream: IRChatStream): AsyncGenerator<MyChunk> {
 *     // Convert stream
 *   }
 * }
 * ```
 *
 * @module
 */

// ============================================================================
// Base Types for Custom Frontend Development
// ============================================================================

// Core adapter interfaces
export type {
  FrontendAdapter,
  AdapterMetadata,
  AdapterRegistry,
  InferFrontendRequest,
  InferFrontendResponse,
  InferFrontendStreamChunk,
} from '../../types/adapters.js';

// IR types needed for frontend implementation
export type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRStreamChunk,
  IRMessage,
  MessageContent,
  MessageRole,
  TextContent,
  ImageContent,
  ToolUseContent,
  ToolResultContent,
  IRParameters,
  IRCapabilities,
  IRMetadata,
  IRProvenance,
  IRUsage,
  FinishReason,
  SystemMessageStrategy,
  StreamChunkType,
  StreamStartChunk,
  StreamContentChunk,
  StreamDoneChunk,
  StreamErrorChunk,
} from '../../types/ir.js';

// Model types
export type {
  AIModel,
  ModelCapabilities,
  ListModelsOptions,
  ListModelsResult,
} from '../../types/models.js';

// Error classes for frontend implementations
export {
  AdapterError,
  AdapterConversionError,
  AuthenticationError,
  ValidationError,
  ProviderError,
  StreamError,
  ErrorCode,
} from '../../errors/index.js';

// Utility functions useful for frontend development
export {
  normalizeSystemMessages,
  extractSystemMessages,
  combineSystemMessages,
  validateIRChatRequest,
  validateMessage,
  validateMessages,
  createStreamAccumulator,
  accumulateChunk,
  accumulatorToMessage,
  accumulatorToResponse,
  collectStream,
  streamToResponse,
  streamToText,
  isContentChunk,
  isDoneChunk,
  getContentDeltas,
} from '../../utils/index.js';

// ============================================================================
// Frontend Adapter Implementations
// ============================================================================

export * from './anthropic.js';
export * from './openai.js';
export * from './gemini.js';
export * from './ollama.js';
export * from './mistral.js';
export * from './chrome-ai.js';
