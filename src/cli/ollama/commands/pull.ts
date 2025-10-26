/**
 * Pull Command - Download GGUF models from Ollama registry
 *
 * Downloads .gguf model files from the Ollama registry API.
 *
 * @module cli/ollama/commands/pull
 */

import { mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createWriteStream, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { success, error, info, warn } from '../../utils/output-formatter.js';

/**
 * Ollama registry base URL.
 */
const OLLAMA_REGISTRY = 'https://registry.ollama.ai/v2/library';

/**
 * Options for pull command.
 */
export interface PullCommandOptions {
  model: string;
  output?: string;
  verbose?: boolean;
  insecure?: boolean;
}

/**
 * Parse model specification into name and tag.
 * Format: model:tag or model (defaults to 'latest')
 */
function parseModel(modelSpec: string): { name: string; tag: string } {
  const parts = modelSpec.split(':');
  const name = parts[0] || 'llama3.1';
  const tag = parts[1] || 'latest';
  return { name, tag };
}

/**
 * Format bytes for human-readable display.
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Fetch manifest from Ollama registry.
 */
async function fetchManifest(name: string, tag: string, verbose: boolean): Promise<any> {
  const manifestUrl = `${OLLAMA_REGISTRY}/${name}/manifests/${tag}`;

  if (verbose) {
    info(`Fetching manifest: ${manifestUrl}`);
  }

  const response = await fetch(manifestUrl, {
    headers: {
      'Accept': 'application/vnd.docker.distribution.manifest.v2+json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Model not found: ${name}:${tag}\n\nAvailable models at https://ollama.com/library`);
    }
    throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
  }

  const manifest = await response.json();

  const data = manifest as any;

  if (verbose) {
    info(`Manifest retrieved: ${data.layers?.length || 0} layers`);
  }

  return data;
}

/**
 * Find GGUF layer in manifest.
 */
function findGGUFLayer(manifest: any): { digest: string; size: number; mediaType: string } | null {
  if (!manifest.layers || !Array.isArray(manifest.layers)) {
    return null;
  }

  // Look for layers with GGUF-related media types or the largest layer
  // Ollama typically uses application/vnd.ollama.image.model for the model file
  const modelLayer = manifest.layers.find((layer: any) =>
    layer.mediaType === 'application/vnd.ollama.image.model'
  );

  if (modelLayer) {
    return {
      digest: modelLayer.digest,
      size: modelLayer.size || 0,
      mediaType: modelLayer.mediaType,
    };
  }

  // Fallback: Use the largest layer (usually the model)
  const largestLayer = manifest.layers.reduce((largest: any, layer: any) => {
    return (layer.size || 0) > (largest?.size || 0) ? layer : largest;
  }, null);

  if (largestLayer) {
    return {
      digest: largestLayer.digest,
      size: largestLayer.size || 0,
      mediaType: largestLayer.mediaType,
    };
  }

  return null;
}

/**
 * Download blob from Ollama registry with progress.
 */
async function downloadBlob(
  name: string,
  digest: string,
  outputPath: string,
  size: number,
  verbose: boolean
): Promise<void> {
  const blobUrl = `${OLLAMA_REGISTRY}/${name}/blobs/${digest}`;

  if (verbose) {
    info(`Downloading from: ${blobUrl}`);
  }

  // Ensure output directory exists
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const response = await fetch(blobUrl);

  if (!response.ok) {
    throw new Error(`Failed to download blob: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  // Create progress tracker
  let downloaded = 0;
  let lastProgress = 0;
  const startTime = Date.now();

  const nodeStream = Readable.fromWeb(response.body as any);
  const fileStream = createWriteStream(outputPath);

  // Track progress
  nodeStream.on('data', (chunk: Buffer) => {
    downloaded += chunk.length;
    const progress = Math.floor((downloaded / size) * 100);

    // Update progress every 5%
    if (progress >= lastProgress + 5 || progress === 100) {
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = downloaded / elapsed;
      const remaining = size - downloaded;
      const eta = remaining / speed;

      process.stdout.write(
        `\r${formatBytes(downloaded)} / ${formatBytes(size)} (${progress}%) - ` +
        `${formatBytes(speed)}/s - ETA: ${Math.floor(eta)}s`
      );

      lastProgress = progress;
    }
  });

  await pipeline(nodeStream, fileStream);

  // Final newline after progress
  process.stdout.write('\n');
}

/**
 * Pull command - Download GGUF model from Ollama registry.
 */
export async function pullCommand(options: PullCommandOptions): Promise<void> {
  const { model: modelSpec, output, verbose = false } = options;

  try {
    // Parse model specification
    const { name, tag } = parseModel(modelSpec);

    info(`Pulling ${name}:${tag} from Ollama registry...`);

    // Step 1: Fetch manifest
    const manifest = await fetchManifest(name, tag, verbose);

    // Step 2: Find GGUF layer
    const layer = findGGUFLayer(manifest);

    if (!layer) {
      throw new Error('No model layer found in manifest. This may not be a GGUF model.');
    }

    if (verbose) {
      info(`Found model layer:`);
      info(`  Digest: ${layer.digest}`);
      info(`  Size: ${formatBytes(layer.size)}`);
      info(`  Media Type: ${layer.mediaType}`);
    }

    // Step 3: Determine output path
    const defaultOutput = resolve(process.cwd(), 'models', `${name}-${tag}.gguf`);
    const outputPath = output ? resolve(process.cwd(), output) : defaultOutput;

    // Check if file already exists
    if (existsSync(outputPath)) {
      warn(`File already exists: ${outputPath}`);
      const confirmOverwrite = process.env.FORCE_OVERWRITE === 'true';
      if (!confirmOverwrite) {
        error('Use FORCE_OVERWRITE=true to overwrite existing file');
        process.exit(1);
      }
    }

    info(`Downloading to: ${outputPath}`);
    info(`Size: ${formatBytes(layer.size)}`);

    // Step 4: Download blob
    await downloadBlob(name, layer.digest, outputPath, layer.size, verbose);

    success(`\n✓ Model downloaded successfully: ${outputPath}`);
    console.log('\nNext steps:');
    console.log(`  1. Use with node-llama-cpp backend:`);
    console.log(`     ai-matey create-backend --provider node-llamacpp`);
    console.log(`  2. Set modelPath in backend config to: ${outputPath}`);
    console.log(`  3. Run: ai-matey emulate-ollama --backend ./backend.mjs run ${name}`);

  } catch (err) {
    error(`Failed to pull model: ${err instanceof Error ? err.message : String(err)}`);
    if (verbose && err instanceof Error) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}
