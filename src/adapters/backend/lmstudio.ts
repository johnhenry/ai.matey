/**
 * LM Studio Backend Adapter
 *
 * Adapts Universal IR to LM Studio local API (OpenAI-compatible).
 * LM Studio runs models locally on your machine with zero cost.
 *
 * @module
 */

import { OpenAIBackendAdapter } from './openai.js';
import type { BackendAdapterConfig } from '../../types/adapters.js';

/**
 * Backend adapter for LM Studio local API.
 *
 * LM Studio provides a local OpenAI-compatible API server for running
 * models on your own hardware. Perfect for privacy, development, and cost savings.
 *
 * @example Basic Usage
 * ```typescript
 * import { LMStudioBackendAdapter } from 'ai.matey';
 *
 * const adapter = new LMStudioBackendAdapter({
 *   baseURL: 'http://localhost:1234/v1', // Default LM Studio port
 * });
 * ```
 *
 * @example With Custom Model
 * ```typescript
 * const adapter = new LMStudioBackendAdapter({
 *   baseURL: 'http://localhost:1234/v1',
 * });
 *
 * const response = await adapter.execute({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: {
 *     model: 'local-model', // Use whatever model is loaded in LM Studio
 *   },
 * });
 * ```
 *
 * @example Privacy-Focused Local Inference
 * ```typescript
 * import { createBridge } from 'ai.matey';
 *
 * const bridge = createBridge({
 *   backend: new LMStudioBackendAdapter({
 *     baseURL: 'http://localhost:1234/v1',
 *   }),
 * });
 *
 * // All requests stay on your local machine
 * const response = await bridge.chat({
 *   messages: [{ role: 'user', content: 'Sensitive data here' }],
 * });
 * ```
 */
export class LMStudioBackendAdapter extends OpenAIBackendAdapter {
  constructor(config: BackendAdapterConfig) {
    // LM Studio default endpoint
    const lmstudioConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'http://localhost:1234/v1',
      // LM Studio doesn't require API key for local usage
      apiKey: config.apiKey || 'not-needed',
    };

    super(lmstudioConfig);

    // Override metadata with LM Studio-specific info
    (this.metadata as any) = {
      name: 'lmstudio-backend',
      version: '1.0.0',
      provider: 'LM Studio',
      capabilities: {
        streaming: true,
        multiModal: false, // Depends on loaded model
        tools: true, // Depends on loaded model
        maxContextTokens: 32000, // Varies by loaded model
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
        baseURL: lmstudioConfig.baseURL,
      },
    };
  }

  /**
   * Health check for LM Studio.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const baseURL = (this.metadata.config as { baseURL: string }).baseURL;

      // LM Studio doesn't require auth for local requests
      const response = await fetch(`${baseURL}/models`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost for LM Studio (always $0 - local inference).
   */
  async estimateCost(_request: import('../../types/ir.js').IRChatRequest): Promise<number | null> {
    // LM Studio is free - runs locally
    return 0;
  }
}

/**
 * Create an LM Studio backend adapter.
 *
 * @param config - Adapter configuration
 * @returns LM Studio backend adapter
 *
 * @example Default Configuration
 * ```typescript
 * import { createLMStudioAdapter } from 'ai.matey';
 *
 * const adapter = createLMStudioAdapter({});
 * ```
 *
 * @example Custom Port
 * ```typescript
 * const adapter = createLMStudioAdapter({
 *   baseURL: 'http://localhost:8080/v1',
 * });
 * ```
 */
export function createLMStudioAdapter(config: Partial<BackendAdapterConfig> = {}): LMStudioBackendAdapter {
  return new LMStudioBackendAdapter(config as BackendAdapterConfig);
}
