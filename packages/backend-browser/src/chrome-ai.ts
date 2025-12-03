/**
 * Chrome AI Backend Adapter
 *
 * Adapts Universal IR to Chrome's built-in AI (window.ai).
 * Chrome AI is browser-only and always streams responses.
 *
 * @module
 */

import type { BackendAdapter, BackendAdapterConfig, AdapterMetadata } from 'ai.matey.types';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRMessage,
  IRStreamChunk,
} from 'ai.matey.types';
import { ProviderError, ErrorCode } from 'ai.matey.errors';
import { getEffectiveStreamMode, mergeStreamingConfig } from 'ai.matey.utils';

// ============================================================================
// Chrome AI Types
// ============================================================================

export interface ChromeAISession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): ReadableStream;
  destroy(): void;
}

export interface ChromeAI {
  createTextSession(options?: { temperature?: number; topK?: number }): Promise<ChromeAISession>;
  capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
}

declare global {
  interface Window {
    ai?: { languageModel: ChromeAI };
  }
}

// ============================================================================
// Browser Environment Helper
// ============================================================================

/**
 * Get the global window object if running in a browser environment.
 *
 * This helper function safely checks for the existence of the window object
 * to determine if code is running in a browser context. Returns undefined
 * in Node.js or other non-browser environments.
 *
 * @returns Window object if in browser, undefined otherwise
 */
function getWindow(): (Window & typeof globalThis) | undefined {
  return typeof globalThis !== 'undefined' && 'window' in globalThis
    ? (globalThis as typeof globalThis & { window: Window & typeof globalThis }).window
    : undefined;
}

// ============================================================================
// Chrome AI Backend Adapter
// ============================================================================

export class ChromeAIBackendAdapter implements BackendAdapter {
  readonly metadata: AdapterMetadata;
  private readonly config: BackendAdapterConfig;

  constructor(config?: Partial<BackendAdapterConfig>) {
    this.config = config as BackendAdapterConfig;
    this.metadata = {
      name: 'chrome-ai-backend',
      version: '1.0.0',
      provider: 'Chrome AI',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        maxContextTokens: 4096,
        systemMessageStrategy: 'prepend-user',
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: false,
        supportsTopK: true,
        supportsSeed: false,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 0,
      },
      config: {},
    };
  }

  /**
   * Convert IR request to provider format (passthrough - uses IR internally).
   */
  fromIR(request: IRChatRequest): IRChatRequest {
    return request;
  }

  /**
   * Convert provider response to IR format (passthrough - uses IR internally).
   */
  toIR(
    response: IRChatResponse,
    _originalRequest: IRChatRequest,
    _latencyMs: number
  ): IRChatResponse {
    return response;
  }

  /**
   * Execute a chat request using Chrome's built-in AI.
   *
   * This method processes an IR chat request through Chrome AI's streaming API,
   * collecting all chunks into a complete response. Chrome AI always streams
   * internally, so this method consumes the stream and returns the final result.
   * Requires Chrome 129+ with AI features enabled.
   *
   * @param request - Universal IR chat request
   * @param signal - Optional AbortSignal for cancellation
   * @returns Promise resolving to IR chat response
   * @throws {ProviderError} If Chrome AI is unavailable or request fails
   *
   * @example
   * ```typescript
   * const adapter = new ChromeAIBackendAdapter();
   * const response = await adapter.execute({
   *   messages: [{ role: 'user', content: 'Hello!' }],
   *   parameters: { temperature: 0.7, topK: 40 },
   *   metadata: { requestId: 'req_123', timestamp: Date.now(), provenance: {} }
   * });
   * console.log(response.message.content);
   * ```
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      // Chrome AI always streams, so we collect the stream
      const chunks: string[] = [];
      for await (const chunk of this.executeStream(request, signal)) {
        if (chunk.type === 'content') {
          chunks.push(chunk.delta);
        } else if (chunk.type === 'done') {
          return {
            message: chunk.message || { role: 'assistant', content: chunks.join('') },
            finishReason: chunk.finishReason,
            usage: chunk.usage,
            metadata: {
              ...request.metadata,
              providerResponseId: undefined, // Chrome AI does not provide a response ID
              provenance: { ...request.metadata.provenance, backend: this.metadata.name },
            },
          };
        } else if (chunk.type === 'error') {
          throw new ProviderError({
            code: ErrorCode.PROVIDER_ERROR,
            message: chunk.error.message,
            provenance: { backend: this.metadata.name },
          });
        }
      }

      // Fallback
      const message: IRMessage = { role: 'assistant', content: chunks.join('') };
      return {
        message,
        finishReason: 'stop',
        metadata: {
          ...request.metadata,
          providerResponseId: undefined, // Chrome AI does not provide a response ID
          provenance: { ...request.metadata.provenance, backend: this.metadata.name },
        },
      };
    } catch (error) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Chrome AI request failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Execute a streaming chat request using Chrome's built-in AI.
   *
   * This async generator method processes an IR chat request through Chrome AI's
   * streaming interface, yielding IR stream chunks as they arrive. It checks for
   * Chrome AI availability, creates a session with the specified parameters,
   * combines all messages into a single prompt, and streams the response.
   * Supports abort signals for cancellation.
   *
   * @param request - Universal IR chat request
   * @param signal - Optional AbortSignal for cancellation
   * @yields IR stream chunks including start, content, done, and error events
   * @throws Yields error chunk if Chrome AI unavailable or stream fails
   *
   * @example
   * ```typescript
   * const adapter = new ChromeAIBackendAdapter();
   * for await (const chunk of adapter.executeStream(request)) {
   *   if (chunk.type === 'content') {
   *     console.log('Delta:', chunk.delta);
   *   } else if (chunk.type === 'done') {
   *     console.log('Complete:', chunk.message.content);
   *   }
   * }
   * ```
   */
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      // Check if Chrome AI is available
      const win = getWindow();
      if (!win?.ai?.languageModel) {
        throw new ProviderError({
          code: ErrorCode.PROVIDER_UNAVAILABLE,
          message: 'Chrome AI is not available (requires Chrome 129+ with AI features enabled)',
          provenance: { backend: this.metadata.name },
        });
      }

      const capabilities = await win.ai.languageModel.capabilities();
      if (capabilities.available === 'no') {
        throw new ProviderError({
          code: ErrorCode.PROVIDER_UNAVAILABLE,
          message: 'Chrome AI is not available on this device',
          provenance: { backend: this.metadata.name },
        });
      }

      // Create session
      const session = await win.ai.languageModel.createTextSession({
        temperature: request.parameters?.temperature,
        topK: request.parameters?.topK,
      });

      // Combine messages into single prompt
      const prompt = request.messages
        .map((msg) => {
          const content =
            typeof msg.content === 'string'
              ? msg.content
              : msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
          return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${content}`;
        })
        .join('\n\n');

      // Get effective streaming configuration
      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(request.streamMode, undefined, streamingConfig);
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      let sequence = 0;
      yield {
        type: 'start',
        sequence: sequence++,
        metadata: {
          ...request.metadata,
          provenance: { ...request.metadata.provenance, backend: this.metadata.name },
        },
      } as IRStreamChunk;

      const stream = session.promptStreaming(prompt);
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let contentBuffer = '';

      try {
        while (true) {
          if (signal?.aborted) {
            session.destroy();
            throw new Error('Request aborted');
          }

          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          const delta = decoder.decode(value, { stream: true });
          contentBuffer += delta;

          // Build content chunk with optional accumulated field
          const contentChunk: IRStreamChunk = {
            type: 'content',
            sequence: sequence++,
            delta,
            role: 'assistant',
          };

          // Add accumulated field if configured
          if (includeBoth) {
            (contentChunk as any).accumulated = contentBuffer;
          }

          yield contentChunk;
        }

        const message: IRMessage = { role: 'assistant', content: contentBuffer };
        yield {
          type: 'done',
          sequence: sequence++,
          finishReason: 'stop',
          message,
        } as IRStreamChunk;
      } finally {
        reader.releaseLock();
        session.destroy();
      }
    } catch (error) {
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      } as IRStreamChunk;
    }
  }

  /**
   * Check if Chrome AI is available and healthy.
   *
   * This method verifies that Chrome AI is present in the browser environment
   * and reports being available. Returns false if Chrome AI is not supported,
   * not enabled, or if the device doesn't support on-device AI.
   *
   * @returns Promise resolving to true if Chrome AI is available, false otherwise
   *
   * @example
   * ```typescript
   * const adapter = new ChromeAIBackendAdapter();
   * if (await adapter.healthCheck()) {
   *   console.log('Chrome AI is ready!');
   * } else {
   *   console.log('Chrome AI not available - use a different backend');
   * }
   * ```
   */
  async healthCheck(): Promise<boolean> {
    try {
      const win = getWindow();
      if (!win?.ai?.languageModel) {
        return false;
      }
      const capabilities = await win.ai.languageModel.capabilities();
      return capabilities.available !== 'no';
    } catch {
      return false;
    }
  }

  /**
   * Estimate the cost of a Chrome AI request.
   *
   * Chrome AI is completely free as it runs locally on-device, so this always
   * returns 0. No API keys or payment required.
   *
   * @param _request - IR chat request (unused)
   * @returns Promise resolving to 0 (Chrome AI is free)
   *
   * @example
   * ```typescript
   * const adapter = new ChromeAIBackendAdapter();
   * const cost = await adapter.estimateCost(request);
   * console.log(cost); // Always 0
   * ```
   */
  estimateCost(_request: IRChatRequest): Promise<number | null> {
    return Promise.resolve(0); // Chrome AI is free
  }
}
