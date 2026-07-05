/**
 * Model Pricing Registry (compatibility layer)
 *
 * Historical API for model pricing lookups, expressed in USD per 1,000
 * tokens. Since the introduction of the shared model registry this module
 * is a thin delegate over `ai.matey.utils`' registry — the registry (and
 * its seed data file) is the single source of truth. Prefer the registry
 * API (`getModelEntry`, `registerModels`, `overrideModelPricing`) in new
 * code; this module remains for backward compatibility.
 *
 * @module
 */

import type { ModelCapabilities, ModelRegistryEntry } from 'ai.matey.types';
import {
  getModelEntry,
  getModelPricingInfo,
  getRegisteredModels,
  getModelEntriesByFamily,
  overrideModelPricing,
  clearModelPricingOverride,
  clearModelPricingOverrides,
} from 'ai.matey.utils';

/**
 * Pricing data for a specific model (USD per 1k tokens).
 */
export interface ModelPricing {
  readonly input: number; // Cost per 1k input tokens (USD)
  readonly output: number; // Cost per 1k output tokens (USD)
}

/**
 * Extended capabilities including estimated quality and latency.
 */
export interface ExtendedModelCapabilities extends ModelCapabilities {
  readonly pricing: ModelPricing;
  readonly latency?: {
    readonly p50?: number;
    readonly p95?: number;
  };
  readonly qualityScore?: number;
  readonly modelFamily?: string;
  readonly releaseDate?: string;
}

/** Convert registry per-1M pricing to this module's per-1k units. */
function toPer1k(pricing: { inputPer1M: number; outputPer1M: number }): ModelPricing {
  return {
    input: pricing.inputPer1M / 1000,
    output: pricing.outputPer1M / 1000,
  };
}

function toExtendedCapabilities(
  entry: ModelRegistryEntry
): Partial<ExtendedModelCapabilities> | null {
  if (!entry.pricing) {
    return null;
  }
  return {
    pricing: toPer1k(entry.pricing),
    latency: entry.latency,
    qualityScore: entry.qualityScore,
    modelFamily: entry.family,
    releaseDate: entry.releaseDate,
    contextWindow: entry.contextWindow,
    maxTokens: entry.maxOutputTokens,
    supportsStreaming: entry.capabilities?.streaming,
    supportsVision: entry.capabilities?.vision,
    supportsTools: entry.capabilities?.tools,
    supportsJSON: entry.capabilities?.json,
  };
}

/**
 * Get pricing information for a specific model.
 *
 * @param modelId - The model identifier (e.g., "gpt-5.1", "claude-sonnet-4-5")
 * @returns Pricing data or null if not found
 */
export function getModelPricing(modelId: string): ModelPricing | null {
  const entry = getModelEntry(modelId);
  return entry?.pricing ? toPer1k(entry.pricing) : null;
}

/**
 * Get extended capabilities for a specific model.
 *
 * @param modelId - The model identifier
 * @returns Extended capabilities or null if not found
 */
export function getModelCapabilities(modelId: string): Partial<ExtendedModelCapabilities> | null {
  const entry = getModelEntry(modelId);
  return entry ? toExtendedCapabilities(entry) : null;
}

/**
 * Get all models with pricing data.
 *
 * @returns Array of model IDs with pricing information
 */
export function getAllPricedModels(): string[] {
  return getRegisteredModels()
    .filter((entry) => entry.pricing)
    .flatMap((entry) => [entry.id, ...(entry.aliases ?? [])]);
}

/**
 * Find models by model family.
 *
 * Includes aliases (e.g. 'mistral-large-latest') alongside canonical ids.
 *
 * @param family - The model family (e.g., "gpt-5", "claude-4")
 * @returns Array of model IDs in the family
 */
export function getModelsByFamily(family: string): string[] {
  return getModelEntriesByFamily(family).flatMap((entry) => [entry.id, ...(entry.aliases ?? [])]);
}

/**
 * Set custom pricing for a model (overrides the registry).
 *
 * @param modelId - The model identifier
 * @param pricing - Custom pricing data (USD per 1k tokens)
 */
export function setPricingOverride(modelId: string, pricing: ModelPricing): void {
  overrideModelPricing(modelId, {
    inputPer1M: pricing.input * 1000,
    outputPer1M: pricing.output * 1000,
  });
}

/**
 * Clear pricing override for a model.
 *
 * @param modelId - The model identifier
 */
export function clearPricingOverride(modelId: string): void {
  clearModelPricingOverride(modelId);
}

/**
 * Clear all pricing overrides.
 */
export function clearAllPricingOverrides(): void {
  clearModelPricingOverrides();
}

/**
 * Get pricing with user overrides applied.
 *
 * @param modelId - The model identifier
 * @returns Pricing data (override if set, else from the registry)
 */
export function getPricingWithOverrides(modelId: string): ModelPricing | null {
  const info = getModelPricingInfo(modelId);
  return info ? toPer1k(info) : null;
}
