/**
 * SambaNova Cloud Backend Adapter
 *
 * Adapts Universal IR to SambaNova Cloud API (OpenAI-compatible).
 * SambaNova provides high-throughput AI inference on custom RDU hardware.
 *
 * @module
 */

import { OpenAIBackendAdapter, type OpenAIRequest, type OpenAIResponse } from './openai.js';
import type { BackendAdapter, BackendAdapterConfig, IRChatRequest } from 'ai.matey.types';

/**
 * Backend adapter for SambaNova Cloud API.
 *
 * SambaNova Cloud delivers fast, cost-efficient inference on proprietary
 * Reconfigurable Dataflow Unit (RDU) hardware. The API is OpenAI-compatible,
 * making it easy to switch from other providers.
 *
 * @example Basic Usage
 * ```typescript
 * import { SambaNovaBackendAdapter } from 'ai.matey';
 *
 * const adapter = new SambaNovaBackendAdapter({
 *   apiKey: process.env.SAMBANOVA_API_KEY,
 * });
 * ```
 *
 * @example With Meta Llama Model
 * ```typescript
 * const adapter = new SambaNovaBackendAdapter({
 *   apiKey: process.env.SAMBANOVA_API_KEY,
 * });
 *
 * const response = await adapter.execute({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: {
 *     model: 'Meta-Llama-3.1-70B-Instruct',
 *   },
 * });
 * ```
 *
 * @example Streaming
 * ```typescript
 * const stream = adapter.executeStream({
 *   messages: [{ role: 'user', content: 'Tell me a story.' }],
 *   parameters: {
 *     model: 'Meta-Llama-3.1-8B-Instruct',
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
export class SambaNovaBackendAdapter
  extends OpenAIBackendAdapter
  implements BackendAdapter<OpenAIRequest, OpenAIResponse>
{
  constructor(config: BackendAdapterConfig) {
    const sambaNovaConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'https://api.sambanova.ai/v1',
      defaultModel: config.defaultModel || 'Meta-Llama-3.1-8B-Instruct',
    };

    super(sambaNovaConfig, {
      name: 'sambanova-backend',
      version: '1.0.0',
      provider: 'SambaNova',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: true,
        maxContextTokens: 131072,
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
        baseURL: sambaNovaConfig.baseURL,
      },
    });
  }

  /**
   * Health check for SambaNova Cloud API.
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
   * Estimate cost for SambaNova Cloud.
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    // SambaNova pricing per 1M tokens (USD)
    const pricing: Record<string, { input: number; output: number }> = {
      'Meta-Llama-3.1-8B-Instruct': { input: 0.1, output: 0.2 },
      'Meta-Llama-3.1-70B-Instruct': { input: 0.6, output: 1.2 },
      'Meta-Llama-3.1-405B-Instruct': { input: 5.0, output: 10.0 },
      'Meta-Llama-3.2-1B-Instruct': { input: 0.04, output: 0.08 },
      'Meta-Llama-3.2-3B-Instruct': { input: 0.08, output: 0.16 },
      'Meta-Llama-3.3-70B-Instruct': { input: 0.6, output: 1.2 },
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
 * Create a SambaNova Cloud backend adapter.
 *
 * @param config - Adapter configuration
 * @returns SambaNova Cloud backend adapter
 *
 * @example
 * ```typescript
 * import { createSambaNovaAdapter } from 'ai.matey';
 *
 * const adapter = createSambaNovaAdapter({
 *   apiKey: process.env.SAMBANOVA_API_KEY,
 * });
 * ```
 */
export function createSambaNovaAdapter(config: BackendAdapterConfig): SambaNovaBackendAdapter {
  return new SambaNovaBackendAdapter(config);
}
