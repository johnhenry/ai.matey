/**
 * Ollama `show` Command
 *
 * Show model information.
 *
 * @module cli/ollama/commands/show
 */

import type { BackendAdapter } from 'ai.matey.types';
import type { ModelMapping } from '../../utils/model-translation.js';
import { translateModel } from '../../utils/model-translation.js';
import { isModelRunner } from '../../utils/backend-loader.js';
import {
  colorize,
  style,
} from '../../utils/output-formatter.js';

export interface ShowCommandOptions {
  /**
   * Backend adapter to use.
   */
  backend: BackendAdapter;

  /**
   * Model name to show.
   */
  model: string;

  /**
   * Model mapping for translation.
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
 * Execute the show command.
 */
export async function showCommand(options: ShowCommandOptions): Promise<void> {
  const { backend, model, modelMapping, json = false } = options;

  try {
    // Translate model name
    const translatedModel = translateModel(model, {
      backend,
      mapping: modelMapping,
    });

    // Gather information
    const info: any = {
      name: model,
      translatedName: translatedModel !== model ? translatedModel : undefined,
      backend: backend.metadata.name,
      provider: backend.metadata.provider,
      version: backend.metadata.version,
      capabilities: backend.metadata.capabilities,
    };

    // Try to get model from listModels if available
    const listModels = (backend as any).listModels;
    if (typeof listModels === 'function') {
      try {
        const result = await listModels.call(backend);
        const foundModel = result?.models?.find(
          (m: any) => m.name === translatedModel || m.id === translatedModel
        );
        if (foundModel) {
          info.modelDetails = foundModel;
        }
      } catch {
        // Ignore listModels errors
      }
    }

    // Get model runner stats if available
    if (isModelRunner(backend)) {
      const runner = backend as any;
      const stats = runner.getStats();
      if (stats) {
        info.runtime = {
          isRunning: stats.isRunning,
          pid: stats.pid,
          uptime: stats.uptime,
          requestCount: stats.requestCount,
        };
      }

      // Get config if available
      const config = (runner as any).config;
      if (config) {
        info.config = {
          contextSize: config.runtime?.contextSize,
          gpuLayers: config.runtime?.gpuLayers,
          threads: config.runtime?.threads,
          batchSize: config.runtime?.batchSize,
        };
      }
    }

    if (json) {
      console.log(JSON.stringify(info, null, 2));
      return;
    }

    // Format output
    console.log();
    console.log(style('Model', 'bold'));
    console.log(`  name              ${model}`);
    if (info.translatedName) {
      console.log(`  backend model     ${colorize(info.translatedName, 'cyan')}`);
    }
    console.log(`  backend           ${info.backend}`);
    console.log(`  provider          ${info.provider}`);

    if (info.modelDetails) {
      console.log();
      console.log(style('Details', 'bold'));
      if (info.modelDetails.contextWindow) {
        console.log(`  context length    ${info.modelDetails.contextWindow}`);
      }
      if (info.modelDetails.description) {
        console.log(`  description       ${info.modelDetails.description}`);
      }
    }

    if (info.capabilities) {
      console.log();
      console.log(style('Capabilities', 'bold'));
      console.log(`  streaming         ${info.capabilities.streaming ? '✓' : '✗'}`);
      console.log(`  tools             ${info.capabilities.tools ? '✓' : '✗'}`);
      console.log(`  vision            ${info.capabilities.vision ? '✓' : '✗'}`);
    }

    if (info.config) {
      console.log();
      console.log(style('Configuration', 'bold'));
      if (info.config.contextSize) {
        console.log(`  context size      ${info.config.contextSize}`);
      }
      if (info.config.gpuLayers !== undefined) {
        console.log(`  gpu layers        ${info.config.gpuLayers}`);
      }
      if (info.config.threads) {
        console.log(`  threads           ${info.config.threads}`);
      }
      if (info.config.batchSize) {
        console.log(`  batch size        ${info.config.batchSize}`);
      }
    }

    if (info.runtime) {
      console.log();
      console.log(style('Runtime', 'bold'));
      console.log(`  status            ${info.runtime.isRunning ? colorize('Running', 'green') : colorize('Stopped', 'red')}`);
      if (info.runtime.pid) {
        console.log(`  pid               ${info.runtime.pid}`);
      }
      if (info.runtime.uptime) {
        console.log(`  uptime            ${(info.runtime.uptime / 1000).toFixed(1)}s`);
      }
      if (info.runtime.requestCount !== undefined) {
        console.log(`  requests          ${info.runtime.requestCount}`);
      }
    }

    console.log();
  } catch (error) {
    console.error(
      colorize(
        `Error showing model info: ${error instanceof Error ? error.message : String(error)}`,
        'red'
      )
    );
    process.exit(1);
  }
}
