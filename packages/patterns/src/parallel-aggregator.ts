/**
 * Parallel Provider Aggregation
 *
 * Query several backends at once and aggregate: fastest-wins, all-results,
 * or a custom judge. The aggregator is itself a BackendAdapter, so it plugs
 * into a Bridge like any single backend. Extracted from docs/PATTERNS.md §2.
 *
 * @module
 */

import { Router } from 'ai.matey.core';
import type {
  BackendAdapter,
  AdapterMetadata,
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
} from 'ai.matey.types';

/**
 * Aggregation strategy: fastest response, all responses (primary = first),
 * or a custom judge over the full result set.
 */
export type AggregationStrategy =
  | 'fastest'
  | 'all'
  | ((
      results: Array<{ backend: string; response: IRChatResponse; latencyMs: number }>
    ) => IRChatResponse);

/**
 * Configuration for the parallel aggregator.
 */
export interface ParallelAggregatorConfig {
  /** Backends to query, keyed by name. */
  readonly backends: Readonly<Record<string, BackendAdapter>>;

  /** @default 'fastest' */
  readonly strategy?: AggregationStrategy;

  /** Per-dispatch timeout in milliseconds. */
  readonly timeout?: number;
}

/**
 * Create a BackendAdapter that fans requests out to all configured
 * backends in parallel.
 *
 * @example
 * ```typescript
 * const consensus = createParallelAggregator({
 *   backends: { openai, anthropic, gemini },
 *   strategy: (results) => results[0].response, // custom judge
 * });
 * const bridge = new Bridge(new OpenAIFrontendAdapter(), consensus);
 * ```
 */
export function createParallelAggregator(config: ParallelAggregatorConfig): BackendAdapter {
  const strategy = config.strategy ?? 'fastest';

  const router = new Router();
  for (const [name, adapter] of Object.entries(config.backends)) {
    router.register(name, adapter);
  }

  const metadata: AdapterMetadata = {
    name: 'parallel-aggregator',
    version: '1.0.0',
    provider: 'ai.matey.patterns',
    capabilities: {
      streaming: false,
      multiModal: true,
      tools: true,
      systemMessageStrategy: 'in-messages',
      supportsMultipleSystemMessages: true,
    },
  };

  return {
    metadata,

    fromIR: (request: IRChatRequest) => request,
    toIR: () => {
      throw new Error('toIR() not applicable for parallel aggregator');
    },

    async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
      if (typeof strategy === 'function') {
        const result = await router.dispatchParallel(
          request,
          { strategy: 'all', timeout: config.timeout },
          signal
        );
        return strategy([...(result.allResponses ?? [])]);
      }

      const result = await router.dispatchParallel(
        request,
        {
          strategy: strategy === 'fastest' ? 'fastest' : 'all',
          timeout: config.timeout,
        },
        signal
      );
      return result.response;
    },

    // eslint-disable-next-line @typescript-eslint/require-await, require-yield -- adapter interface requires an async generator; aggregation cannot stream
    async *executeStream(): IRChatStream {
      throw new Error(
        'Parallel aggregation does not support streaming; use a single backend for streams'
      );
    },
  };
}
