/**
 * Chrome AI Frontend Adapter
 *
 * Pass-through adapter for Chrome AI format.
 *
 * @module
 */

import type { FrontendAdapter, AdapterMetadata } from 'ai.matey.types';
import type { IRChatRequest, IRChatResponse, IRStreamChunk } from 'ai.matey.types';
import type { StreamConversionOptions } from 'ai.matey.types';
import { convertStreamMode } from 'ai.matey.utils';

/**
 * Chrome AI request structure for browser-based AI.
 *
 * Chrome's built-in AI uses a simple prompt-based format without message arrays.
 * Only available in Chrome 129+ with AI features enabled.
 *
 * @see ChromeAIResponse
 * @see https://developer.chrome.com/docs/ai/built-in
 *
 * @example
 * ```typescript
 * const request: ChromeAIRequest = {
 *   prompt: 'Explain quantum computing',
 *   temperature: 0.7,
 *   topK: 40
 * };
 * ```
 */
export interface ChromeAIRequest {
  /** Text prompt (no message array format) */
  prompt: string;

  /** Sampling temperature parameter */
  temperature?: number;

  /** Top-K sampling parameter */
  topK?: number;
}

/**
 * Chrome AI response structure.
 *
 * Simple text-only response from Chrome's built-in AI. No usage statistics
 * or additional metadata since it runs locally in the browser.
 *
 * @see ChromeAIRequest
 *
 * @example
 * ```typescript
 * const response: ChromeAIResponse = {
 *   text: 'Quantum computing uses quantum mechanics...'
 * };
 * ```
 */
export interface ChromeAIResponse {
  /** Generated text response */
  text: string;
}

export class ChromeAIFrontendAdapter implements FrontendAdapter<ChromeAIRequest, ChromeAIResponse> {
  readonly metadata: AdapterMetadata = {
    name: 'chrome-ai-frontend',
    version: '1.0.0',
    provider: 'Chrome AI',
    capabilities: {
      streaming: true,
      multiModal: false,
      tools: false,
      systemMessageStrategy: 'prepend-user',
      supportsMultipleSystemMessages: false,
    },
  };

  /**
   * Convert Chrome AI request to Universal IR format.
   *
   * This method transforms a Chrome AI-formatted request into the standardized
   * Intermediate Representation (IR) format. Chrome AI uses a simple prompt-based
   * format, so this converts the single prompt string into a user message within
   * the IR message array structure.
   *
   * @param request - Chrome AI request with prompt and optional parameters
   * @returns Promise resolving to IR chat request
   *
   * @example
   * ```typescript
   * const adapter = new ChromeAIFrontendAdapter();
   * const irRequest = await adapter.toIR({
   *   prompt: 'What is the capital of France?',
   *   temperature: 0.7,
   *   topK: 40
   * });
   * ```
   */
  toIR(request: ChromeAIRequest): Promise<IRChatRequest> {
    return Promise.resolve({
      messages: [{ role: 'user', content: request.prompt }],
      parameters: {
        temperature: request.temperature,
        topK: request.topK,
      },
      metadata: {
        requestId: `chrome-ai-${Date.now()}`,
        timestamp: Date.now(),
        provenance: { frontend: this.metadata.name },
      },
    });
  }

  /**
   * Convert Universal IR response back to Chrome AI format.
   *
   * This method transforms the standardized IR response into the format
   * expected by Chrome AI's interface. It extracts the text content from
   * the IR message and returns it in Chrome AI's simple `{ text }` format.
   *
   * @param response - Universal IR chat response
   * @returns Promise resolving to Chrome AI response
   *
   * @example
   * ```typescript
   * const adapter = new ChromeAIFrontendAdapter();
   * const chromeResponse = await adapter.fromIR(irResponse);
   * console.log(chromeResponse.text);
   * ```
   */
  fromIR(response: IRChatResponse): Promise<ChromeAIResponse> {
    return Promise.resolve({
      text: typeof response.message.content === 'string' ? response.message.content : '',
    });
  }

  /**
   * Convert Universal IR stream to Chrome AI streaming format.
   *
   * This async generator method transforms a stream of IR chunks into
   * Chrome AI's simple text streaming format. It yields raw text strings
   * (no JSON wrapping, no SSE format) and supports stream mode conversion
   * through options (delta, full, or text-only modes).
   *
   * @param stream - Universal IR chat stream
   * @param options - Optional stream conversion options (stream mode, etc.)
   * @yields Raw text strings
   *
   * @example
   * ```typescript
   * const adapter = new ChromeAIFrontendAdapter();
   * for await (const textChunk of adapter.fromIRStream(irStream)) {
   *   console.log(textChunk); // Raw text like "Hello" or " world"
   * }
   * ```
   */
  async *fromIRStream(
    stream: AsyncGenerator<IRStreamChunk>,
    options?: StreamConversionOptions
  ): AsyncGenerator<string> {
    // Apply stream mode conversion if options provided
    const processedStream = options ? convertStreamMode(stream, options) : stream;

    for await (const chunk of processedStream) {
      if (chunk.type === 'content') {
        yield chunk.delta;
      }
    }
  }
}
