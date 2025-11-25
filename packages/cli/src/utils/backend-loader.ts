/**
 * Backend Loader Utility
 *
 * Dynamically loads backend modules from file paths.
 * Node.js only - uses dynamic import.
 *
 * @module cli/utils/backend-loader
 */

import { resolve } from 'node:path';
import type { BackendAdapter } from 'ai.matey.types';

export interface BackendModule {
  default: BackendAdapter;
}

export interface LoadBackendOptions {
  /**
   * Path to backend module file.
   */
  path: string;

  /**
   * Current working directory for resolving relative paths.
   */
  cwd?: string;
}

/**
 * Load a backend from a module file.
 *
 * @param options - Load options
 * @returns Loaded backend adapter
 *
 * @example
 * ```typescript
 * const backend = await loadBackend({ path: './my-backend.mjs' });
 * const response = await backend.execute(request);
 * ```
 */
export async function loadBackend(options: LoadBackendOptions): Promise<BackendAdapter> {
  const { path, cwd = process.cwd() } = options;

  try {
    // Resolve path
    const resolvedPath = path.startsWith('/')
      ? path
      : resolve(cwd, path);

    // Convert to file URL for import
    const fileUrl = `file://${resolvedPath}`;

    // Dynamic import
    const module = (await import(fileUrl)) as BackendModule;

    if (!module.default) {
      throw new Error(
        `Backend module ${path} does not have a default export`
      );
    }

    const backend = module.default;

    // Validate backend
    if (typeof backend.execute !== 'function') {
      throw new Error(
        `Backend module ${path} does not implement BackendAdapter interface (missing execute method)`
      );
    }

    return backend;
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw with better error message
      throw new Error(
        `Failed to load backend from ${path}: ${error.message}`,
        { cause: error }
      );
    }
    throw error;
  }
}

/**
 * Check if a backend is a model runner (has lifecycle methods).
 *
 * @param backend - Backend to check
 * @returns True if backend is a model runner
 */
export function isModelRunner(backend: BackendAdapter): boolean {
  return (
    typeof (backend as any).start === 'function' &&
    typeof (backend as any).stop === 'function' &&
    typeof (backend as any).getStats === 'function'
  );
}

/**
 * Get backend capabilities.
 *
 * @param backend - Backend to inspect
 * @returns Capability flags
 */
export function getBackendCapabilities(backend: BackendAdapter) {
  return {
    hasLifecycle: isModelRunner(backend),
    hasModelList: typeof (backend as any).listModels === 'function',
    hasStats: typeof (backend as any).getStats === 'function',
    metadata: backend.metadata,
  };
}
