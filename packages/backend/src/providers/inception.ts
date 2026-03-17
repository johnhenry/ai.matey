/**
 * Inception Labs (Mercury) Backend Adapter
 *
 * Adapts Universal IR to Inception Labs API (OpenAI-compatible).
 * Inception Labs offers Mercury, a text diffusion language model with fast generation speeds.
 *
 * @module
 */

import { OpenAIBackendAdapter, type OpenAIRequest, type OpenAIResponse } from './openai.js';
import type { BackendAdapter, BackendAdapterConfig, IRChatRequest } from 'ai.matey.types';

/**
 * Backend adapter for Inception Labs (Mercury) API.
 *
 * Inception Labs provides Mercury, a text diffusion LLM designed for high-speed
 * code generation and text tasks. The API is OpenAI-compatible.
 *
 * @example Basic Usage
 * ```typescript
 * import { InceptionBackendAdapter } from 'ai.matey';
 *
 * const adapter = new InceptionBackendAdapter({
 *   apiKey: process.env.INCEPTION_API_KEY,
 * });
 * ```
 *
 * @example With Coding Model
 * ```typescript
 * const adapter = new InceptionBackendAdapter({
 *   apiKey: process.env.INCEPTION_API_KEY,
 * });
 *
 * const response = await adapter.execute({
 *   messages: [{ role: 'user', content: 'Write a function to reverse a string in Python.' }],
 *   parameters: {
 *     model: 'mercury-coder-small', // Fast coding model
 *   },
 * });
 * ```
 *
 * @example Streaming
 * ```typescript
 * const stream = adapter.executeStream({
 *   messages: [{ role: 'user', content: 'Explain recursion.' }],
 *   parameters: {
 *     model: 'mercury-coder',
 *   },
 * });
 *
 * for await (const chunk of stream) {
 *   if (chunk.type === 'content') {
 *     process.stdout.write(chunk.delta);
 *   }
 * }
 * ```
 */
export class InceptionBackendAdapter
  extends OpenAIBackendAdapter
  implements BackendAdapter<OpenAIRequest, OpenAIResponse>
{
  constructor(config: BackendAdapterConfig) {
    const inceptionConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'https://api.inceptionlabs.ai/v1',
      defaultModel: config.defaultModel || 'mercury-coder-small',
    };

    super(inceptionConfig, {
      name: 'inception-backend',
      version: '1.0.0',
      provider: 'Inception Labs',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: false,
        maxContextTokens: 32768,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: false,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 4,
      },
      config: {
        baseURL: inceptionConfig.baseURL,
      },
    });
  }

  /**
   * Health check for Inception Labs API.
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
   * Estimate cost for Inception Labs.
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    const pricing: Record<string, { input: number; output: number }> = {
      'mercury-coder-small': { input: 0.25, output: 1.0 },
      'mercury-coder': { input: 1.0, output: 5.0 },
    };

    const model = request.parameters?.model || this.config.defaultModel || '';
    const modelPricing = pricing[model];

    if (!modelPricing) {
      return null;
    }

    const inputTokens = request.messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return sum + Math.ceil(content.length / 4);
    }, 0);

    const outputTokens = request.parameters?.maxTokens || 1024;

    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }
}

/**
 * Create an Inception Labs backend adapter.
 *
 * @param config - Adapter configuration
 * @returns Inception Labs backend adapter
 *
 * @example
 * ```typescript
 * import { createInceptionAdapter } from 'ai.matey';
 *
 * const adapter = createInceptionAdapter({
 *   apiKey: process.env.INCEPTION_API_KEY,
 * });
 * ```
 */
export function createInceptionAdapter(config: BackendAdapterConfig): InceptionBackendAdapter {
  return new InceptionBackendAdapter(config);
}
