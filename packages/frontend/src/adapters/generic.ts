/**
 * Generic Frontend Adapter
 *
 * A passthrough frontend adapter that accepts and returns IR format directly.
 * Use this when you want to work with the universal IR format without
 * any provider-specific conversions.
 *
 * @example
 * ```typescript
 * import { GenericFrontendAdapter } from 'ai.matey.frontend/generic';
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
   * Pass through Universal IR request without conversion.
   *
   * This method accepts an IR request and returns it directly, as this is
   * a passthrough adapter. When provenance tracking is enabled (default),
   * it adds the frontend adapter name to the provenance metadata for
   * tracking purposes, but otherwise performs no transformations.
   *
   * @param request - Universal IR chat request
   * @returns Promise resolving to the same IR request (with optional provenance)
   *
   * @example
   * ```typescript
   * const adapter = new GenericFrontendAdapter();
   * const irRequest = await adapter.toIR({
   *   messages: [{ role: 'user', content: 'Hello!' }],
   *   parameters: { model: 'gpt-4', temperature: 0.7 },
   *   metadata: { requestId: 'req_123', timestamp: Date.now(), provenance: {} }
   * });
   * // Returns the same request with provenance.frontend = 'generic-frontend'
   * ```
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
   * Pass through Universal IR response without conversion.
   *
   * This method accepts an IR response and returns it directly without
   * any transformation. Since this is a passthrough adapter, the response
   * remains in IR format, allowing applications to work directly with
   * the universal format.
   *
   * @param response - Universal IR chat response
   * @returns Promise resolving to the same IR response
   *
   * @example
   * ```typescript
   * const adapter = new GenericFrontendAdapter();
   * const irResponse = await adapter.fromIR(irResponse);
   * // Returns the exact same response unchanged
   * console.log(irResponse.message.content);
   * ```
   */
  fromIR(response: IRChatResponse): Promise<IRChatResponse> {
    return Promise.resolve(response);
  }

  /**
   * Pass through Universal IR stream chunks without conversion.
   *
   * This async generator method accepts an IR stream and yields each chunk
   * directly without any transformation. Unlike other frontend adapters that
   * convert to provider-specific formats (SSE, JSON, etc.), this maintains
   * the raw IR chunk structure for direct consumption.
   *
   * @param stream - Universal IR chat stream
   * @param _options - Optional stream conversion options (currently unused)
   * @yields IR stream chunks unchanged
   *
   * @example
   * ```typescript
   * const adapter = new GenericFrontendAdapter();
   * for await (const chunk of adapter.fromIRStream(irStream)) {
   *   if (chunk.type === 'content') {
   *     console.log(chunk.delta); // Access IR structure directly
   *   }
   * }
   * ```
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
