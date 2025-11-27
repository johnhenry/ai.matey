/**
 * DeepSeek Backend Adapter
 *
 * Adapts Universal IR to DeepSeek API (OpenAI-compatible).
 * DeepSeek provides cost-effective models with strong reasoning capabilities.
 *
 * @module
 */

import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
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
      baseURL: config.baseURL ?? 'https://api.deepseek.com/v1',
    };

    // Pass DeepSeek-specific metadata to parent constructor
    super(deepseekConfig, {
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
    });
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
