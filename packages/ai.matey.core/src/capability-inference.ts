/**
 * Capability Inference
 *
 * Infers model capabilities from model names and metadata when explicit
 * capability data is not available.
 *
 * @module
 */

import type { ModelCapabilities } from 'ai.matey.types';
import { getModelCapabilities } from './model-pricing.js';

/**
 * Infer capabilities for a model based on its name and optional metadata.
 *
 * Uses pattern matching on model names to determine likely capabilities.
 * Falls back to pricing database if available.
 *
 * @param modelName - The model name/ID
 * @param metadata - Optional metadata to aid inference
 * @returns Inferred capabilities
 */
export function inferCapabilities(
  modelName: string,
  metadata?: Record<string, unknown>
): Partial<ModelCapabilities> {
  // Try pricing database first
  const dbCapabilities = getModelCapabilities(modelName);
  if (dbCapabilities) {
    return dbCapabilities;
  }

  // Infer from model name patterns
  const normalized = modelName.toLowerCase();

  // Detect model family
  const modelFamily = detectModelFamily(normalized);

  // Infer capabilities by family
  const familyCapabilities = modelFamily ? getDefaultCapabilitiesByFamily(modelFamily) : {};

  // Override with pattern-specific capabilities
  const patternCapabilities = inferFromPatterns(normalized);

  // Apply metadata if provided
  const metadataCapabilities = metadata ? inferFromMetadata(metadata) : {};

  // Merge all sources
  return {
    ...familyCapabilities,
    ...patternCapabilities,
    ...metadataCapabilities,
  };
}

/**
 * Detect model family from model name.
 */
function detectModelFamily(normalizedName: string): string | undefined {
  // GPT family
  if (normalizedName.includes('gpt-4o')) {
    return 'gpt-4';
  }
  if (normalizedName.includes('gpt-4')) {
    return 'gpt-4';
  }
  if (normalizedName.includes('gpt-3.5')) {
    return 'gpt-3.5';
  }
  if (normalizedName.includes('gpt-3')) {
    return 'gpt-3';
  }

  // Claude family
  if (normalizedName.includes('claude-3.5')) {
    return 'claude-3';
  }
  if (normalizedName.includes('claude-3')) {
    return 'claude-3';
  }
  if (normalizedName.includes('claude-2')) {
    return 'claude-2';
  }

  // Gemini family
  if (normalizedName.includes('gemini-1.5')) {
    return 'gemini-1.5';
  }
  if (normalizedName.includes('gemini-1.0')) {
    return 'gemini-1.0';
  }
  if (normalizedName.includes('gemini')) {
    return 'gemini-1.5';
  }

  // Mistral family
  if (normalizedName.includes('mistral')) {
    return 'mistral';
  }

  // Llama family
  if (normalizedName.includes('llama-3')) {
    return 'llama-3';
  }
  if (normalizedName.includes('llama-2')) {
    return 'llama-2';
  }
  if (normalizedName.includes('llama')) {
    return 'llama-2';
  }

  // Other families
  if (normalizedName.includes('deepseek')) {
    return 'deepseek';
  }
  if (normalizedName.includes('qwen')) {
    return 'qwen';
  }
  if (normalizedName.includes('phi')) {
    return 'phi';
  }
  if (normalizedName.includes('mixtral')) {
    return 'mixtral';
  }

  return undefined;
}

/**
 * Get default capabilities for a model family.
 */
function getDefaultCapabilitiesByFamily(family: string): Partial<ModelCapabilities> {
  const defaults: Record<string, Partial<ModelCapabilities>> = {
    'gpt-4': {
      contextWindow: 8192,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsJSON: true,
      qualityScore: 90,
    },
    'gpt-3.5': {
      contextWindow: 16385,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsJSON: true,
      qualityScore: 75,
    },
    'claude-3': {
      contextWindow: 200000,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsJSON: false,
      qualityScore: 92,
    },
    'claude-2': {
      contextWindow: 100000,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: false,
      supportsJSON: false,
      qualityScore: 85,
    },
    'gemini-1.5': {
      contextWindow: 1000000,
      maxTokens: 8192,
      supportsStreaming: true,
      supportsVision: true,
      supportsTools: true,
      supportsJSON: true,
      qualityScore: 88,
    },
    mistral: {
      contextWindow: 32000,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsJSON: true,
      qualityScore: 82,
    },
    'llama-3': {
      contextWindow: 8192,
      maxTokens: 2048,
      supportsStreaming: true,
      supportsTools: false,
      supportsJSON: false,
      qualityScore: 78,
    },
    'llama-2': {
      contextWindow: 4096,
      maxTokens: 2048,
      supportsStreaming: true,
      supportsTools: false,
      supportsJSON: false,
      qualityScore: 70,
    },
    deepseek: {
      contextWindow: 64000,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsTools: true,
      supportsJSON: true,
      qualityScore: 82,
    },
  };

  return defaults[family] ?? {};
}

/**
 * Infer capabilities from specific patterns in the model name.
 */
function inferFromPatterns(normalizedName: string): Partial<ModelCapabilities> {
  const capabilities: Record<string, unknown> = {};

  // Vision support
  if (
    normalizedName.includes('vision') ||
    normalizedName.includes('gpt-4o') ||
    normalizedName.includes('gpt-4-turbo') ||
    normalizedName.includes('gemini')
  ) {
    capabilities.supportsVision = true;
  }

  // Extended context windows
  if (normalizedName.includes('turbo') && normalizedName.includes('gpt-4')) {
    capabilities.contextWindow = 128000;
  }
  if (normalizedName.includes('128k')) {
    capabilities.contextWindow = 128000;
  }
  if (normalizedName.includes('32k')) {
    capabilities.contextWindow = 32000;
  }

  // Speed indicators
  if (normalizedName.includes('flash') || normalizedName.includes('haiku')) {
    capabilities.latency = { p50: 500, p95: 1000 };
  }
  if (normalizedName.includes('turbo')) {
    capabilities.latency = { p50: 1000, p95: 2000 };
  }

  return capabilities as Partial<ModelCapabilities>;
}

/**
 * Infer capabilities from model metadata.
 */
function inferFromMetadata(metadata: Record<string, unknown>): Partial<ModelCapabilities> {
  const capabilities: Record<string, unknown> = {};

  // Check for explicit capability flags
  if (typeof metadata.supportsVision === 'boolean') {
    capabilities.supportsVision = metadata.supportsVision;
  }
  if (typeof metadata.supportsTools === 'boolean') {
    capabilities.supportsTools = metadata.supportsTools;
  }
  if (typeof metadata.supportsJSON === 'boolean') {
    capabilities.supportsJSON = metadata.supportsJSON;
  }
  if (typeof metadata.supportsStreaming === 'boolean') {
    capabilities.supportsStreaming = metadata.supportsStreaming;
  }

  // Extract context window
  if (typeof metadata.contextWindow === 'number') {
    capabilities.contextWindow = metadata.contextWindow;
  } else if (typeof metadata.context_window === 'number') {
    capabilities.contextWindow = metadata.context_window;
  } else if (typeof metadata.max_context_length === 'number') {
    capabilities.contextWindow = metadata.max_context_length;
  }

  // Extract max tokens
  if (typeof metadata.maxTokens === 'number') {
    capabilities.maxTokens = metadata.maxTokens;
  } else if (typeof metadata.max_tokens === 'number') {
    capabilities.maxTokens = metadata.max_tokens;
  }

  return capabilities as Partial<ModelCapabilities>;
}

/**
 * Merge multiple capability sources with priority.
 * Later sources override earlier ones.
 */
export function mergeCapabilities(
  ...sources: Array<Partial<ModelCapabilities> | null | undefined>
): Partial<ModelCapabilities> {
  const merged: Partial<ModelCapabilities> = {};

  for (const source of sources) {
    if (!source) {
      continue;
    }

    Object.assign(merged, source);
  }

  return merged;
}

/**
 * Check if a model meets minimum capability requirements.
 */
export function meetsRequirements(
  capabilities: Partial<ModelCapabilities>,
  requirements: Partial<ModelCapabilities>
): boolean {
  // Check boolean capabilities
  if (requirements.supportsStreaming && !capabilities.supportsStreaming) {
    return false;
  }
  if (requirements.supportsVision && !capabilities.supportsVision) {
    return false;
  }
  if (requirements.supportsTools && !capabilities.supportsTools) {
    return false;
  }
  if (requirements.supportsJSON && !capabilities.supportsJSON) {
    return false;
  }

  // Check numeric capabilities (minimums)
  if (
    requirements.contextWindow &&
    (!capabilities.contextWindow || capabilities.contextWindow < requirements.contextWindow)
  ) {
    return false;
  }
  if (
    requirements.maxTokens &&
    (!capabilities.maxTokens || capabilities.maxTokens < requirements.maxTokens)
  ) {
    return false;
  }

  return true;
}

/**
 * Calculate similarity score between two capability sets.
 * Returns a score from 0-100.
 */
export function calculateCapabilitySimilarity(
  caps1: Partial<ModelCapabilities>,
  caps2: Partial<ModelCapabilities>
): number {
  let matches = 0;
  let total = 0;

  // Compare boolean capabilities
  const booleanFields: Array<keyof ModelCapabilities> = [
    'supportsStreaming',
    'supportsVision',
    'supportsTools',
    'supportsJSON',
  ];

  for (const field of booleanFields) {
    if (caps1[field] !== undefined || caps2[field] !== undefined) {
      total++;
      if (caps1[field] === caps2[field]) {
        matches++;
      }
    }
  }

  // Compare model family
  if (caps1.modelFamily || caps2.modelFamily) {
    total++;
    if (caps1.modelFamily === caps2.modelFamily) {
      matches++;
    }
  }

  // Compare numeric ranges (within 20% = similar)
  if (caps1.contextWindow && caps2.contextWindow) {
    total++;
    const ratio =
      Math.min(caps1.contextWindow, caps2.contextWindow) /
      Math.max(caps1.contextWindow, caps2.contextWindow);
    if (ratio >= 0.8) {
      matches++;
    }
  }

  if (total === 0) {
    return 0;
  }
  return (matches / total) * 100;
}
