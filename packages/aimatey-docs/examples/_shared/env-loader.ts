/**
 * Environment Variable Loader
 *
 * Provides utilities for loading API keys and configuration from environment variables.
 * All examples use this module to ensure consistent configuration handling.
 *
 * Priority:
 * 1. web.env.local.mjs (git-ignored local config)
 * 2. process.env (system environment variables)
 */

export interface APIKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  deepseek?: string;
  groq?: string;
  mistral?: string;
  huggingface?: string;
  nvidia?: string;
  ollama?: boolean;
  lmstudio?: boolean;
}

/**
 * Load API keys from web.env.local.mjs or environment variables
 */
export function loadAPIKeys(): APIKeys {
  // Try to load from web.env.local.mjs (relative to repo root)
  let webEnv: any = null;
  try {
    // Path relative to examples/_shared/ -> ../../../../web.env.local.mjs
    const webEnvModule = require('../../../../web.env.local.mjs');
    webEnv = webEnvModule.default || webEnvModule;
  } catch (error) {
    // File doesn't exist or failed to load, fall back to process.env
  }

  // Extract keys from web.env.local.mjs if available
  const apiKeys = webEnv?.api_keys || {};

  return {
    openai: apiKeys.openai || process.env.OPENAI_API_KEY,
    anthropic: apiKeys.anthropic || process.env.ANTHROPIC_API_KEY,
    gemini: apiKeys.gemini || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    deepseek: apiKeys.deepseek || process.env.DEEPSEEK_API_KEY,
    groq: apiKeys.groq || process.env.GROQ_API_KEY,
    mistral: apiKeys.mistral || process.env.MISTRAL_API_KEY,
    huggingface: apiKeys.huggingface || process.env.HUGGINGFACE_API_KEY,
    nvidia: apiKeys.nvidia || process.env.NVIDIA_API_KEY,
    ollama: apiKeys.ollama === true || apiKeys.ollama_enabled === true || process.env.OLLAMA_ENABLED === 'true',
    lmstudio: apiKeys.lmstudio === true || apiKeys.lmstudio_enabled === true || process.env.LMSTUDIO_ENABLED === 'true',
  };
}

/**
 * Check if a required API key is available
 */
export function requireAPIKey(keyName: keyof APIKeys): string {
  const keys = loadAPIKeys();
  const key = keys[keyName];

  if (!key) {
    throw new Error(
      `Missing required API key: ${keyName.toUpperCase()}_API_KEY\n` +
      `Please set it in web.env.local.mjs or your environment.`
    );
  }

  if (typeof key === 'boolean') {
    throw new Error(`${keyName} is a boolean flag, not an API key`);
  }

  return key;
}

/**
 * Get an API key with a fallback or throw if not available
 */
export function getAPIKey(keyName: keyof APIKeys, required = true): string | undefined {
  const keys = loadAPIKeys();
  const key = keys[keyName];

  if (!key && required) {
    console.warn(`⚠️  API key not found: ${keyName.toUpperCase()}_API_KEY`);
    if (required) {
      console.warn(`   Set it in your environment to use this example.`);
    }
  }

  return typeof key === 'string' ? key : undefined;
}

/**
 * Display available API keys (for debugging)
 */
export function displayAvailableKeys(): void {
  const keys = loadAPIKeys();
  console.log('\n📋 Available API Keys:');
  console.log('─'.repeat(40));

  Object.entries(keys).forEach(([name, value]) => {
    const status = value ? '✓' : '✗';
    const display = typeof value === 'string'
      ? `${value.slice(0, 8)}...`
      : value ? 'enabled' : 'not set';
    console.log(`${status} ${name.padEnd(15)} ${display}`);
  });

  console.log('─'.repeat(40) + '\n');
}
