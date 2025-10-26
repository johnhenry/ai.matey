/**
 * Unit Tests: Model Translation
 *
 * Tests for core model translation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  translateModel,
  createModelTranslator,
  reverseMapping,
  hasTranslation,
  mergeMappings,
  validateMapping,
  type ModelMapping,
  type ModelTranslationOptions,
} from '../../src/core/model-translation.js';

describe('Model Translation', () => {
  describe('translateModel', () => {
    it('should translate using exact match', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
        'gpt-3.5-turbo': 'claude-3-5-haiku-20241022',
      };

      const result = translateModel('gpt-4', { mapping });

      expect(result.translated).toBe('claude-3-5-sonnet-20241022');
      expect(result.source).toBe('exact');
      expect(result.wasTranslated).toBe(true);
    });

    it('should return original model when no match found', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      const result = translateModel('unknown-model', { mapping });

      expect(result.translated).toBe('unknown-model');
      expect(result.source).toBe('none');
      expect(result.wasTranslated).toBe(false);
    });

    it('should use backend default in hybrid strategy', () => {
      const mapping: ModelMapping = {};

      const result = translateModel('unknown-model', {
        mapping,
        defaultModel: 'claude-3-5-haiku-20241022',
        strategy: 'hybrid',
      });

      expect(result.translated).toBe('claude-3-5-haiku-20241022');
      expect(result.source).toBe('default');
      expect(result.wasTranslated).toBe(true);
    });

    it('should throw error in strict mode when no translation found', () => {
      const mapping: ModelMapping = {};

      expect(() => {
        translateModel('unknown-model', {
          mapping,
          strategy: 'exact',
          strictMode: true,
        });
      }).toThrow('No translation found for model: unknown-model');
    });

    it('should skip translation when strategy is none', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      const result = translateModel('gpt-4', {
        mapping,
        strategy: 'none',
      });

      expect(result.translated).toBe('gpt-4');
      expect(result.source).toBe('none');
      expect(result.wasTranslated).toBe(false);
    });

    it('should prefer exact match over default model', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      const result = translateModel('gpt-4', {
        mapping,
        defaultModel: 'claude-3-5-haiku-20241022',
        strategy: 'hybrid',
      });

      expect(result.translated).toBe('claude-3-5-sonnet-20241022');
      expect(result.source).toBe('exact');
      expect(result.wasTranslated).toBe(true);
    });
  });

  describe('createModelTranslator', () => {
    it('should create translator with default options', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      const translator = createModelTranslator({ mapping });
      const result = translator('gpt-4');

      expect(result.translated).toBe('claude-3-5-sonnet-20241022');
      expect(result.source).toBe('exact');
    });

    it('should allow overrides in translator', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      const translator = createModelTranslator({
        mapping,
        defaultModel: 'claude-3-5-haiku-20241022',
      });

      // Override strategy
      const result = translator('gpt-4', { strategy: 'none' });

      expect(result.translated).toBe('gpt-4');
      expect(result.source).toBe('none');
    });
  });

  describe('reverseMapping', () => {
    it('should reverse model mapping', () => {
      const forward: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
        'gpt-3.5-turbo': 'claude-3-5-haiku-20241022',
      };

      const reverse = reverseMapping(forward);

      expect(reverse['claude-3-5-sonnet-20241022']).toBe('gpt-4');
      expect(reverse['claude-3-5-haiku-20241022']).toBe('gpt-3.5-turbo');
    });

    it('should handle empty mapping', () => {
      const reverse = reverseMapping({});
      expect(Object.keys(reverse)).toHaveLength(0);
    });

    it('should handle duplicate values (last wins)', () => {
      const forward: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
        'gpt-4-turbo': 'claude-3-5-sonnet-20241022', // Same value
      };

      const reverse = reverseMapping(forward);

      // Last entry wins
      expect(reverse['claude-3-5-sonnet-20241022']).toBe('gpt-4-turbo');
    });
  });

  describe('hasTranslation', () => {
    it('should return true when translation exists', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      expect(hasTranslation('gpt-4', mapping)).toBe(true);
    });

    it('should return false when no translation exists', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      expect(hasTranslation('unknown-model', mapping)).toBe(false);
    });

    it('should return false for empty mapping', () => {
      expect(hasTranslation('gpt-4', {})).toBe(false);
    });
  });

  describe('mergeMappings', () => {
    it('should merge multiple mappings', () => {
      const mapping1: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      const mapping2: ModelMapping = {
        'gpt-3.5-turbo': 'claude-3-5-haiku-20241022',
      };

      const merged = mergeMappings(mapping1, mapping2);

      expect(merged['gpt-4']).toBe('claude-3-5-sonnet-20241022');
      expect(merged['gpt-3.5-turbo']).toBe('claude-3-5-haiku-20241022');
    });

    it('should let later mappings override earlier ones', () => {
      const mapping1: ModelMapping = {
        'gpt-4': 'claude-3-opus-20240229',
      };

      const mapping2: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022', // Override
      };

      const merged = mergeMappings(mapping1, mapping2);

      expect(merged['gpt-4']).toBe('claude-3-5-sonnet-20241022');
    });

    it('should handle empty mappings', () => {
      const merged = mergeMappings({}, {});
      expect(Object.keys(merged)).toHaveLength(0);
    });

    it('should merge three or more mappings', () => {
      const mapping1: ModelMapping = { 'a': '1' };
      const mapping2: ModelMapping = { 'b': '2' };
      const mapping3: ModelMapping = { 'c': '3' };

      const merged = mergeMappings(mapping1, mapping2, mapping3);

      expect(merged['a']).toBe('1');
      expect(merged['b']).toBe('2');
      expect(merged['c']).toBe('3');
    });
  });

  describe('validateMapping', () => {
    it('should accept valid mapping', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
        'gpt-3.5-turbo': 'claude-3-5-haiku-20241022',
      };

      expect(() => validateMapping(mapping)).not.toThrow();
    });

    it('should reject null mapping', () => {
      expect(() => validateMapping(null as any)).toThrow(
        'Model mapping must be an object'
      );
    });

    it('should reject non-object mapping', () => {
      expect(() => validateMapping('not an object' as any)).toThrow(
        'Model mapping must be an object'
      );
    });

    it('should reject empty source model', () => {
      const mapping: ModelMapping = {
        '': 'claude-3-5-sonnet-20241022',
      };

      expect(() => validateMapping(mapping)).toThrow('Invalid source model:');
    });

    it('should reject empty target model', () => {
      const mapping: ModelMapping = {
        'gpt-4': '',
      };

      expect(() => validateMapping(mapping)).toThrow(
        'Invalid target model for "gpt-4":'
      );
    });

    it('should reject non-string target model', () => {
      const mapping = {
        'gpt-4': 123,
      } as any;

      expect(() => validateMapping(mapping)).toThrow(
        'Invalid target model for "gpt-4":'
      );
    });

    it('should accept empty mapping object', () => {
      expect(() => validateMapping({})).not.toThrow();
    });
  });

  describe('Translation Strategies', () => {
    it('should respect exact strategy', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      // With exact match
      const result1 = translateModel('gpt-4', { mapping, strategy: 'exact' });
      expect(result1.translated).toBe('claude-3-5-sonnet-20241022');

      // Without exact match (should not use default)
      const result2 = translateModel('unknown', {
        mapping,
        strategy: 'exact',
        defaultModel: 'claude-3-5-haiku-20241022',
      });
      expect(result2.translated).toBe('unknown');
      expect(result2.source).toBe('none');
    });

    it('should respect hybrid strategy', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      // Should fall back to default when no exact match
      const result = translateModel('unknown', {
        mapping,
        strategy: 'hybrid',
        defaultModel: 'claude-3-5-haiku-20241022',
      });

      expect(result.translated).toBe('claude-3-5-haiku-20241022');
      expect(result.source).toBe('default');
    });

    it('should respect none strategy', () => {
      const mapping: ModelMapping = {
        'gpt-4': 'claude-3-5-sonnet-20241022',
      };

      const result = translateModel('gpt-4', { mapping, strategy: 'none' });

      expect(result.translated).toBe('gpt-4');
      expect(result.source).toBe('none');
      expect(result.wasTranslated).toBe(false);
    });
  });
});
