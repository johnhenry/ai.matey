/**
 * Parameter Normalization Utilities
 *
 * Normalizes parameters across different provider ranges and conventions.
 * Enhanced with warning generation for semantic drift tracking.
 *
 * @module
 */

import type { IRParameters, IRCapabilities, IRWarning } from 'ai.matey.types';
import {
  createNormalizationWarning,
  createClampingWarning,
  createUnsupportedParameterWarning,
  createStopSequencesTruncatedWarning,
} from './warnings.js';

// ============================================================================
// Parameter Normalization
// ============================================================================

/**
 * Normalize temperature to provider's range.
 *
 * IR uses 0-2 range (OpenAI convention).
 * Some providers use 0-1 range (Anthropic).
 *
 * @param temperature Temperature value (0-2)
 * @param targetRange Target range ('0-1' or '0-2')
 * @returns Normalized temperature
 */
export function normalizeTemperature(
  temperature: number | undefined,
  targetRange: '0-1' | '0-2' = '0-2'
): number | undefined {
  if (temperature === undefined) {
    return undefined;
  }

  // Clamp to IR range
  const clamped = Math.max(0, Math.min(2, temperature));

  if (targetRange === '0-1') {
    // Scale 0-2 to 0-1
    return clamped / 2;
  }

  return clamped;
}

/**
 * Denormalize temperature from provider's range back to IR.
 *
 * @param temperature Temperature value from provider
 * @param sourceRange Source range ('0-1' or '0-2')
 * @returns IR temperature (0-2)
 */
export function denormalizeTemperature(
  temperature: number | undefined,
  sourceRange: '0-1' | '0-2' = '0-2'
): number | undefined {
  if (temperature === undefined) {
    return undefined;
  }

  if (sourceRange === '0-1') {
    // Scale 0-1 to 0-2
    return temperature * 2;
  }

  return temperature;
}

/**
 * Normalize topP parameter.
 *
 * Always 0-1 range across providers.
 *
 * @param topP TopP value
 * @returns Clamped topP
 */
export function normalizeTopP(topP: number | undefined): number | undefined {
  if (topP === undefined) {
    return undefined;
  }

  return Math.max(0, Math.min(1, topP));
}

/**
 * Normalize topK parameter.
 *
 * @param topK TopK value
 * @param maxTopK Maximum topK supported by provider
 * @returns Clamped topK
 */
export function normalizeTopK(topK: number | undefined, maxTopK: number = 100): number | undefined {
  if (topK === undefined) {
    return undefined;
  }

  return Math.max(1, Math.min(maxTopK, Math.floor(topK)));
}

/**
 * Normalize penalty parameters (frequency, presence).
 *
 * IR uses -2 to 2 range (OpenAI convention).
 * Some providers might use different ranges.
 *
 * @param penalty Penalty value
 * @param targetRange Target range
 * @returns Normalized penalty
 */
export function normalizePenalty(
  penalty: number | undefined,
  targetRange: { min: number; max: number } = { min: -2, max: 2 }
): number | undefined {
  if (penalty === undefined) {
    return undefined;
  }

  // Clamp to IR range first
  const clamped = Math.max(-2, Math.min(2, penalty));

  // Map from -2..2 to target range
  const normalized = ((clamped + 2) / 4) * (targetRange.max - targetRange.min) + targetRange.min;

  return normalized;
}

/**
 * Normalize stop sequences.
 *
 * @param stopSequences Stop sequences array
 * @param maxStopSequences Maximum number of stop sequences supported
 * @returns Normalized stop sequences
 */
export function normalizeStopSequences(
  stopSequences: readonly string[] | undefined,
  maxStopSequences?: number
): string[] | undefined {
  if (!stopSequences || stopSequences.length === 0) {
    return undefined;
  }

  // Remove duplicates
  const unique = Array.from(new Set(stopSequences));

  // Limit to max if specified
  if (maxStopSequences !== undefined && maxStopSequences > 0) {
    return unique.slice(0, maxStopSequences);
  }

  return unique;
}

// ============================================================================
// Parameter Filtering
// ============================================================================

/**
 * Filter parameters based on provider capabilities.
 *
 * Removes parameters that the provider doesn't support.
 *
 * @param parameters IR parameters
 * @param capabilities Provider capabilities
 * @returns Filtered parameters
 */
export function filterUnsupportedParameters(
  parameters: IRParameters | undefined,
  capabilities: IRCapabilities
): IRParameters {
  if (!parameters) {
    return {};
  }

  const filtered: Record<string, unknown> = {
    model: parameters.model,
  };

  // Only include supported parameters
  if (capabilities.supportsTemperature !== false && parameters.temperature !== undefined) {
    filtered.temperature = parameters.temperature;
  }

  if (capabilities.supportsTopP !== false && parameters.topP !== undefined) {
    filtered.topP = parameters.topP;
  }

  if (capabilities.supportsTopK && parameters.topK !== undefined) {
    filtered.topK = parameters.topK;
  }

  if (
    capabilities.supportsFrequencyPenalty !== false &&
    parameters.frequencyPenalty !== undefined
  ) {
    filtered.frequencyPenalty = parameters.frequencyPenalty;
  }

  if (capabilities.supportsPresencePenalty !== false && parameters.presencePenalty !== undefined) {
    filtered.presencePenalty = parameters.presencePenalty;
  }

  if (parameters.maxTokens !== undefined) {
    filtered.maxTokens = parameters.maxTokens;
  }

  if (parameters.stopSequences !== undefined) {
    filtered.stopSequences = normalizeStopSequences(
      parameters.stopSequences,
      capabilities.maxStopSequences
    );
  }

  if (capabilities.supportsSeed !== false && parameters.seed !== undefined) {
    filtered.seed = parameters.seed;
  }

  if (parameters.user !== undefined) {
    filtered.user = parameters.user;
  }

  if (parameters.custom !== undefined) {
    filtered.custom = parameters.custom;
  }

  return filtered as IRParameters;
}

/**
 * Apply parameter defaults.
 *
 * @param parameters IR parameters
 * @param defaults Default values
 * @returns Parameters with defaults applied
 */
export function applyParameterDefaults(
  parameters: IRParameters | undefined,
  defaults: Partial<IRParameters>
): IRParameters {
  return {
    ...defaults,
    ...parameters,
  };
}

/**
 * Merge parameter objects.
 *
 * Later parameters override earlier ones.
 *
 * @param parameterSets Parameter objects to merge
 * @returns Merged parameters
 */
export function mergeParameters(...parameterSets: Array<IRParameters | undefined>): IRParameters {
  const merged: Partial<IRParameters> = {};

  for (const params of parameterSets) {
    if (!params) {
      continue;
    }

    Object.assign(merged, params);
  }

  return merged as IRParameters;
}

// ============================================================================
// Parameter Validation
// ============================================================================

/**
 * Clamp parameter to valid range.
 *
 * @param value Parameter value
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export function clampParameter(
  value: number | undefined,
  min: number,
  max: number
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Math.max(min, Math.min(max, value));
}

/**
 * Sanitize parameters by clamping to valid ranges.
 *
 * @param parameters IR parameters
 * @returns Sanitized parameters
 */
export function sanitizeParameters(parameters: IRParameters | undefined): IRParameters {
  if (!parameters) {
    return {};
  }

  const sanitized: Record<string, unknown> = { ...parameters };

  if (parameters.temperature !== undefined) {
    sanitized.temperature = clampParameter(parameters.temperature, 0, 2);
  }
  if (parameters.maxTokens !== undefined) {
    sanitized.maxTokens = Math.max(1, Math.floor(parameters.maxTokens));
  }
  if (parameters.topP !== undefined) {
    sanitized.topP = clampParameter(parameters.topP, 0, 1);
  }
  if (parameters.topK !== undefined) {
    sanitized.topK = Math.max(1, Math.floor(parameters.topK));
  }
  if (parameters.frequencyPenalty !== undefined) {
    sanitized.frequencyPenalty = clampParameter(parameters.frequencyPenalty, -2, 2);
  }
  if (parameters.presencePenalty !== undefined) {
    sanitized.presencePenalty = clampParameter(parameters.presencePenalty, -2, 2);
  }
  if (parameters.seed !== undefined) {
    sanitized.seed = Math.floor(parameters.seed);
  }

  return sanitized as IRParameters;
}

/**
 * Check if parameters are within valid ranges.
 *
 * @param parameters IR parameters
 * @returns true if all parameters are valid
 */
export function areParametersValid(parameters: IRParameters | undefined): boolean {
  if (!parameters) {
    return true;
  }

  // Check temperature
  if (parameters.temperature !== undefined) {
    if (parameters.temperature < 0 || parameters.temperature > 2) {
      return false;
    }
  }

  // Check maxTokens
  if (parameters.maxTokens !== undefined) {
    if (parameters.maxTokens < 1 || !Number.isInteger(parameters.maxTokens)) {
      return false;
    }
  }

  // Check topP
  if (parameters.topP !== undefined) {
    if (parameters.topP < 0 || parameters.topP > 1) {
      return false;
    }
  }

  // Check topK
  if (parameters.topK !== undefined) {
    if (parameters.topK < 1 || !Number.isInteger(parameters.topK)) {
      return false;
    }
  }

  // Check penalties
  if (parameters.frequencyPenalty !== undefined) {
    if (parameters.frequencyPenalty < -2 || parameters.frequencyPenalty > 2) {
      return false;
    }
  }

  if (parameters.presencePenalty !== undefined) {
    if (parameters.presencePenalty < -2 || parameters.presencePenalty > 2) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Warning-Aware Normalization (Phase 7)
// ============================================================================

/**
 * Result of parameter normalization with warnings.
 */
export interface NormalizationResult<T> {
  /** Normalized value */
  value: T;
  /** Warnings generated during normalization */
  warnings: IRWarning[];
}

/**
 * Normalize temperature with warning generation.
 *
 * @param temperature Temperature value (0-2)
 * @param targetRange Target range ('0-1' or '0-2')
 * @param source Source adapter name
 * @returns Normalized temperature and warnings
 */
export function normalizeTemperatureWithWarnings(
  temperature: number | undefined,
  targetRange: '0-1' | '0-2' = '0-2',
  source?: string
): NormalizationResult<number | undefined> {
  const warnings: IRWarning[] = [];

  if (temperature === undefined) {
    return { value: undefined, warnings };
  }

  const original = temperature;
  const clamped = Math.max(0, Math.min(2, temperature));

  // Warn if clamped
  if (clamped !== original) {
    warnings.push(createClampingWarning('temperature', original, clamped, 0, 2, source));
  }

  if (targetRange === '0-1') {
    const normalized = clamped / 2;
    // Warn about scaling
    if (clamped > 1) {
      warnings.push(
        createNormalizationWarning(
          'temperature',
          clamped,
          normalized,
          `Temperature scaled from 0-2 range (${clamped}) to 0-1 range (${normalized.toFixed(2)})`,
          source
        )
      );
    }
    return { value: normalized, warnings };
  }

  return { value: clamped, warnings };
}

/**
 * Normalize stop sequences with warning generation.
 *
 * @param stopSequences Stop sequences array
 * @param maxStopSequences Maximum number supported
 * @param source Source adapter name
 * @returns Normalized stop sequences and warnings
 */
export function normalizeStopSequencesWithWarnings(
  stopSequences: readonly string[] | undefined,
  maxStopSequences: number | undefined,
  source?: string
): NormalizationResult<string[] | undefined> {
  const warnings: IRWarning[] = [];

  if (!stopSequences || stopSequences.length === 0) {
    return { value: undefined, warnings };
  }

  // Remove duplicates
  const unique = Array.from(new Set(stopSequences));

  // Limit to max if specified
  if (maxStopSequences !== undefined && maxStopSequences > 0 && unique.length > maxStopSequences) {
    warnings.push(createStopSequencesTruncatedWarning(unique.length, maxStopSequences, source));
    return { value: unique.slice(0, maxStopSequences), warnings };
  }

  return { value: unique, warnings };
}

/**
 * Filter parameters with warning generation.
 *
 * @param parameters IR parameters
 * @param capabilities Provider capabilities
 * @param source Source adapter name
 * @returns Filtered parameters and warnings
 */
export function filterUnsupportedParametersWithWarnings(
  parameters: IRParameters | undefined,
  capabilities: IRCapabilities,
  source?: string
): NormalizationResult<IRParameters> {
  const warnings: IRWarning[] = [];

  if (!parameters) {
    return { value: {}, warnings };
  }

  const filtered: Record<string, unknown> = {
    model: parameters.model,
  };

  // Check each parameter for support
  if (parameters.temperature !== undefined) {
    if (capabilities.supportsTemperature !== false) {
      filtered.temperature = parameters.temperature;
    } else {
      warnings.push(
        createUnsupportedParameterWarning('temperature', parameters.temperature, source)
      );
    }
  }

  if (parameters.topP !== undefined) {
    if (capabilities.supportsTopP !== false) {
      filtered.topP = parameters.topP;
    } else {
      warnings.push(createUnsupportedParameterWarning('topP', parameters.topP, source));
    }
  }

  if (parameters.topK !== undefined) {
    if (capabilities.supportsTopK) {
      filtered.topK = parameters.topK;
    } else {
      warnings.push(createUnsupportedParameterWarning('topK', parameters.topK, source));
    }
  }

  if (parameters.frequencyPenalty !== undefined) {
    if (capabilities.supportsFrequencyPenalty !== false) {
      filtered.frequencyPenalty = parameters.frequencyPenalty;
    } else {
      warnings.push(
        createUnsupportedParameterWarning('frequencyPenalty', parameters.frequencyPenalty, source)
      );
    }
  }

  if (parameters.presencePenalty !== undefined) {
    if (capabilities.supportsPresencePenalty !== false) {
      filtered.presencePenalty = parameters.presencePenalty;
    } else {
      warnings.push(
        createUnsupportedParameterWarning('presencePenalty', parameters.presencePenalty, source)
      );
    }
  }

  if (parameters.seed !== undefined) {
    if (capabilities.supportsSeed !== false) {
      filtered.seed = parameters.seed;
    } else {
      warnings.push(createUnsupportedParameterWarning('seed', parameters.seed, source));
    }
  }

  // Always include these
  if (parameters.maxTokens !== undefined) {
    filtered.maxTokens = parameters.maxTokens;
  }

  // Handle stop sequences with warnings
  if (parameters.stopSequences !== undefined) {
    const stopResult = normalizeStopSequencesWithWarnings(
      parameters.stopSequences,
      capabilities.maxStopSequences,
      source
    );
    filtered.stopSequences = stopResult.value;
    warnings.push(...stopResult.warnings);
  }

  if (parameters.user !== undefined) {
    filtered.user = parameters.user;
  }

  if (parameters.custom !== undefined) {
    filtered.custom = parameters.custom;
  }

  return { value: filtered as IRParameters, warnings };
}
