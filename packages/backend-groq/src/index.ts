/**
 * Groq Backend Adapter
 *
 * Adapts Universal IR to Groq API (OpenAI-compatible).
 * Groq provides ultra-fast inference with LPU (Language Processing Unit) technology.
 *
 * @module
 */

import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
import type { BackendAdapterConfig, IRChatRequest } from 'ai.matey.types';

/**
 * Backend adapter for Groq API.
 *
 * Groq uses an OpenAI-compatible API with ultra-fast inference speeds.
 * Known for extremely low latency responses.
 *
 * @example Basic Usage
 * ```typescript
 * import { GroqBackendAdapter } from 'ai.matey';
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
export class GroqBackendAdapter extends OpenAIBackendAdapter {
  constructor(config: BackendAdapterConfig) {
    // Groq API endpoint
    const groqConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'https://api.groq.com/openai/v1',
    };

    // Pass Groq-specific metadata to parent constructor
    super(groqConfig, {
      name: 'groq-backend',
      version: '1.0.0',
      provider: 'Groq',
      capabilities: {
        streaming: true,
        multiModal: false, // Groq currently focuses on text
        tools: true,
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
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    // Groq pricing: ~$0.05 per 1M input tokens, ~$0.10 per 1M output tokens
    // (Extremely competitive pricing)
    const estimatedInputTokens = (await super.estimateCost(request)) || 0;
    const estimatedOutputTokens = Math.min(request.parameters?.maxTokens || 1000, 4000);

    const inputCost = (estimatedInputTokens * 1000 * 0.05) / 1_000_000;
    const outputCost = (estimatedOutputTokens / 1_000_000) * 0.1;

    return inputCost + outputCost;
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
 * import { createGroqAdapter } from 'ai.matey';
 *
 * const adapter = createGroqAdapter({
 *   apiKey: process.env.GROQ_API_KEY,
 * });
 * ```
 */
export function createGroqAdapter(config: BackendAdapterConfig): GroqBackendAdapter {
  return new GroqBackendAdapter(config);
}
