/**
 * Model Translation Utility
 *
 * Translates model names between different providers.
 * Supports backend.modelMapping property or external mapping files.
 *
 * @module cli/utils/model-translation
 */

import type { BackendAdapter } from '../../types/adapters.js';

export type ModelMapping = Record<string, string>;

export interface ModelTranslationOptions {
  /**
   * Backend adapter (may have modelMapping property).
   */
  backend: BackendAdapter;

  /**
   * External model mapping (overrides backend.modelMapping).
   */
  mapping?: ModelMapping;

  /**
   * Fallback to backend's default model if no mapping found.
   */
  useBackendDefault?: boolean;
}

/**
 * Translate a model name using mapping or backend default.
 *
 * @param modelName - Original model name
 * @param options - Translation options
 * @returns Translated model name or original if no mapping
 *
 * @example
 * ```typescript
 * const backend = new OpenAIBackend({ defaultModel: 'gpt-4o' });
 * backend.modelMapping = { 'llama3.1': 'gpt-4o' };
 *
 * const translated = translateModel('llama3.1', { backend });
 * // → 'gpt-4o'
 * ```
 */
export function translateModel(
  modelName: string,
  options: ModelTranslationOptions
): string {
  const { backend, mapping, useBackendDefault = true } = options;

  // Check external mapping first
  if (mapping && mapping[modelName]) {
    return mapping[modelName];
  }

  // Check backend.modelMapping
  const backendMapping = (backend as any).modelMapping as ModelMapping | undefined;
  if (backendMapping && backendMapping[modelName]) {
    return backendMapping[modelName];
  }

  // Try backend default model
  if (useBackendDefault) {
    const defaultModel = (backend as any).config?.defaultModel;
    if (defaultModel) {
      return defaultModel;
    }
  }

  // No translation - return original
  return modelName;
}

/**
 * Load model mapping from JSON file.
 *
 * @param path - Path to JSON file
 * @returns Model mapping
 */
export async function loadModelMapping(path: string): Promise<ModelMapping> {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');

  try {
    const resolvedPath = resolve(process.cwd(), path);
    const content = await readFile(resolvedPath, 'utf-8');
    const mapping = JSON.parse(content);

    if (typeof mapping !== 'object' || mapping === null) {
      throw new Error('Model mapping must be a JSON object');
    }

    return mapping as ModelMapping;
  } catch (error) {
    throw new Error(
      `Failed to load model mapping from ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get reverse mapping (backend model → original model name).
 *
 * @param mapping - Forward mapping
 * @returns Reverse mapping
 */
export function reverseMapping(mapping: ModelMapping): ModelMapping {
  const reversed: ModelMapping = {};
  for (const [key, value] of Object.entries(mapping)) {
    reversed[value] = key;
  }
  return reversed;
}

/**
 * Check if model name needs translation.
 *
 * @param modelName - Model name to check
 * @param options - Translation options
 * @returns True if translation is available
 */
export function hasTranslation(
  modelName: string,
  options: Omit<ModelTranslationOptions, 'useBackendDefault'>
): boolean {
  const { backend, mapping } = options;

  if (mapping && mapping[modelName]) {
    return true;
  }

  const backendMapping = (backend as any).modelMapping as ModelMapping | undefined;
  if (backendMapping && backendMapping[modelName]) {
    return true;
  }

  return false;
}
