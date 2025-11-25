/**
 * DeepSeek Backend Adapter
 *
 * Adapts Universal IR to DeepSeek API (OpenAI-compatible).
 * DeepSeek provides cost-effective models with strong reasoning capabilities.
 *
 * @module
 */

import { OpenAIBackendAdapter } from './openai.js';
import type { BackendAdapterConfig } from 'ai.matey.types';

/**
 * Backend adapter for DeepSeek API.
 *
 * DeepSeek uses an OpenAI-compatible API, so we extend the OpenAI adapter
 * with DeepSeek-specific configuration.
 *
 * @example Basic Usage
 * ```typescript
 * import { DeepSeekBackendAdapter } from 'ai.matey';
 *
 * const adapter = new DeepSeekBackendAdapter({
 *   apiKey: process.env.DEEPSEEK_API_KEY,
 * });
 * ```
 *
 * @example With Custom Model
 * ```typescript
 * const adapter = new DeepSeekBackendAdapter({
 *   apiKey: process.env.DEEPSEEK_API_KEY,
 * });
 *
 * const response = await adapter.execute({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: { model: 'deepseek-chat' },
 * });
 * ```
 *
 * @example With Bridge
 * ```typescript
 * import { createBridge } from 'ai.matey';
 *
 * const bridge = createBridge({
 *   backend: new DeepSeekBackendAdapter({
 *     apiKey: process.env.DEEPSEEK_API_KEY,
 *   }),
 * });
 * ```
 */
export class DeepSeekBackendAdapter extends OpenAIBackendAdapter {
  constructor(config: BackendAdapterConfig) {
    // DeepSeek API endpoint
    const deepseekConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'https://api.deepseek.com/v1',
    };

    super(deepseekConfig);

    // Override metadata with DeepSeek-specific info
    (this.metadata as any) = {
      name: 'deepseek-backend',
      version: '1.0.0',
      provider: 'DeepSeek',
      capabilities: {
        streaming: true,
        multiModal: false, // DeepSeek currently doesn't support vision
        tools: true,
        maxContextTokens: 64000, // DeepSeek V2.5 supports 64K context
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: false,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
        maxStopSequences: 4,
      },
      config: {
        baseURL: deepseekConfig.baseURL,
      },
    };
  }

  /**
   * Health check for DeepSeek API.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const baseURL = (this.metadata.config as { baseURL: string }).baseURL;
      const config = (this as unknown as { config: BackendAdapterConfig }).config;

      const response = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          ...config.headers,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost for DeepSeek (very low cost provider).
   */
  async estimateCost(request: import('../../types/ir.js').IRChatRequest): Promise<number | null> {
    // DeepSeek pricing: ~$0.14 per 1M input tokens, ~$0.28 per 1M output tokens
    const estimatedInputTokens = await super.estimateCost(request) || 0;
    const estimatedOutputTokens = Math.min(request.parameters?.maxTokens || 1000, 4000);

    const inputCost = (estimatedInputTokens * 1000) * 0.14 / 1_000_000;
    const outputCost = (estimatedOutputTokens / 1_000_000) * 0.28;

    return inputCost + outputCost;
  }

}

/**
 * Create a DeepSeek backend adapter.
 *
 * @param config - Adapter configuration
 * @returns DeepSeek backend adapter
 *
 * @example
 * ```typescript
 * import { createDeepSeekAdapter } from 'ai.matey';
 *
 * const adapter = createDeepSeekAdapter({
 *   apiKey: process.env.DEEPSEEK_API_KEY,
 * });
 * ```
 */
export function createDeepSeekAdapter(config: BackendAdapterConfig): DeepSeekBackendAdapter {
  return new DeepSeekBackendAdapter(config);
}
