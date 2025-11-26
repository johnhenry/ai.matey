import { describe, it, expect } from 'vitest';
import {
  normalizeTemperature,
  denormalizeTemperature,
  normalizeTopP,
  normalizeTopK,
  normalizePenalty,
  normalizeStopSequences,
  filterUnsupportedParameters,
  applyParameterDefaults,
  mergeParameters,
  clampParameter,
  sanitizeParameters,
  areParametersValid,
} from 'ai.matey.utils';
import type { IRParameters } from 'ai.matey.types';

describe('Parameter Normalizer', () => {
  describe('normalizeTemperature', () => {
    it('should normalize temperature to 0-1 range', () => {
      expect(normalizeTemperature(0, '0-1')).toBe(0);
      expect(normalizeTemperature(1, '0-1')).toBe(0.5);
      expect(normalizeTemperature(2, '0-1')).toBe(1);
    });

    it('should keep temperature in 0-2 range', () => {
      expect(normalizeTemperature(0, '0-2')).toBe(0);
      expect(normalizeTemperature(1, '0-2')).toBe(1);
      expect(normalizeTemperature(2, '0-2')).toBe(2);
    });

    it('should clamp out of range values', () => {
      expect(normalizeTemperature(-1, '0-2')).toBe(0);
      expect(normalizeTemperature(3, '0-2')).toBe(2);
    });

    it('should return undefined for undefined input', () => {
      expect(normalizeTemperature(undefined, '0-2')).toBeUndefined();
    });
  });

  describe('denormalizeTemperature', () => {
    it('should denormalize temperature from 0-1 range', () => {
      expect(denormalizeTemperature(0, '0-1')).toBe(0);
      expect(denormalizeTemperature(0.5, '0-1')).toBe(1);
      expect(denormalizeTemperature(1, '0-1')).toBe(2);
    });

    it('should keep temperature from 0-2 range', () => {
      expect(denormalizeTemperature(0, '0-2')).toBe(0);
      expect(denormalizeTemperature(1, '0-2')).toBe(1);
      expect(denormalizeTemperature(2, '0-2')).toBe(2);
    });

    it('should return undefined for undefined input', () => {
      expect(denormalizeTemperature(undefined, '0-2')).toBeUndefined();
    });
  });

  describe('normalizeTopP', () => {
    it('should normalize topP values', () => {
      expect(normalizeTopP(0)).toBe(0);
      expect(normalizeTopP(0.5)).toBe(0.5);
      expect(normalizeTopP(1)).toBe(1);
    });

    it('should clamp out of range values', () => {
      expect(normalizeTopP(-0.1)).toBe(0);
      expect(normalizeTopP(1.5)).toBe(1);
    });

    it('should return undefined for undefined input', () => {
      expect(normalizeTopP(undefined)).toBeUndefined();
    });
  });

  describe('normalizeTopK', () => {
    it('should normalize topK values', () => {
      expect(normalizeTopK(10)).toBe(10);
      expect(normalizeTopK(50)).toBe(50);
    });

    it('should ensure minimum value', () => {
      expect(normalizeTopK(0)).toBe(1);
      expect(normalizeTopK(-5)).toBe(1);
    });

    it('should return undefined for undefined input', () => {
      expect(normalizeTopK(undefined)).toBeUndefined();
    });
  });

  describe('normalizePenalty', () => {
    it('should normalize penalty values', () => {
      expect(normalizePenalty(0)).toBe(0);
      expect(normalizePenalty(1)).toBe(1);
      expect(normalizePenalty(-1)).toBe(-1);
    });

    it('should clamp out of range values', () => {
      expect(normalizePenalty(-3)).toBe(-2);
      expect(normalizePenalty(3)).toBe(2);
    });

    it('should return undefined for undefined input', () => {
      expect(normalizePenalty(undefined)).toBeUndefined();
    });
  });

  describe('normalizeStopSequences', () => {
    it('should keep array as is', () => {
      const result = normalizeStopSequences(['STOP1', 'STOP2']);
      expect(result).toEqual(['STOP1', 'STOP2']);
    });

    it('should remove duplicates', () => {
      const result = normalizeStopSequences(['STOP', 'END', 'STOP']);
      expect(result).toEqual(['STOP', 'END']);
    });

    it('should limit to maxStopSequences', () => {
      const result = normalizeStopSequences(['A', 'B', 'C', 'D'], 2);
      expect(result).toEqual(['A', 'B']);
    });

    it('should return undefined for undefined input', () => {
      expect(normalizeStopSequences(undefined)).toBeUndefined();
    });

    it('should return undefined for empty array', () => {
      expect(normalizeStopSequences([])).toBeUndefined();
    });
  });

  describe('filterUnsupportedParameters', () => {
    it('should filter out unsupported parameters', () => {
      const params: IRParameters = {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
        topK: 40,
      };

      const capabilities = {
        streaming: true,
        multiModal: false,
        systemMessageStrategy: 'in-messages' as const,
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: false,
        supportsTopK: false,
      };

      const filtered = filterUnsupportedParameters(params, capabilities);

      expect(filtered).toEqual({
        temperature: 0.7,
        maxTokens: 100,
        model: undefined,
      });
    });

    it('should keep all parameters if all supported', () => {
      const params: IRParameters = {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
      };

      const capabilities = {
        streaming: true,
        multiModal: false,
        systemMessageStrategy: 'in-messages' as const,
        supportsMultipleSystemMessages: false,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
      };

      const filtered = filterUnsupportedParameters(params, capabilities);

      expect(filtered.temperature).toBe(0.7);
      expect(filtered.maxTokens).toBe(100);
      expect(filtered.topP).toBe(0.9);
    });

    it('should handle empty parameters', () => {
      const capabilities = {
        streaming: true,
        multiModal: false,
        systemMessageStrategy: 'in-messages' as const,
        supportsMultipleSystemMessages: false,
      };
      const filtered = filterUnsupportedParameters({}, capabilities);
      expect(filtered).toEqual({ model: undefined });
    });
  });

  describe('applyParameterDefaults', () => {
    it('should apply default values for missing parameters', () => {
      const params: IRParameters = {
        temperature: 0.7,
      };

      const defaults: IRParameters = {
        temperature: 1.0,
        maxTokens: 1000,
        topP: 0.9,
      };

      const result = applyParameterDefaults(params, defaults);

      expect(result).toEqual({
        temperature: 0.7, // Keep existing value
        maxTokens: 1000, // Apply default
        topP: 0.9, // Apply default
      });
    });

    it('should not override existing values', () => {
      const params: IRParameters = {
        temperature: 0.5,
        maxTokens: 500,
      };

      const defaults: IRParameters = {
        temperature: 1.0,
        maxTokens: 1000,
      };

      const result = applyParameterDefaults(params, defaults);

      expect(result.temperature).toBe(0.5);
      expect(result.maxTokens).toBe(500);
    });

    it('should handle empty defaults', () => {
      const params: IRParameters = {
        temperature: 0.7,
      };

      const result = applyParameterDefaults(params, {});

      expect(result).toEqual(params);
    });
  });

  describe('mergeParameters', () => {
    it('should merge multiple parameter objects', () => {
      const base: IRParameters = {
        temperature: 0.7,
        maxTokens: 100,
      };

      const override: IRParameters = {
        temperature: 0.9,
        topP: 0.8,
      };

      const result = mergeParameters(base, override);

      expect(result).toEqual({
        temperature: 0.9, // Overridden
        maxTokens: 100, // From base
        topP: 0.8, // From override
      });
    });

    it('should handle multiple overrides', () => {
      const result = mergeParameters(
        { temperature: 0.5 },
        { temperature: 0.7, maxTokens: 100 },
        { maxTokens: 200, topP: 0.9 }
      );

      expect(result).toEqual({
        temperature: 0.7,
        maxTokens: 200,
        topP: 0.9,
      });
    });

    it('should handle undefined parameters', () => {
      const result = mergeParameters({ temperature: 0.7 }, undefined, { topP: 0.9 });

      expect(result).toEqual({
        temperature: 0.7,
        topP: 0.9,
      });
    });
  });

  describe('clampParameter', () => {
    it('should clamp value within range', () => {
      expect(clampParameter(5, 0, 10)).toBe(5);
      expect(clampParameter(-5, 0, 10)).toBe(0);
      expect(clampParameter(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clampParameter(0, 0, 10)).toBe(0);
      expect(clampParameter(10, 0, 10)).toBe(10);
    });

    it('should work with decimals', () => {
      expect(clampParameter(0.5, 0, 1)).toBe(0.5);
      expect(clampParameter(-0.1, 0, 1)).toBe(0);
      expect(clampParameter(1.5, 0, 1)).toBe(1);
    });
  });

  describe('sanitizeParameters', () => {
    it('should clamp temperature to valid range', () => {
      const params = {
        temperature: 5.0,
      };

      const result = sanitizeParameters(params);

      expect(result.temperature).toBe(2.0);
    });

    it('should clamp maxTokens to minimum 1', () => {
      const params = {
        maxTokens: -5,
      };

      const result = sanitizeParameters(params);

      expect(result.maxTokens).toBe(1);
    });

    it('should clamp topP to 0-1 range', () => {
      const params = {
        topP: 1.5,
      };

      const result = sanitizeParameters(params);

      expect(result.topP).toBe(1);
    });

    it('should clamp penalties to -2 to 2 range', () => {
      const params = {
        frequencyPenalty: 5.0,
        presencePenalty: -5.0,
      };

      const result = sanitizeParameters(params);

      expect(result.frequencyPenalty).toBe(2);
      expect(result.presencePenalty).toBe(-2);
    });

    it('should keep zero values', () => {
      const params = {
        temperature: 0,
        maxTokens: 1, // Can't be 0 - minimum is 1
        topP: 0,
      };

      const result = sanitizeParameters(params);

      expect(result.temperature).toBe(0);
      expect(result.maxTokens).toBe(1);
      expect(result.topP).toBe(0);
    });

    it('should handle empty objects', () => {
      const result = sanitizeParameters({});
      expect(result).toEqual({});
    });
  });

  describe('areParametersValid', () => {
    it('should validate valid parameters', () => {
      const params: IRParameters = {
        temperature: 0.7,
        maxTokens: 100,
        topP: 0.9,
        topK: 40,
      };

      expect(areParametersValid(params)).toBe(true);
    });

    it('should reject invalid temperature', () => {
      const params: IRParameters = {
        temperature: 5.0,
      };

      expect(areParametersValid(params)).toBe(false);
    });

    it('should reject invalid maxTokens', () => {
      const params: IRParameters = {
        maxTokens: -100,
      };

      expect(areParametersValid(params)).toBe(false);
    });

    it('should reject invalid topP', () => {
      const params: IRParameters = {
        topP: 1.5,
      };

      expect(areParametersValid(params)).toBe(false);
    });

    it('should reject invalid penalty', () => {
      const params: IRParameters = {
        frequencyPenalty: 5.0,
      };

      expect(areParametersValid(params)).toBe(false);
    });

    it('should accept empty parameters', () => {
      expect(areParametersValid({})).toBe(true);
    });
  });

  describe('Integration: Full Parameter Pipeline', () => {
    it('should normalize, merge, and sanitize parameters', () => {
      // Start with base parameters
      const base: IRParameters = {
        temperature: 1.5,
        maxTokens: 100,
      };

      // Normalize temperature (already in IR 0-2 range, just pass through)
      const normalized: IRParameters = {
        ...base,
        temperature: normalizeTemperature(base.temperature, '0-2'),
      };

      // Merge with defaults
      const defaults: IRParameters = {
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9,
      };

      const merged = applyParameterDefaults(normalized, defaults);

      // Sanitize
      const final = sanitizeParameters(merged);

      expect(final.temperature).toBeLessThanOrEqual(2);
      expect(final.maxTokens).toBe(100);
      expect(final.topP).toBe(0.9);
      expect(areParametersValid(final)).toBe(true);
    });

    it('should handle provider-specific parameter conversion', () => {
      // OpenAI parameters (0-2 range is IR standard)
      const openaiParams: IRParameters = {
        temperature: 1.5,
        maxTokens: 100,
        topP: 0.9,
      };

      // Normalize to Anthropic's 0-1 range
      const normalized: IRParameters = {
        temperature: normalizeTemperature(openaiParams.temperature, '0-1'),
        maxTokens: openaiParams.maxTokens,
        topP: normalizeTopP(openaiParams.topP),
      };

      // Convert back to IR 0-2 range
      const backToIR: IRParameters = {
        temperature: denormalizeTemperature(normalized.temperature, '0-1'),
        maxTokens: normalized.maxTokens,
        topP: normalized.topP,
      };

      expect(backToIR.temperature).toBeLessThanOrEqual(2);
      expect(backToIR.temperature).toBeGreaterThanOrEqual(0);
      expect(areParametersValid(backToIR)).toBe(true);
    });
  });
});
