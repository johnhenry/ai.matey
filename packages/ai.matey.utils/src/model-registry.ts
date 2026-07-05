/**
 * Model Registry
 *
 * Single source of truth for model metadata (pricing, context windows,
 * capabilities, quality/latency heuristics) across the monorepo. Seeded
 * from ./model-registry-data.ts and extensible at runtime, so consumers
 * are never blocked by stale built-in data:
 *
 * ```typescript
 * import { registerModels } from 'ai.matey.utils';
 *
 * registerModels([
 *   {
 *     id: 'gpt-6-preview',
 *     provider: 'openai',
 *     family: 'gpt-6',
 *     pricing: { inputPer1M: 2.0, outputPer1M: 16.0 },
 *   },
 * ]);
 * ```
 *
 * Lookup resolves exact ids first, then aliases, then falls back to the
 * longest matching id/alias prefix — so an unknown dated snapshot like
 * `claude-sonnet-4-5-20991231` still resolves to the `claude-sonnet-4-5`
 * family entry instead of returning nothing.
 *
 * @module
 */

import type { ModelRegistryEntry, ModelPricingInfo } from 'ai.matey.types';
import { MODEL_REGISTRY_SEED } from './model-registry-data.js';

/** Minimum prefix length considered meaningful for fallback matching. */
const MIN_PREFIX_LENGTH = 6;

/** User-registered entries; always take precedence over the seed. */
const userEntries = new Map<string, ModelRegistryEntry>();

/** User pricing overrides (USD per 1M tokens); highest precedence. */
const pricingOverrides = new Map<string, ModelPricingInfo>();

/** Lazily-built lookup indexes over seed + user entries. */
let index: {
  byId: Map<string, ModelRegistryEntry>;
  byAlias: Map<string, ModelRegistryEntry>;
} | null = null;

function buildIndex(): NonNullable<typeof index> {
  if (index) {
    return index;
  }

  const byId = new Map<string, ModelRegistryEntry>();
  const byAlias = new Map<string, ModelRegistryEntry>();

  // Seed first so user entries overwrite on collision
  for (const entry of [...MODEL_REGISTRY_SEED, ...userEntries.values()]) {
    byId.set(entry.id, entry);
    for (const alias of entry.aliases ?? []) {
      byAlias.set(alias, entry);
    }
  }

  index = { byId, byAlias };
  return index;
}

function invalidateIndex(): void {
  index = null;
}

/**
 * Register (or replace) model entries at runtime.
 *
 * User entries take precedence over the built-in seed for the same id.
 */
export function registerModels(entries: readonly ModelRegistryEntry[]): void {
  for (const entry of entries) {
    userEntries.set(entry.id, entry);
  }
  invalidateIndex();
}

/**
 * Look up a model entry by id, alias, or longest-prefix fallback.
 *
 * @param modelId - Model identifier (canonical id, alias, or unknown variant)
 * @returns The best matching entry, or null when nothing plausibly matches
 */
export function getModelEntry(modelId: string): ModelRegistryEntry | null {
  if (!modelId) {
    return null;
  }

  const { byId, byAlias } = buildIndex();

  const exact = byId.get(modelId) ?? byAlias.get(modelId);
  if (exact) {
    return exact;
  }

  // Fallback: longest id/alias that prefixes the queried id (handles new
  // dated snapshots of known models, e.g. 'claude-sonnet-4-5-20991231')
  let best: ModelRegistryEntry | null = null;
  let bestLength = MIN_PREFIX_LENGTH - 1;

  const consider = (key: string, entry: ModelRegistryEntry): void => {
    if (key.length > bestLength && modelId.startsWith(key)) {
      best = entry;
      bestLength = key.length;
    }
  };

  for (const [id, entry] of byId) {
    consider(id, entry);
  }
  for (const [alias, entry] of byAlias) {
    consider(alias, entry);
  }

  return best;
}

/**
 * Get pricing for a model in USD per 1M tokens (overrides applied).
 */
export function getModelPricingInfo(modelId: string): ModelPricingInfo | null {
  const override = pricingOverrides.get(modelId);
  if (override) {
    return override;
  }
  return getModelEntry(modelId)?.pricing ?? null;
}

/**
 * Override pricing for a model (USD per 1M tokens).
 */
export function overrideModelPricing(modelId: string, pricing: ModelPricingInfo): void {
  pricingOverrides.set(modelId, pricing);
}

/**
 * Remove a single pricing override.
 */
export function clearModelPricingOverride(modelId: string): void {
  pricingOverrides.delete(modelId);
}

/**
 * Remove all pricing overrides.
 */
export function clearModelPricingOverrides(): void {
  pricingOverrides.clear();
}

/**
 * Get a model's maximum input context window in tokens.
 */
export function getModelContextWindow(modelId: string): number | null {
  return getModelEntry(modelId)?.contextWindow ?? null;
}

/**
 * All registry entries (seed + user registrations).
 */
export function getRegisteredModels(): ModelRegistryEntry[] {
  return [...buildIndex().byId.values()];
}

/**
 * Entries for a given provider key (e.g. 'openai').
 */
export function getModelsByProvider(provider: string): ModelRegistryEntry[] {
  return getRegisteredModels().filter((entry) => entry.provider === provider);
}

/**
 * Entries for a given model family (e.g. 'gpt-5', 'claude-4').
 */
export function getModelEntriesByFamily(family: string): ModelRegistryEntry[] {
  return getRegisteredModels().filter((entry) => entry.family === family);
}

/**
 * Reset the registry to its built-in seed (clears user registrations and
 * pricing overrides). Primarily for test isolation.
 */
export function resetModelRegistry(): void {
  userEntries.clear();
  pricingOverrides.clear();
  invalidateIndex();
}
