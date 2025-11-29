/**
 * Ollama `ps` Command
 *
 * List running models.
 *
 * @module cli/ollama/commands/ps
 */

import type { BackendAdapter } from 'ai.matey.types';
import { stateManager } from '../../utils/state-manager.js';
import { isModelRunner } from '../../utils/backend-loader.js';
import { formatTable, formatSize, formatDuration, colorize } from '../../utils/output-formatter.js';

export interface PsCommandOptions {
  /**
   * Backend adapter to use.
   */
  backend: BackendAdapter;

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
 * Execute the ps command.
 */
export async function psCommand(options: PsCommandOptions): Promise<void> {
  const { backend, json = false, verbose = false } = options;

  try {
    // Get running models from state manager
    const runningModels = stateManager.getAll();

    if (runningModels.length === 0) {
      if (json) {
        console.log('[]');
      } else {
        console.log(colorize('No models currently running', 'gray'));
      }
      return;
    }

    if (json) {
      console.log(JSON.stringify(runningModels, null, 2));
      return;
    }

    // Format as table
    const now = Date.now();
    const rows = runningModels.map((model) => {
      const ttlRemaining = model.ttl
        ? Math.max(0, model.ttl - (now - model.lastActivity))
        : undefined;

      return {
        name: model.name,
        id: model.pid?.toString().slice(0, 12) || 'N/A',
        size: model.size ? formatSize(model.size) : 'N/A',
        processor: isModelRunner(backend) ? 'GPU/CPU' : 'API',
        until: ttlRemaining ? `${formatDuration(ttlRemaining)} from now` : 'Running',
      };
    });

    console.log();
    const table = formatTable({
      columns: [
        { key: 'name', header: 'NAME' },
        { key: 'id', header: 'ID' },
        { key: 'size', header: 'SIZE' },
        { key: 'processor', header: 'PROCESSOR' },
        { key: 'until', header: 'UNTIL' },
      ],
      rows,
    });
    console.log(table);
    console.log();

    if (verbose) {
      console.log(colorize(`Total running: ${runningModels.length}`, 'gray'));

      // Show backend stats if available
      if (isModelRunner(backend)) {
        const runner = backend as any;
        const stats = runner.getStats();
        if (stats) {
          console.log(colorize(`Backend uptime: ${formatDuration(stats.uptime || 0)}`, 'gray'));
          console.log(colorize(`Request count: ${stats.requestCount || 0}`, 'gray'));
        }
      }
    }
  } catch (error) {
    console.error(
      colorize(
        `Error listing running models: ${error instanceof Error ? error.message : String(error)}`,
        'red'
      )
    );
    process.exit(1);
  }
}
