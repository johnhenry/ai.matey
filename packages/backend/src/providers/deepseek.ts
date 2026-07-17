/**
 * DeepSeek Backend Adapter
 *
 * Adapts Universal IR to DeepSeek API (OpenAI-compatible).
 * DeepSeek provides cost-effective models with strong reasoning capabilities.
 *
 * @module
 */

import { OpenAIBackendAdapter, type OpenAIRequest, type OpenAIResponse } from './openai.js';
import type { BackendAdapter, BackendAdapterConfig } from 'ai.matey.types';

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
 *   parameters: { model: 'deepseek-v4-flash' },
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
export class DeepSeekBackendAdapter
  extends OpenAIBackendAdapter
  implements BackendAdapter<OpenAIRequest, OpenAIResponse>
{
  constructor(config: BackendAdapterConfig) {
    // DeepSeek API endpoint; default to the current V4 generation
    // (deepseek-chat/deepseek-reasoner are retired as of 2026-07-24).
    // Without this, the inherited OpenAI fallback model would be sent.
    const deepseekConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL ?? 'https://api.deepseek.com/v1',
      defaultModel: config.defaultModel ?? 'deepseek-v4-flash',
    };

    // Pass DeepSeek-specific metadata to parent constructor
    super(deepseekConfig, {
      name: 'deepseek-backend',
      version: '1.0.0',
      provider: 'DeepSeek',
      capabilities: {
        embeddings: false,
        streaming: true,
        // V4 accepts OpenAI-style image_url content (vision rolled out to
        // the API with the V4 generation, 2026)
        multiModal: true,
        tools: true,
        structuredOutput: 'native',
        maxContextTokens: 1_000_000, // V4 default context window
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
