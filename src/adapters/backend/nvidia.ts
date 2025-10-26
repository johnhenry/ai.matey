/**
 * NVIDIA Backend Adapter
 *
 * Adapts Universal IR to NVIDIA NIM (NVIDIA Inference Microservices) API.
 * NVIDIA NIM provides optimized inference for various models with OpenAI-compatible endpoints.
 *
 * @module
 */

import { OpenAIBackendAdapter } from './openai.js';
import type { BackendAdapterConfig } from '../../types/adapters.js';

/**
 * Backend adapter for NVIDIA NIM API.
 *
 * NVIDIA NIM (NVIDIA Inference Microservices) provides optimized inference
 * with OpenAI-compatible API. Supports various models including Llama,
 * Mistral, and other popular open-source models.
 *
 * @example Basic Usage
 * ```typescript
 * import { NVIDIABackendAdapter } from 'ai.matey';
 *
 * const adapter = new NVIDIABackendAdapter({
 *   apiKey: process.env.NVIDIA_API_KEY,
 * });
 * ```
 *
 * @example With Specific Model
 * ```typescript
 * const adapter = new NVIDIABackendAdapter({
 *   apiKey: process.env.NVIDIA_API_KEY,
 * });
 *
 * const response = await adapter.execute({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: {
 *     model: 'meta/llama-3.1-405b-instruct',
 *   },
 * });
 * ```
 *
 * @example With Custom NIM Endpoint
 * ```typescript
 * const adapter = new NVIDIABackendAdapter({
 *   apiKey: process.env.NVIDIA_API_KEY,
 *   baseURL: 'https://your-nim-endpoint.nvidia.com/v1',
 * });
 * ```
 *
 * @example Streaming with NVIDIA NIM
 * ```typescript
 * const stream = adapter.executeStream({
 *   messages: [{ role: 'user', content: 'Tell me a story' }],
 *   parameters: {
 *     model: 'nvidia/llama-3.1-nemotron-70b-instruct',
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
export class NVIDIABackendAdapter extends OpenAIBackendAdapter {
  constructor(config: BackendAdapterConfig) {
    // NVIDIA NIM API endpoint
    const nvidiaConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'https://integrate.api.nvidia.com/v1',
    };

    super(nvidiaConfig);

    // Override metadata with NVIDIA-specific info
    (this.metadata as any) = {
      name: 'nvidia-backend',
      version: '1.0.0',
      provider: 'NVIDIA',
      capabilities: {
        streaming: true,
        multiModal: false, // Most NIM models are text-only
        tools: true,
        maxContextTokens: 128000, // Varies by model
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
        baseURL: nvidiaConfig.baseURL,
      },
    };
  }

  /**
   * Health check for NVIDIA NIM API.
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
   * Estimate cost for NVIDIA NIM.
   */
  async estimateCost(request: import('../../types/ir.js').IRChatRequest): Promise<number | null> {
    // NVIDIA NIM pricing varies by model and deployment
    // For cloud API, estimate based on token usage
    const estimatedInputTokens = await super.estimateCost(request) || 0;
    const estimatedOutputTokens = Math.min(request.parameters?.maxTokens || 1000, 4000);

    // Rough estimate for NVIDIA cloud API (varies by model)
    // Self-hosted NIM is free (just compute costs)
    const baseURL = (this.metadata.config as { baseURL: string }).baseURL;
    if (baseURL.includes('integrate.api.nvidia.com')) {
      const inputCost = (estimatedInputTokens * 1000) * 0.20 / 1_000_000; // Rough estimate
      const outputCost = (estimatedOutputTokens / 1_000_000) * 0.20;
      return inputCost + outputCost;
    }

    // Self-hosted or custom endpoint
    return null;
  }
}

/**
 * Create an NVIDIA NIM backend adapter.
 *
 * @param config - Adapter configuration
 * @returns NVIDIA backend adapter
 *
 * @example
 * ```typescript
 * import { createNVIDIAAdapter } from 'ai.matey';
 *
 * const adapter = createNVIDIAAdapter({
 *   apiKey: process.env.NVIDIA_API_KEY,
 * });
 * ```
 *
 * @example Self-Hosted NIM
 * ```typescript
 * const adapter = createNVIDIAAdapter({
 *   baseURL: 'http://localhost:8000/v1',
 *   apiKey: 'not-needed', // Self-hosted may not need API key
 * });
 * ```
 */
export function createNVIDIAAdapter(config: BackendAdapterConfig): NVIDIABackendAdapter {
  return new NVIDIABackendAdapter(config);
}
