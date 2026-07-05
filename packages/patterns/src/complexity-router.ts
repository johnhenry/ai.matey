/**
 * Complexity-Based Routing
 *
 * Route requests to different backends by estimated query complexity —
 * cheap/fast models for simple queries, capable models for hard ones.
 * Extracted from docs/PATTERNS.md §1.
 *
 * @module
 */

import { Router } from 'ai.matey.core';
import type { RouterConfig } from 'ai.matey.types';
import type { BackendAdapter, IRChatRequest } from 'ai.matey.types';

/**
 * A complexity tier: requests scoring at or below `maxComplexity` go to
 * `backend`.
 */
export interface ComplexityTier {
  readonly backend: string;
  readonly maxComplexity: number;
}

/**
 * Configuration for the complexity router.
 */
export interface ComplexityRouterConfig {
  /** Tiers sorted ascending by maxComplexity; the last tier is the catch-all. */
  readonly tiers: readonly ComplexityTier[];

  /** Backends keyed by the names used in tiers. */
  readonly backends: Readonly<Record<string, BackendAdapter>>;

  /** Score a request 0-100. Defaults to {@link defaultComplexityAnalyzer}. */
  readonly analyzer?: (request: IRChatRequest) => number;

  /** Extra Router configuration (fallback, circuit breaker, ...). */
  readonly routerConfig?: Partial<RouterConfig>;
}

/**
 * Heuristic complexity score (0-100) from message length, question depth,
 * and reasoning keywords.
 */
export function defaultComplexityAnalyzer(request: IRChatRequest): number {
  const text = request.messages
    .map((message) =>
      typeof message.content === 'string'
        ? message.content
        : message.content.map((block) => (block.type === 'text' ? block.text : '')).join(' ')
    )
    .join(' ');

  let score = 0;

  // Length: up to 40 points at ~2000 chars
  score += Math.min(40, text.length / 50);

  // Reasoning indicators: up to 40 points
  const reasoningKeywords = [
    'why',
    'how',
    'explain',
    'analyze',
    'compare',
    'evaluate',
    'design',
    'architect',
    'prove',
    'derive',
    'step by step',
    'trade-off',
    'tradeoff',
  ];
  const lower = text.toLowerCase();
  const hits = reasoningKeywords.filter((keyword) => lower.includes(keyword)).length;
  score += Math.min(40, hits * 10);

  // Code blocks / structured content: up to 20 points
  if (lower.includes('```') || lower.includes('function ') || lower.includes('class ')) {
    score += 20;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Create a Router that picks its backend by query complexity.
 *
 * @example
 * ```typescript
 * const router = createComplexityRouter({
 *   tiers: [
 *     { backend: 'fast', maxComplexity: 30 },
 *     { backend: 'balanced', maxComplexity: 70 },
 *     { backend: 'powerful', maxComplexity: 100 },
 *   ],
 *   backends: { fast, balanced, powerful },
 * });
 * ```
 */
export function createComplexityRouter(config: ComplexityRouterConfig): Router {
  const analyzer = config.analyzer ?? defaultComplexityAnalyzer;
  const tiers = [...config.tiers].sort((a, b) => a.maxComplexity - b.maxComplexity);

  const router = new Router({
    ...config.routerConfig,
    routingStrategy: 'custom',
    customRouter: (request, availableBackends) => {
      const complexity = analyzer(request);
      const tier =
        tiers.find(
          (candidate) =>
            complexity <= candidate.maxComplexity && availableBackends.includes(candidate.backend)
        ) ?? tiers[tiers.length - 1];
      return Promise.resolve(tier?.backend ?? null);
    },
  });

  for (const [name, adapter] of Object.entries(config.backends)) {
    router.register(name, adapter);
  }

  return router;
}
