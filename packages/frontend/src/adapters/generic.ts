/**
 * Generic Frontend Adapter
 *
 * A passthrough frontend adapter that accepts and returns IR format directly.
 * Use this when you want to work with the universal IR format without
 * any provider-specific conversions.
 *
 * @example
 * ```typescript
 * import { GenericFrontendAdapter } from 'ai.matey.frontend.generic';
 * import { Bridge } from 'ai.matey.core';
 *
 * const frontend = new GenericFrontendAdapter();
 * const bridge = new Bridge(frontend, backend);
 *
 * // Request and response are both in IR format
 * const response = await bridge.chat({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: { model: 'gpt-4' },
 *   metadata: { requestId: 'req_123', timestamp: Date.now(), provenance: {} },
 * });
 * ```
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from 'ai.matey.types';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRStreamChunk,
  StreamConversionOptions,
} from 'ai.matey.types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration options for the Generic Frontend Adapter.
 */
export interface GenericFrontendConfig {
  /**
   * Custom adapter name for provenance tracking.
   * @default 'generic-frontend'
   */
  readonly name?: string;

  /**
   * Whether to validate requests before passing through.
   * @default false
   */
  readonly validateRequests?: boolean;

  /**
   * Whether to add/update provenance information.
   * @default true
   */
  readonly trackProvenance?: boolean;

  /**
   * Maximum context tokens (for capability reporting).
   * @default undefined (unlimited)
   */
  readonly maxContextTokens?: number;

  /**
   * Supported models (for capability reporting).
   */
  readonly supportedModels?: readonly string[];
}

// ============================================================================
// Generic Frontend Adapter
// ============================================================================

/**
 * Passthrough frontend adapter for IR format.
 *
 * This adapter accepts IR requests directly and returns IR responses without
 * any conversion. It's useful for:
 *
 * - **Direct IR access**: Work with the universal format without provider wrappers
 * - **Testing**: Test bridges and backends without conversion overhead
 * - **Custom integrations**: Build tools that operate at the IR level
 * - **Format normalization**: Use when your application already produces IR
 *
 * @example
 * ```typescript
 * // Basic usage
 * const frontend = new GenericFrontendAdapter();
 *
 * // With custom configuration
 * const frontend = new GenericFrontendAdapter({
 *   name: 'my-app-frontend',
 *   trackProvenance: true,
 *   maxContextTokens: 128000,
 * });
 * ```
 */
export class GenericFrontendAdapter implements FrontendAdapter<
  IRChatRequest,
  IRChatResponse,
  IRStreamChunk
> {
  readonly metadata: AdapterMetadata;
  private readonly config: GenericFrontendConfig;

  constructor(config: GenericFrontendConfig = {}) {
    this.config = config;

    this.metadata = {
      name: config.name ?? 'generic-frontend',
      version: '1.0.0',
      provider: 'Generic',
      capabilities: {
        streaming: true,
        multiModal: true,
        tools: true,
        maxContextTokens: config.maxContextTokens,
        supportedModels: config.supportedModels,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: true,
        supportsSeed: true,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
      },
    };
  }

  /**
   * Pass through IR request (no conversion needed).
   *
   * Optionally adds provenance tracking if enabled.
   */
  toIR(request: IRChatRequest): Promise<IRChatRequest> {
    // Optionally add provenance
    if (this.config.trackProvenance !== false) {
      return Promise.resolve({
        ...request,
        metadata: {
          ...request.metadata,
          provenance: {
            ...(request.metadata.provenance as Record<string, unknown>),
            frontend: this.metadata.name,
          },
        },
      });
    }

    return Promise.resolve(request);
  }

  /**
   * Pass through IR response (no conversion needed).
   */
  fromIR(response: IRChatResponse): Promise<IRChatResponse> {
    return Promise.resolve(response);
  }

  /**
   * Pass through IR stream chunks (no conversion needed).
   */
  async *fromIRStream(
    stream: IRChatStream,
    _options?: StreamConversionOptions
  ): AsyncGenerator<IRStreamChunk, void, undefined> {
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  /**
   * Validate IR request structure.
   *
   * Only performs validation if `validateRequests` is enabled in config.
   */
  validate(request: IRChatRequest): Promise<void> {
    if (!this.config.validateRequests) {
      return Promise.resolve();
    }

    // Basic validation
    if (!request.messages || request.messages.length === 0) {
      return Promise.reject(new Error('Request must contain at least one message'));
    }

    if (!request.metadata?.requestId) {
      return Promise.reject(new Error('Request must have a requestId in metadata'));
    }

    if (typeof request.metadata.timestamp !== 'number') {
      return Promise.reject(new Error('Request must have a numeric timestamp in metadata'));
    }

    return Promise.resolve();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Generic Frontend Adapter instance.
 *
 * @example
 * ```typescript
 * const frontend = createGenericFrontend();
 *
 * // Or with configuration
 * const frontend = createGenericFrontend({
 *   name: 'my-frontend',
 *   trackProvenance: true,
 * });
 * ```
 */
export function createGenericFrontend(config?: GenericFrontendConfig): GenericFrontendAdapter {
  return new GenericFrontendAdapter(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default GenericFrontendAdapter;
