/**
 * Groq Backend Adapter
 *
 * Adapts Universal IR to Groq API (OpenAI-compatible).
 * Groq provides ultra-fast inference with LPU (Language Processing Unit) technology.
 *
 * @module
 */

import { OpenAIBackendAdapter, type OpenAIRequest, type OpenAIResponse } from './openai.js';
import type {
  BackendAdapter,
  ApiKeyBackendAdapterConfig,
  IRChatRequest,
} from '@johnhenry/aimatey-types';
import { estimateTokens } from '../shared.js';

/**
 * Backend adapter for Groq API.
 *
 * Groq uses an OpenAI-compatible API with ultra-fast inference speeds.
 * Known for extremely low latency responses.
 *
 * @example Basic Usage
 * ```typescript
 * import { GroqBackendAdapter } from '@johnhenry/aimatey';
 *
 * const adapter = new GroqBackendAdapter({
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 * ```
 *
 * @example With Fast Models
 * ```typescript
 * const adapter = new GroqBackendAdapter({
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 *
 * const response = await adapter.execute({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: {
 *     model: 'llama-3.3-70b-versatile', // Fast and capable
 *   },
 * });
 * ```
 *
 * @example Streaming for Ultra-Fast Responses
 * ```typescript
 * const stream = adapter.executeStream({
 *   messages: [{ role: 'user', content: 'Tell me a story' }],
 *   parameters: {
 *     model: 'llama-3.1-8b-instant', // Optimized for speed
 *   },
 * });
 *
 * for await (const chunk of stream) {
 *   if (chunk.type === 'content') {
 *     console.log(chunk.delta);
 *   }
 * }
 * ```
 */
export class GroqBackendAdapter
  extends OpenAIBackendAdapter
  implements BackendAdapter<OpenAIRequest, OpenAIResponse>
{
  constructor(config: ApiKeyBackendAdapterConfig) {
    // Groq API endpoint
    const groqConfig: ApiKeyBackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'https://api.groq.com/openai/v1',
      defaultModel: config.defaultModel || 'llama-3.1-8b-instant',
    };

    // Pass Groq-specific metadata to parent constructor
    super(groqConfig, {
      name: 'groq-backend',
      version: '1.0.0',
      provider: 'Groq',
      capabilities: {
        embeddings: false,
        streaming: true,
        multiModal: false, // Groq currently focuses on text
        tools: true,
        structuredOutput: 'native',
        maxContextTokens: 128000, // Varies by model, some support 128K
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: true,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
        maxStopSequences: 4,
      },
      config: {
        baseURL: groqConfig.baseURL,
      },
    });
  }

  /**
   * Health check for Groq API.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          ...this.config.headers,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost for Groq (very low cost, optimized for speed).
   */
  estimateCost(request: IRChatRequest): Promise<number | null> {
    // Groq pricing: ~$0.05 per 1M input tokens, ~$0.10 per 1M output tokens
    // (Extremely competitive pricing)
    //
    // Note: super.estimateCost() (OpenAIBackendAdapter) already returns a
    // dollar amount, not a token count -- re-multiplying it here would be
    // off by orders of magnitude. Use estimateTokens() directly instead.
    const estimatedInputTokens = estimateTokens(request);
    const estimatedOutputTokens = Math.min(request.parameters?.maxTokens || 1000, 4000);

    const inputCost = (estimatedInputTokens / 1_000_000) * 0.05;
    const outputCost = (estimatedOutputTokens / 1_000_000) * 0.1;

    return Promise.resolve(inputCost + outputCost);
  }
}

/**
 * Create a Groq backend adapter.
 *
 * @param config - Adapter configuration
 * @returns Groq backend adapter
 *
 * @example
 * ```typescript
 * import { createGroqAdapter } from '@johnhenry/aimatey';
 *
 * const adapter = createGroqAdapter({
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 * ```
 */
export function createGroqAdapter(config: ApiKeyBackendAdapterConfig): GroqBackendAdapter {
  return new GroqBackendAdapter(config);
}
