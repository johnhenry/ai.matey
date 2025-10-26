/**
 * Backend Adapters (Browser-Compatible)
 *
 * Export all HTTP-based backend adapters and related types for creating custom backends.
 * These backends communicate with AI services via HTTP APIs and are browser-compatible.
 *
 * ⚠️ NOTE: Native backend adapters (that require native bindings) are in a separate
 * module to allow graceful degradation on unsupported platforms. Import from
 * 'ai.matey/adapters/backend-native' for Node.js-only backends with native dependencies:
 * - NodeLlamaCppBackend (requires node-llama-cpp)
 * - AppleBackend (requires apple-foundation-models, macOS 15+ Sequoia only)
 *
 * @example Creating a custom HTTP backend
 * ```typescript
 * import type {
 *   BackendAdapter,
 *   BackendAdapterConfig,
 *   AdapterMetadata
 * } from 'ai.matey/adapters/backend';
 * import type { IRChatRequest, IRChatResponse } from 'ai.matey/adapters/backend';
 *
 * export class MyCustomBackend implements BackendAdapter {
 *   readonly metadata: AdapterMetadata = {
 *     name: 'my-custom-backend',
 *     version: '1.0.0',
 *     provider: 'MyProvider',
 *     capabilities: { // ... }
 *   };
 *
 *   constructor(private config: BackendAdapterConfig) {}
 *
 *   async execute(request: IRChatRequest): Promise<IRChatResponse> {
 *     // Implementation using fetch() or other HTTP methods
 *   }
 * }
 * ```
 *
 * @module
 */

// ============================================================================
// Base Types for Custom Backend Development
// ============================================================================

// Core adapter interfaces
export type {
  BackendAdapter,
  BackendAdapterConfig,
  AdapterMetadata,
  AdapterRegistry,
} from '../../types/adapters.js';

// IR types needed for backend implementation
export type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRStreamChunk,
  IRMessage,
  MessageContent,
  MessageRole,
  IRParameters,
  IRCapabilities,
  IRMetadata,
  IRProvenance,
  IRUsage,
  FinishReason,
  SystemMessageStrategy,
} from '../../types/ir.js';

// Model types for model listing
export type {
  AIModel,
  ModelCapabilities,
  ListModelsOptions,
  ListModelsResult,
} from '../../types/models.js';

// Error classes for backend implementations
export {
  AdapterError,
  AdapterConversionError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  ProviderError,
  NetworkError,
  StreamError,
  ErrorCode,
  createErrorFromHttpResponse,
  createErrorFromProviderError,
} from '../../errors/index.js';

// Utility functions useful for backend development
export {
  normalizeSystemMessages,
  extractSystemMessages,
  combineSystemMessages,
  validateIRChatRequest,
  validateParameters,
  createStreamAccumulator,
  streamToResponse,
  streamToText,
} from '../../utils/index.js';

// Model cache utilities
export { ModelCache, globalModelCache, getModelCache } from '../../utils/model-cache.js';

// ============================================================================
// Backend Adapter Implementations
// ============================================================================

export * from './openai.js';
export * from './anthropic.js';
export * from './gemini.js';
export * from './ollama.js';
export * from './mistral.js';
export * from './chrome-ai.js';
export * from './mock.js';
export * from './deepseek.js';
export * from './groq.js';
export * from './lmstudio.js';
export * from './huggingface.js';
export * from './nvidia.js';
