/**
 * OmniRoute Backend Adapter
 *
 * Adapts Universal IR to OmniRoute's local OpenAI-compatible gateway
 * (https://github.com/diegosouzapw/OmniRoute). OmniRoute is a self-hosted AI
 * gateway that fronts 290+ providers (90+ with free tiers) behind one
 * OpenAI-compatible endpoint, with its own quota-aware auto-fallback across
 * subscription/API-key/cheap/free provider tiers.
 *
 * @module
 */

import { OpenAIBackendAdapter, type OpenAIRequest, type OpenAIResponse } from './openai.js';
import type { BackendAdapter, BackendAdapterConfig, IRChatRequest } from 'ai.matey.types';

/**
 * Backend adapter for a self-hosted OmniRoute gateway.
 *
 * Unlike ai.matey's other aggregators (OpenRouter, Fireworks), OmniRoute is
 * normally run locally with no API key required - a fresh install already
 * answers requests against its keyless free-provider pool via the special
 * `auto` model, which routes to a healthy provider automatically.
 *
 * @example Basic Usage
 * ```typescript
 * import { OmniRouteBackendAdapter } from 'ai.matey.backend/omniroute';
 *
 * const adapter = new OmniRouteBackendAdapter({
 *   baseURL: 'http://localhost:20128/v1', // Default OmniRoute port
 * });
 *
 * const response = await adapter.execute({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   parameters: { model: 'auto' }, // Let OmniRoute pick a healthy free provider
 * });
 * ```
 */
export class OmniRouteBackendAdapter
  extends OpenAIBackendAdapter
  implements BackendAdapter<OpenAIRequest, OpenAIResponse>
{
  constructor(config: BackendAdapterConfig) {
    const omnirouteConfig: BackendAdapterConfig = {
      ...config,
      baseURL: config.baseURL || 'http://localhost:20128/v1',
      defaultModel: config.defaultModel || 'auto',
      // OmniRoute doesn't require an API key for local/keyless-free usage
      apiKey: config.apiKey || 'not-needed',
    };

    super(omnirouteConfig, {
      name: 'omniroute-backend',
      version: '1.0.0',
      provider: 'OmniRoute',
      capabilities: {
        embeddings: true, // proxies OpenAI's /v1/embeddings too
        maxEmbeddingBatchSize: 100,
        streaming: true,
        multiModal: true, // depends on the routed provider/model
        tools: true, // depends on the routed provider/model
        structuredOutput: 'native',
        maxContextTokens: 128000, // varies widely by routed provider/model
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
        baseURL: omnirouteConfig.baseURL,
      },
    });
  }

  /**
   * Health check for OmniRoute. No auth required for local requests.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
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
   * Estimate cost. OmniRoute routes each request to one of 290+ providers
   * (including free ones) based on its own quota/cost-aware fallback logic,
   * so the actual cost isn't knowable from the request alone.
   */
  estimateCost(_request: IRChatRequest): Promise<number | null> {
    return Promise.resolve(null);
  }
}

/**
 * Create an OmniRoute backend adapter.
 *
 * @param config - Adapter configuration
 * @returns OmniRoute backend adapter
 *
 * @example Default Configuration
 * ```typescript
 * import { createOmniRouteAdapter } from 'ai.matey.backend/omniroute';
 *
 * const adapter = createOmniRouteAdapter({});
 * ```
 */
export function createOmniRouteAdapter(
  config: BackendAdapterConfig = {} as BackendAdapterConfig
): OmniRouteBackendAdapter {
  return new OmniRouteBackendAdapter(config);
}
