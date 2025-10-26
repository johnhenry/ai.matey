/**
 * Ollama `list` Command
 *
 * List available models.
 *
 * @module cli/ollama/commands/list
 */

import type { BackendAdapter } from '../../../types/adapters.js';
import type { ModelMapping } from '../../utils/model-translation.js';
import {
  formatTable,
  formatRelativeTime,
  colorize,
} from '../../utils/output-formatter.js';

export interface ListCommandOptions {
  /**
   * Backend adapter to use.
   */
  backend: BackendAdapter;

  /**
   * Model mapping (for showing translated names).
   */
  modelMapping?: ModelMapping;

  /**
   * Output as JSON.
   */
  json?: boolean;

  /**
   * Verbose output.
   */
  verbose?: boolean;
}

/**
 * Execute the list command.
 */
export async function listCommand(options: ListCommandOptions): Promise<void> {
  const { backend, modelMapping, json = false, verbose = false } = options;

  try {
    // Check if backend supports listModels
    const listModels = (backend as any).listModels;
    if (typeof listModels !== 'function') {
      console.error(
        colorize(
          `Backend ${backend.metadata.name} does not support listing models`,
          'yellow'
        )
      );
      console.log('\nThis backend may require manual model configuration.');
      return;
    }

    // Fetch models
    const result = await listModels.call(backend);

    if (!result || !result.models || result.models.length === 0) {
      console.log(colorize('No models available', 'gray'));
      return;
    }

    const models = result.models;

    if (json) {
      console.log(JSON.stringify(models, null, 2));
      return;
    }

    // Format as table
    const rows = models.map((model: any) => {
      const name = model.name || model.id;
      const translatedName = modelMapping
        ? Object.entries(modelMapping).find(([_, v]) => v === name)?.[0]
        : undefined;

      return {
        name: translatedName
          ? `${translatedName} ${colorize(`(${name})`, 'gray')}`
          : name,
        id: model.id?.slice(0, 12) || 'N/A',
        size: model.contextWindow
          ? `${(model.contextWindow / 1000).toFixed(0)}K ctx`
          : 'N/A',
        modified: model.created ? formatRelativeTime(new Date(model.created).getTime()) : 'N/A',
      };
    });

    console.log();
    const table = formatTable({
      columns: [
        { key: 'name', header: 'NAME' },
        { key: 'id', header: 'ID' },
        { key: 'size', header: 'CONTEXT' },
        { key: 'modified', header: 'MODIFIED' },
      ],
      rows,
    });
    console.log(table);
    console.log();

    if (verbose) {
      console.log(colorize(`Total models: ${models.length}`, 'gray'));
    }
  } catch (error) {
    console.error(
      colorize(
        `Error listing models: ${error instanceof Error ? error.message : String(error)}`,
        'red'
      )
    );
    process.exit(1);
  }
}
