/**
 * Model Translation Types
 *
 * Type definitions for model name translation between AI providers.
 *
 * @module
 */

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
