/**
 * Model Runner Backends (Node.js Only)
 *
 * Export model runner backends and base class for creating custom backends that
 * run models locally via subprocess execution.
 *
 * ⚠️ Node.js Only: This module uses Node.js-specific APIs (child_process, events)
 * and is NOT browser-compatible. These backends are in the backend-native module
 * alongside other native backends that require platform-specific dependencies.
 *
 * @example Creating a custom model runner backend
 * ```typescript
 * import {
 *   GenericModelRunnerBackend,
 *   type ModelRunnerBackendConfig,
 *   type AdapterMetadata,
 *   type IRChatRequest,
 *   type IRChatResponse,
 * } from 'ai.matey/adapters/backend-native/model-runners';
 *
 * export class MyModelRunnerBackend extends GenericModelRunnerBackend {
 *   readonly metadata: AdapterMetadata = {
 *     name: 'my-model-runner',
 *     version: '1.0.0',
 *     provider: 'MyProvider',
 *     capabilities: { streaming: true, tools: false }
 *   };
 *
 *   protected buildCommandArgs(): string[] {
 *     return ['--model', '{modelPath}', '--port', '{port}'];
 *   }
 *
 *   protected formatPrompt(request: IRChatRequest): string {
 *     // Convert IR messages to prompt string
 *   }
 *
 *   protected parseResponse(output: string, request: IRChatRequest): IRChatResponse {
 *     // Parse model output to IR response
 *   }
 *
 *   protected parseStreamChunk(chunk: string, request: IRChatRequest): IRStreamChunk | null {
 *     // Parse streaming output
 *   }
 *
 *   protected getPromptTemplate(): PromptTemplate {
 *     return { name: 'custom' };
 *   }
 * }
 * ```
 *
 * @example Using LlamaCpp backend
 * ```typescript
 * import { LlamaCppBackend } from 'ai.matey/adapters/backend-native/model-runners';
 *
 * const backend = new LlamaCppBackend({
 *   model: './models/llama-3.1-8b.gguf',
 *   process: { command: '/usr/local/bin/llama-server' },
 *   communication: { type: 'http', baseURL: 'http://localhost:{port}' },
 *   runtime: { contextSize: 4096, gpuLayers: 35 },
 *   promptTemplate: 'llama3',
 * });
 *
 * await backend.start();
 * const response = await backend.execute(request);
 * await backend.stop();
 * ```
 *
 * @module
 */

// ============================================================================
// Base Types for Model Runner Development
// ============================================================================

// Core adapter interfaces (re-export from main backend module)
export type {
  BackendAdapter,
  BackendAdapterConfig,
  AdapterMetadata,
  AdapterRegistry,
} from '../../../types/adapters.js';

// IR types needed for backend implementation (re-export from main backend module)
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
} from '../../../types/ir.js';

// Model runner specific types
export type {
  ModelRunnerBackendConfig,
  ModelRunnerStats,
  ModelRunnerEvents,
  ModelReference,
  PromptTemplate,
  ProcessConfig,
  RuntimeConfig,
  LifecycleConfig,
  CommunicationType,
  CommunicationConfig,
  StdioCommunicationConfig,
  HttpCommunicationConfig,
} from '../../../types/model-runner.js';

// Error classes for backend implementations (re-export from main backend module)
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
} from '../../../errors/index.js';

// Utility functions useful for backend development (re-export from main backend module)
export {
  normalizeSystemMessages,
  extractSystemMessages,
  combineSystemMessages,
  validateIRChatRequest,
  validateParameters,
  createStreamAccumulator,
  streamToResponse,
  streamToText,
} from '../../../utils/index.js';

// ============================================================================
// Model Runner Base Class
// ============================================================================

/**
 * Base class for creating model runner backends.
 *
 * Provides process lifecycle management, stdio/HTTP communication,
 * health checking, and event emission.
 *
 * ⚠️ Node.js only - uses child_process and events modules.
 */
export { GenericModelRunnerBackend } from '../model-runner-base.js';

// ============================================================================
// Model Runner Backend Implementations
// ============================================================================

/**
 * Native backend implementations (NodeLlamaCppBackend, AppleBackend) are
 * exported from 'ai.matey/adapters/backend-native' rather than this module.
 *
 * This module exports only the GenericModelRunnerBackend base class for users
 * who want to create custom subprocess-based backends.
 *
 * @example Using native backends
 * ```typescript
 * import { NodeLlamaCppBackend, AppleBackend } from 'ai.matey/adapters/backend-native';
 * ```
 *
 * @example Creating custom subprocess backend
 * ```typescript
 * import { GenericModelRunnerBackend } from 'ai.matey/adapters/backend-native/model-runners';
 *
 * class MyCustomBackend extends GenericModelRunnerBackend {
 *   // Implement abstract methods
 * }
 * ```
 */
