/**
 * Create Backend Subcommand
 *
 * Interactive wizard to generate backend adapter templates for use with ai-matey.
 *
 * @module cli/create-backend
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { error, success, info, warn } from './utils/output-formatter.js';

// ============================================================================
// Backend Configurations
// ============================================================================

interface BackendPreset {
  name: string;
  description: string;
  adapterClass: string;
  importPath: string;
  requiresApiKey: boolean;
  defaultBaseURL?: string;
  defaultModel?: string;
  envVarPrefix?: string;
  isNative?: boolean;
  platformRequirements?: string;
  configOptions?: ConfigOption[];
}

interface ConfigOption {
  name: string;
  description: string;
  required: boolean;
  default?: string | number | boolean;
  envVar?: string;
}

const BACKEND_PRESETS: Record<string, BackendPreset> = {
  'openai': {
    name: 'OpenAI',
    description: 'OpenAI GPT models (GPT-4, GPT-3.5, etc.)',
    adapterClass: 'OpenAIBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
    envVarPrefix: 'OPENAI',
    configOptions: [
      { name: 'organization', description: 'OpenAI Organization ID', required: false, envVar: 'OPENAI_ORG' },
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 60000 },
    ],
  },
  'anthropic': {
    name: 'Anthropic',
    description: 'Anthropic Claude models',
    adapterClass: 'AnthropicBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    envVarPrefix: 'ANTHROPIC',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 60000 },
      { name: 'maxRetries', description: 'Max retry attempts', required: false, default: 3 },
    ],
  },
  'gemini': {
    name: 'Google Gemini',
    description: 'Google Gemini models',
    adapterClass: 'GeminiBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: true,
    defaultBaseURL: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash-exp',
    envVarPrefix: 'GEMINI',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 60000 },
    ],
  },
  'ollama': {
    name: 'Ollama',
    description: 'Local Ollama instance',
    adapterClass: 'OllamaBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: false,
    defaultBaseURL: 'http://localhost:11434',
    defaultModel: 'llama3.1',
    envVarPrefix: 'OLLAMA',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 120000 },
    ],
  },
  'mistral': {
    name: 'Mistral AI',
    description: 'Mistral AI models',
    adapterClass: 'MistralBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    envVarPrefix: 'MISTRAL',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 60000 },
    ],
  },
  'deepseek': {
    name: 'DeepSeek',
    description: 'DeepSeek models',
    adapterClass: 'DeepSeekBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    envVarPrefix: 'DEEPSEEK',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 60000 },
    ],
  },
  'groq': {
    name: 'Groq',
    description: 'Groq fast inference',
    adapterClass: 'GroqBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: true,
    defaultBaseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    envVarPrefix: 'GROQ',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 60000 },
    ],
  },
  'huggingface': {
    name: 'Hugging Face',
    description: 'Hugging Face Inference API',
    adapterClass: 'HuggingFaceBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: true,
    defaultModel: 'meta-llama/Meta-Llama-3-8B-Instruct',
    envVarPrefix: 'HUGGINGFACE',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 60000 },
    ],
  },
  'lmstudio': {
    name: 'LM Studio',
    description: 'Local LM Studio instance',
    adapterClass: 'LMStudioBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: false,
    defaultBaseURL: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
    envVarPrefix: 'LMSTUDIO',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 120000 },
    ],
  },
  'nvidia': {
    name: 'NVIDIA NIM',
    description: 'NVIDIA NIM inference',
    adapterClass: 'NVIDIABackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: true,
    defaultBaseURL: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.1-8b-instruct',
    envVarPrefix: 'NVIDIA',
    configOptions: [
      { name: 'timeout', description: 'Request timeout (ms)', required: false, default: 60000 },
    ],
  },
  'chrome-ai': {
    name: 'Chrome AI',
    description: 'Chrome built-in AI (browser only)',
    adapterClass: 'ChromeAIBackendAdapter',
    importPath: 'ai.matey/adapters/backend',
    requiresApiKey: false,
    envVarPrefix: 'CHROME_AI',
    platformRequirements: 'Chrome browser with built-in AI enabled',
    configOptions: [
      { name: 'temperature', description: 'Sampling temperature (0-1)', required: false, default: 0.7 },
      { name: 'topK', description: 'Top-K sampling', required: false, default: 40 },
    ],
  },
  'node-llamacpp': {
    name: 'Node LlamaCpp',
    description: 'Local models via node-llama-cpp (GGUF files)',
    adapterClass: 'NodeLlamaCppBackend',
    importPath: 'ai.matey/adapters/backend-native',
    requiresApiKey: false,
    isNative: true,
    platformRequirements: 'Node.js, node-llama-cpp installed',
    configOptions: [
      { name: 'modelPath', description: 'Path to GGUF model file', required: true },
      { name: 'contextSize', description: 'Context window size', required: false, default: 2048 },
      { name: 'gpuLayers', description: 'Number of GPU layers', required: false, default: 0 },
      { name: 'temperature', description: 'Sampling temperature', required: false, default: 0.7 },
    ],
  },
  'apple': {
    name: 'Apple Foundation Models',
    description: 'Apple on-device AI (macOS 15+ Sequoia)',
    adapterClass: 'AppleBackend',
    importPath: 'ai.matey/adapters/backend-native',
    requiresApiKey: false,
    isNative: true,
    platformRequirements: 'macOS 15+ (Sequoia), Apple Intelligence enabled',
    configOptions: [
      { name: 'instructions', description: 'System instructions', required: false },
      { name: 'maximumResponseTokens', description: 'Max tokens to generate', required: false, default: 2048 },
      { name: 'temperature', description: 'Sampling temperature', required: false, default: 0.7 },
      { name: 'samplingMode', description: 'Sampling mode (default/random)', required: false, default: 'default' },
    ],
  },
};

// ============================================================================
// Template Generation
// ============================================================================

function generateBackendFile(
  preset: BackendPreset,
  config: Record<string, string | number | boolean>,
  outputPath?: string
): string {
  const envVarPrefix = preset.envVarPrefix || preset.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  const apiKeyEnvVar = `${envVarPrefix}_API_KEY`;

  let imports = `import { ${preset.adapterClass} } from '${preset.importPath}';`;

  let envVarDeclarations: string[] = [];
  let configObject: string[] = [];
  let envVarChecks: string[] = [];

  // API key
  if (preset.requiresApiKey) {
    envVarDeclarations.push(`const apiKey = process.env.${apiKeyEnvVar};`);
    envVarChecks.push(`if (!apiKey) {
  throw new Error('${preset.name} API key required. Set ${apiKeyEnvVar} environment variable.');
}`);
    configObject.push('  apiKey');
  }

  // Base URL
  if (preset.defaultBaseURL && config.baseURL) {
    envVarDeclarations.push(`const baseURL = process.env.${envVarPrefix}_BASE_URL || '${config.baseURL}';`);
    configObject.push('  baseURL');
  }

  // Default model
  if (preset.defaultModel && config.defaultModel) {
    configObject.push(`  defaultModel: '${config.defaultModel}'`);
  }

  // Additional config options
  for (const option of preset.configOptions || []) {
    const value = config[option.name];
    if (value !== undefined && value !== '') {
      if (option.envVar) {
        envVarDeclarations.push(`const ${option.name} = process.env.${option.envVar} || ${JSON.stringify(value)};`);
        configObject.push(`  ${option.name}`);
      } else {
        configObject.push(`  ${option.name}: ${JSON.stringify(value)}`);
      }
    } else if (option.default !== undefined && !config[option.name]) {
      // Include defaults even if not in config
      if (option.envVar) {
        envVarDeclarations.push(`const ${option.name} = process.env.${option.envVar} || ${JSON.stringify(option.default)};`);
        configObject.push(`  ${option.name}`);
      } else {
        configObject.push(`  ${option.name}: ${JSON.stringify(option.default)}`);
      }
    }
  }

  // Add usage examples
  const usageExamples = preset.defaultModel
    ? `\n * Usage:\n *   ai-matey emulate-ollama --backend ${outputPath || './backend.mjs'} run ${preset.defaultModel}\n *   ai-matey proxy --backend ${outputPath || './backend.mjs'} --port 3000`
    : `\n * Usage:\n *   ai-matey emulate-ollama --backend ${outputPath || './backend.mjs'} run default\n *   ai-matey proxy --backend ${outputPath || './backend.mjs'} --port 3000\n *\n * Note: Model name is metadata only (uses system default)`;

  const header = `/**
 * ${preset.name} Backend Adapter
 *
 * ${preset.description}
 *${preset.platformRequirements ? `\n * Platform Requirements: ${preset.platformRequirements}\n *` : ''}
 * Environment Variables:
${preset.requiresApiKey ? ` *   ${apiKeyEnvVar} - API key (required)\n` : ''}${preset.defaultBaseURL ? ` *   ${envVarPrefix}_BASE_URL - API base URL (optional)\n` : ''}${(preset.configOptions || []).filter(opt => opt.envVar).map(opt => ` *   ${opt.envVar} - ${opt.description} (optional)`).join('\n')}${usageExamples}
 */
`;

  // Build config object content - only add items if we have any
  const configContent = configObject.length > 0
    ? `\n${configObject.join(',\n')}\n`
    : '';

  return `${header}
${imports}

${envVarDeclarations.join('\n')}

${envVarChecks.join('\n\n')}

export default new ${preset.adapterClass}({${configContent}});
`;
}

// ============================================================================
// Interactive Wizard
// ============================================================================

async function prompt(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (default: ${defaultValue})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || '';
}

async function confirm(rl: readline.Interface, question: string, defaultValue: boolean = true): Promise<boolean> {
  const suffix = defaultValue ? ' (Y/n)' : ' (y/N)';
  const answer = await rl.question(`${question}${suffix}: `);
  const normalized = answer.trim().toLowerCase();

  if (normalized === '') return defaultValue;
  return normalized === 'y' || normalized === 'yes';
}

async function select(rl: readline.Interface, question: string, options: string[]): Promise<string> {
  console.log(`\n${question}`);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt}`);
  });

  while (true) {
    const answer = await rl.question('\nSelect option (number): ');
    const num = parseInt(answer.trim(), 10);

    if (num >= 1 && num <= options.length) {
      return options[num - 1] || '';
    }

    warn(`Invalid selection. Please choose 1-${options.length}`);
  }
}

async function runWizard(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║       AI.Matey Backend Generator Wizard                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // 1. Select backend type
    const backendOptions = Object.entries(BACKEND_PRESETS).map(([_key, preset]) => {
      const native = preset.isNative ? ' [NATIVE]' : '';
      return `${preset.name}${native} - ${preset.description}`;
    });
    const backendKeys = Object.keys(BACKEND_PRESETS);

    const selectedOption = await select(rl, 'Select backend type:', backendOptions);
    const selectedIndex = backendOptions.indexOf(selectedOption);
    const backendKey = backendKeys[selectedIndex] || 'openai';
    const preset = BACKEND_PRESETS[backendKey]!;

    console.log();
    info(`Selected: ${preset.name}`);
    if (preset.platformRequirements) {
      warn(`Requirements: ${preset.platformRequirements}`);
    }
    console.log();

    // 2. Output path
    const outputPath = await prompt(rl, 'Output file path', './backend.mjs');

    // 3. Collect configuration
    const config: Record<string, string | number | boolean> = {};

    // Base URL
    if (preset.defaultBaseURL) {
      const useDefaultBaseURL = await confirm(rl, `Use default base URL (${preset.defaultBaseURL})?`, true);
      if (useDefaultBaseURL) {
        config.baseURL = preset.defaultBaseURL;
      } else {
        config.baseURL = await prompt(rl, 'Custom base URL');
      }
    }

    // Default model
    if (preset.defaultModel) {
      config.defaultModel = await prompt(rl, 'Default model', preset.defaultModel);
    }

    // Additional options
    if (preset.configOptions && preset.configOptions.length > 0) {
      console.log();
      const configureAdvanced = await confirm(rl, 'Configure advanced options?', false);

      if (configureAdvanced) {
        for (const option of preset.configOptions) {
          let value: string | number | boolean;

          if (option.required) {
            value = await prompt(rl, option.description);
          } else {
            const useDefault = option.default !== undefined
              ? await confirm(rl, `${option.description} (use default: ${option.default})?`, true)
              : false;

            if (useDefault) {
              value = option.default!;
            } else {
              const input = await prompt(rl, option.description);

              // Type conversion
              if (typeof option.default === 'number') {
                value = parseInt(input, 10) || option.default!;
              } else if (typeof option.default === 'boolean') {
                value = input.toLowerCase() === 'true';
              } else {
                value = input;
              }
            }
          }

          if (value !== undefined && value !== '') {
            config[option.name] = value;
          }
        }
      }
    }

    // 4. Generate and write file
    console.log();
    info('Generating backend file...');

    const content = generateBackendFile(preset, config, outputPath);
    const resolvedPath = resolve(process.cwd(), outputPath);
    await writeFile(resolvedPath, content, 'utf-8');

    console.log();
    success(`✓ Backend created: ${resolvedPath}`);

    console.log('\n┌─ Next Steps ────────────────────────────────────────────┐');
    if (preset.requiresApiKey) {
      console.log(`│ 1. Set ${preset.envVarPrefix}_API_KEY environment variable │`);
      console.log(`│ 2. Use with: ai-matey proxy --backend ${outputPath}    │`);
    } else {
      console.log(`│ 1. Review configuration in ${outputPath}               │`);
      console.log(`│ 2. Use with: ai-matey proxy --backend ${outputPath}    │`);
    }
    console.log('└─────────────────────────────────────────────────────────┘\n');

  } finally {
    rl.close();
  }
}

// ============================================================================
// CLI Interface
// ============================================================================

export interface CreateBackendOptions {
  interactive?: boolean;
  provider?: string;
  output?: string;
  name?: string;
  baseUrl?: string;
  help?: boolean;
}

/**
 * Show help message.
 */
function showHelp(): void {
  console.log(`
Create Backend Subcommand

Interactive wizard to generate backend adapter templates for use with ai-matey.

Usage:
  ai-matey create-backend [options]
  ai-matey create-backend              # Run interactive wizard (default)

Options:
  --interactive, -i     Run interactive wizard (default)
  --provider <type>     Skip wizard, use specific provider
  --output <path>       Output file path (default: ./backend.mjs)
  --base-url <url>      Custom base URL
  --help, -h            Show this help

Available Providers:
  ${Object.entries(BACKEND_PRESETS).map(([key, p]) => `${key.padEnd(20)} ${p.description}`).join('\n  ')}

Examples:
  # Run interactive wizard
  ai-matey create-backend

  # Quick generate for specific provider
  ai-matey create-backend --provider openai --output ./openai-backend.mjs

  # Use the generated backend
  ai-matey proxy --backend ./backend.mjs --port 3000
`);
}

/**
 * Main CLI entry point.
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  // Parse arguments
  const options: CreateBackendOptions = {
    interactive: true, // Default to interactive
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--interactive':
      case '-i':
        options.interactive = true;
        break;
      case '--provider':
        options.provider = argv[++i];
        options.interactive = false; // Disable interactive if provider specified
        break;
      case '--output':
        options.output = argv[++i];
        break;
      case '--name':
        options.name = argv[++i];
        break;
      case '--base-url':
        options.baseUrl = argv[++i];
        break;
      default:
        error(`Unknown option: ${arg}`);
        console.log('Run with --help for usage information');
        process.exit(1);
    }
  }

  // Handle help
  if (options.help) {
    showHelp();
    return;
  }

  // Run interactive wizard if no provider specified
  if (options.interactive && !options.provider) {
    await runWizard();
    return;
  }

  // Non-interactive mode (legacy support)
  const provider = options.provider || 'openai';
  const outputPath = options.output || './backend.mjs';

  if (!BACKEND_PRESETS[provider]) {
    error(`Unknown provider: ${provider}`);
    console.log(`\nAvailable providers: ${Object.keys(BACKEND_PRESETS).join(', ')}`);
    process.exit(1);
  }

  try {
    const preset = BACKEND_PRESETS[provider]!;
    const config: Record<string, string | number | boolean> = {
      baseURL: options.baseUrl || preset.defaultBaseURL || '',
      defaultModel: preset.defaultModel || '',
    };

    info(`Generating ${preset.name} backend...`);
    const content = generateBackendFile(preset, config, outputPath);
    const resolvedPath = resolve(process.cwd(), outputPath);
    await writeFile(resolvedPath, content, 'utf-8');

    success(`\n✓ Backend created: ${resolvedPath}`);
    console.log('\nNext steps:');
    if (preset.requiresApiKey) {
      console.log(`  1. Set ${preset.envVarPrefix}_API_KEY environment variable`);
    }
    console.log(`  2. Use with: ai-matey proxy --backend ${outputPath} --port 3000`);

  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
