/**
 * Core Model Translation
 *
 * Backend-agnostic model translation utilities for converting model names
 * between different AI providers. Works in any environment (Node.js, Browser, Deno, etc.).
 *
 * @module core/model-translation
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Model name mapping (source model → target model).
 */
export type ModelMapping = Record<string, string>;

/**
 * Translation strategy for Router fallback.
 */
export type ModelTranslationStrategy =
  | 'exact' // Only exact matches in modelMapping
  | 'pattern' // Exact + regex pattern matching
  | 'hybrid' // Exact + pattern + backend default
  | 'none'; // No translation (passthrough)

/**
 * Configuration for model translation behavior.
 */
export interface ModelTranslationConfig {
  /**
   * Translation strategy to use.
   * @default 'hybrid'
   */
  readonly strategy: ModelTranslationStrategy;

  /**
   * Emit warning event when using backend default model.
   * @default true
   */
  readonly warnOnDefault?: boolean;

  /**
   * Throw error if no translation found (instead of returning original).
   * @default false
   */
  readonly strictMode?: boolean;
}

/**
 * Options for translateModel function.
 */
export interface ModelTranslationOptions {
  /**
   * Exact model mappings.
   */
  readonly mapping?: ModelMapping;

  /**
   * Backend default model (used in hybrid strategy).
   */
  readonly defaultModel?: string;

  /**
   * Translation strategy.
   * @default 'exact'
   */
  readonly strategy?: ModelTranslationStrategy;

  /**
   * Throw error if no translation found.
   * @default false
   */
  readonly strictMode?: boolean;
}

/**
 * Result of model translation.
 */
export interface TranslationResult {
  /**
   * Translated model name.
   */
  readonly translated: string;

  /**
   * Source of translation.
   */
  readonly source: 'exact' | 'pattern' | 'default' | 'none';

  /**
   * Whether a translation was applied.
   */
  readonly wasTranslated: boolean;
}

// ============================================================================
// Core Translation Functions
// ============================================================================

/**
 * Translate a model name using exact mapping.
 *
 * @param modelName - Original model name
 * @param options - Translation options
 * @returns Translation result
 *
 * @example
 * ```typescript
 * const result = translateModel('gpt-4', {
 *   mapping: { 'gpt-4': 'claude-3-5-sonnet-20241022' }
 * });
 * // → { translated: 'claude-3-5-sonnet-20241022', source: 'exact', wasTranslated: true }
 * ```
 */
export function translateModel(
  modelName: string,
  options: ModelTranslationOptions = {}
): TranslationResult {
  const { mapping, defaultModel, strategy = 'exact', strictMode = false } = options;

  // 1. Try exact match (all strategies except 'none')
  if (strategy !== 'none' && mapping?.[modelName]) {
    return {
      translated: mapping[modelName],
      source: 'exact',
      wasTranslated: true,
    };
  }

  // 2. Try backend default (only for hybrid strategy)
  if (strategy === 'hybrid' && defaultModel) {
    return {
      translated: defaultModel,
      source: 'default',
      wasTranslated: true,
    };
  }

  // 3. No translation found
  if (strictMode) {
    throw new Error(`No translation found for model: ${modelName}`);
  }

  return {
    translated: modelName,
    source: 'none',
    wasTranslated: false,
  };
}

/**
 * Create a model translator with pre-configured options.
 *
 * @param options - Default translation options
 * @returns Translator function
 *
 * @example
 * ```typescript
 * const translator = createModelTranslator({
 *   mapping: { 'gpt-4': 'claude-3-5-sonnet-20241022' },
 *   strategy: 'hybrid',
 *   defaultModel: 'claude-3-5-haiku-20241022'
 * });
 *
 * const result = translator('gpt-4');
 * // → { translated: 'claude-3-5-sonnet-20241022', source: 'exact', wasTranslated: true }
 * ```
 */
export function createModelTranslator(
  defaultOptions: ModelTranslationOptions
): (modelName: string, overrides?: Partial<ModelTranslationOptions>) => TranslationResult {
  return (modelName: string, overrides?: Partial<ModelTranslationOptions>): TranslationResult => {
    return translateModel(modelName, { ...defaultOptions, ...overrides });
  };
}

/**
 * Get reverse mapping (target model → source model).
 *
 * @param mapping - Forward mapping
 * @returns Reverse mapping
 *
 * @example
 * ```typescript
 * const forward = { 'gpt-4': 'claude-3-5-sonnet' };
 * const reverse = reverseMapping(forward);
 * // → { 'claude-3-5-sonnet': 'gpt-4' }
 * ```
 */
export function reverseMapping(mapping: ModelMapping): ModelMapping {
  const reversed: ModelMapping = {};
  for (const [key, value] of Object.entries(mapping)) {
    reversed[value] = key;
  }
  return reversed;
}

/**
 * Check if a model name has an exact translation.
 *
 * @param modelName - Model name to check
 * @param mapping - Model mapping
 * @returns True if exact translation exists
 *
 * @example
 * ```typescript
 * const mapping = { 'gpt-4': 'claude-3-5-sonnet' };
 * hasTranslation('gpt-4', mapping); // → true
 * hasTranslation('gpt-3.5', mapping); // → false
 * ```
 */
export function hasTranslation(modelName: string, mapping: ModelMapping): boolean {
  return modelName in mapping;
}

/**
 * Merge multiple model mappings into one.
 *
 * Later mappings take precedence over earlier ones.
 *
 * @param mappings - Array of mappings to merge
 * @returns Merged mapping
 *
 * @example
 * ```typescript
 * const mapping1 = { 'gpt-4': 'claude-3-opus' };
 * const mapping2 = { 'gpt-4': 'claude-3-5-sonnet' }; // Override
 * const merged = mergeMappings(mapping1, mapping2);
 * // → { 'gpt-4': 'claude-3-5-sonnet' }
 * ```
 */
export function mergeMappings(...mappings: ModelMapping[]): ModelMapping {
  return Object.assign({}, ...mappings);
}

/**
 * Validate that a model mapping is well-formed.
 *
 * @param mapping - Mapping to validate
 * @throws Error if mapping is invalid
 *
 * @example
 * ```typescript
 * validateMapping({ 'gpt-4': 'claude-3-5-sonnet' }); // OK
 * validateMapping({ 'gpt-4': '' }); // Throws: empty target model
 * ```
 */
export function validateMapping(mapping: ModelMapping): void {
  if (typeof mapping !== 'object' || mapping === null) {
    throw new Error('Model mapping must be an object');
  }

  for (const [source, target] of Object.entries(mapping)) {
    if (typeof source !== 'string' || source.length === 0) {
      throw new Error(`Invalid source model: ${source}`);
    }
    if (typeof target !== 'string' || target.length === 0) {
      throw new Error(`Invalid target model for "${source}": ${target}`);
    }
  }
}
