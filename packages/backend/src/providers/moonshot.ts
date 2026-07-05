/**
 * Moonshot AI (Kimi) Backend Adapter
 *
 * Adapts Universal IR to Moonshot AI API (OpenAI-compatible).
 * Moonshot AI provides Kimi models with support for long context windows up to 128K tokens.
 *
 * @module
 */

import { OpenAIBackendAdapter, type OpenAIRequest, type OpenAIResponse } from './openai.js';
import type { BackendAdapter, BackendAdapterConfig, IRChatRequest } from 'ai.matey.types';

/**
 * Backend adapter for Moonshot AI (Kimi) API.
 *
 * Moonshot AI offers Kimi models with exceptional long-context capabilities,
 * supporting up to 128K tokens. The API is OpenAI-compatible.
 *
 * @example Basic Usage
 * ```typescript
 * import { MoonshotBackendAdapter } from 'ai.matey';
 *
 * const adapter = new MoonshotBackendAdapter({
 *   apiKey: process.env.MOONSHOT_API_KEY,
 * });
 * ```
 *
 * @example With Long Context Model
 * ```typescript
 * const adapter = new MoonshotBackendAdapter({
 *   apiKey: process.env.MOONSHOT_API_KEY,
 * });
 *
 * const response = await adapter.execute({
 *   messages: [{ role: 'user', content: 'Summarize this long document...' }],
 *   parameters: {
 *     model: 'moonshot-v1-128k', // 128K context window
 *   },
 * });
 * ```
 *
 * @example Streaming
 * ```typescript
 * const stream = adapter.executeStream({
 *   messages: [{ role: 'user', content: 'Hello, Kimi!' }],
 *   parameters: {
 *     model: 'moonshot-v1-8k',
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
export class MoonshotBackendAdapter
  extends OpenAIBackendAdapter
  implements BackendAdapter<OpenAIRequest, OpenAIResponse>
{
  constructor(config: BackendAdapterConfig) {
    const moonshotConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'https://api.moonshot.cn/v1',
      defaultModel: config.defaultModel || 'moonshot-v1-8k',
    };

    super(moonshotConfig, {
      name: 'moonshot-backend',
      version: '1.0.0',
      provider: 'Moonshot AI',
      capabilities: {
        streaming: true,
        multiModal: false,
        tools: true,
        maxContextTokens: 128000,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: false,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
        maxStopSequences: 5,
      },
      config: {
        baseURL: moonshotConfig.baseURL,
      },
    });
  }

  /**
   * Health check for Moonshot AI API.
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
   * Estimate cost for Moonshot AI.
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    // Moonshot AI pricing per 1M tokens (USD)
    const pricing: Record<string, { input: number; output: number }> = {
      'moonshot-v1-8k': { input: 1.63, output: 1.63 },
      'moonshot-v1-32k': { input: 3.26, output: 3.26 },
      'moonshot-v1-128k': { input: 8.15, output: 8.15 },
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
 * Create a Moonshot AI backend adapter.
 *
 * @param config - Adapter configuration
 * @returns Moonshot AI backend adapter
 *
 * @example
 * ```typescript
 * import { createMoonshotAdapter } from 'ai.matey';
 *
 * const adapter = createMoonshotAdapter({
 *   apiKey: process.env.MOONSHOT_API_KEY,
 * });
 * ```
 */
export function createMoonshotAdapter(config: BackendAdapterConfig): MoonshotBackendAdapter {
  return new MoonshotBackendAdapter(config);
}
