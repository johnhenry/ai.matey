/**
 * Ollama Frontend Adapter
 *
 * Adapts Ollama API format to Universal IR.
 * Ollama uses a local server with OpenAI-compatible chat format.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRStreamChunk, IRMessage } from 'ai.matey.types';
import type { StreamConversionOptions } from 'ai.matey.types';

// ============================================================================
// Ollama API Types
// ============================================================================

/**
 * Ollama message structure.
 *
 * Simple message format for local Ollama models with standard roles.
 *
 * @see OllamaRequest
 */
export interface OllamaMessage {
  /** Message role */
  role: 'system' | 'user' | 'assistant';

  /** Message content */
  content: string;
}

/**
 * Ollama API request structure for local models.
 *
 * Ollama provides a local server for running LLMs. Parameters are nested
 * in an `options` object, and uses `num_predict` instead of `max_tokens`.
 *
 * @see OllamaMessage
 * @see OllamaResponse
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 *
 * @example
 * ```typescript
 * const request: OllamaRequest = {
 *   model: 'llama2',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   options: {
 *     temperature: 0.7,
 *     num_predict: 100
 *   }
 * };
 * ```
 */
export interface OllamaRequest {
  /** Local model name (e.g., 'llama2', 'mistral', 'codellama') */
  model: string;

  /** Conversation messages */
  messages: OllamaMessage[];

  /** Model parameters nested in options object */
  options?: {
    /** Sampling temperature */
    temperature?: number;

    /** Nucleus sampling */
    top_p?: number;

    /** Top-K sampling */
    top_k?: number;

    /** Maximum tokens to predict (Ollama uses 'predict' not 'tokens') */
    num_predict?: number;

    /** Stop sequences */
    stop?: string[];
  };

  /** Enable streaming responses */
  stream?: boolean;
}

/**
 * Ollama API response structure.
 *
 * Includes the generated message plus performance metrics like duration
 * and token counts specific to local model execution.
 *
 * @see OllamaRequest
 * @see OllamaMessage
 *
 * @example
 * ```typescript
 * const response: OllamaResponse = {
 *   model: 'llama2',
 *   created_at: '2024-01-15T12:00:00Z',
 *   message: {
 *     role: 'assistant',
 *     content: 'Hello! How can I help?'
 *   },
 *   done: true,
 *   total_duration: 1500000000,
 *   prompt_eval_count: 10,
 *   eval_count: 6
 * };
 * ```
 */
export interface OllamaResponse {
  /** Model that generated the response */
  model: string;

  /** ISO 8601 timestamp */
  created_at: string;

  /** Generated message */
  message: OllamaMessage;

  /** Whether generation is complete */
  done: boolean;

  /** Total inference duration in nanoseconds */
  total_duration?: number;

  /** Model loading duration in nanoseconds */
  load_duration?: number;

  /** Number of tokens in prompt evaluation */
  prompt_eval_count?: number;

  /** Number of tokens in generation */
  eval_count?: number;
}

export class OllamaFrontendAdapter implements FrontendAdapter<OllamaRequest, OllamaResponse> {
  readonly metadata: AdapterMetadata = {
    name: 'ollama-frontend',
    version: '1.0.0',
    provider: 'Ollama',
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: false,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: false,
    },
  };

  /**
   * Convert Ollama API request to Universal IR format.
   *
   * This method transforms an Ollama-formatted request into the standardized
   * Intermediate Representation (IR) format. It handles Ollama's unique
   * structure where parameters are nested in an `options` object, and maps
   * Ollama-specific field names (e.g., num_predict → maxTokens).
   *
   * @param request - Ollama API request
   * @returns Promise resolving to IR chat request
   *
   * @example
   * ```typescript
   * const adapter = new OllamaFrontendAdapter();
   * const irRequest = await adapter.toIR({
   *   model: 'llama2',
   *   messages: [{ role: 'user', content: 'Hello!' }],
   *   options: { temperature: 0.7, num_predict: 100 }
   * });
   * ```
   */
  toIR(request: OllamaRequest): Promise<IRChatRequest> {
    const messages: IRMessage[] = request.messages.map((msg: OllamaMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    return Promise.resolve({
      messages,
      parameters: {
        model: request.model,
        temperature: request.options?.temperature,
        topP: request.options?.top_p,
        topK: request.options?.top_k,
        maxTokens: request.options?.num_predict,
        stopSequences: request.options?.stop,
      },
      metadata: {
        requestId: `ollama-${Date.now()}`,
        timestamp: Date.now(),
        provenance: { frontend: this.metadata.name },
      },
      stream: request.stream,
    });
  }

  /**
   * Convert Universal IR response back to Ollama API format.
   *
   * This method transforms the standardized IR response into the format
   * expected by Ollama's API. It handles message conversion, formats the
   * timestamp as ISO string, and maps usage statistics to Ollama's format
   * (prompt_eval_count and eval_count instead of token counts).
   *
   * @param response - Universal IR chat response
   * @returns Promise resolving to Ollama API response
   *
   * @example
   * ```typescript
   * const adapter = new OllamaFrontendAdapter();
   * const ollamaResponse = await adapter.fromIR(irResponse);
   * console.log(ollamaResponse.message.content);
   * ```
   */
  fromIR(response: IRChatResponse): Promise<OllamaResponse> {
    return Promise.resolve({
      model: (response.metadata.custom?.model as string) || 'unknown',
      created_at: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: typeof response.message.content === 'string' ? response.message.content : '',
      },
      done: true,
      prompt_eval_count: response.usage?.promptTokens,
      eval_count: response.usage?.completionTokens,
    });
  }

  /**
   * Convert Universal IR stream to Ollama streaming format.
   *
   * This async generator method transforms a stream of IR chunks into
   * Ollama-formatted responses. It yields newline-delimited JSON objects
   * (not SSE format) with each chunk containing a message and done flag,
   * emitting `done: true` when the stream completes.
   *
   * @param stream - Universal IR chat stream
   * @param _options - Optional stream conversion options (currently unused)
   * @yields Newline-delimited JSON strings
   *
   * @example
   * ```typescript
   * const adapter = new OllamaFrontendAdapter();
   * for await (const jsonLine of adapter.fromIRStream(irStream)) {
   *   console.log(jsonLine); // '{"message":{"content":"text"},"done":false}\n'
   * }
   * ```
   */
  async *fromIRStream(
    stream: AsyncGenerator<IRStreamChunk>,
    _options?: StreamConversionOptions
  ): AsyncGenerator<string> {
    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        yield JSON.stringify({ message: { content: chunk.delta }, done: false }) + '\n';
      } else if (chunk.type === 'done') {
        yield JSON.stringify({ message: { content: '' }, done: true }) + '\n';
      }
    }
  }
}
