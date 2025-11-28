/**
 * AI Matey Backend Adapters
 *
 * Consolidated package containing all backend provider adapters.
 * Each provider adapter handles converting Universal IR to provider-specific
 * API calls and responses.
 *
 * @module ai.matey.backend
 */

// Shared utilities
export * from './shared.js';

// Provider adapters
export * from './providers/openai.js';
export * from './providers/anthropic.js';
export * from './providers/gemini.js';
export * from './providers/mistral.js';
export * from './providers/cohere.js';
export * from './providers/groq.js';
export * from './providers/ollama.js';
export * from './providers/ai21.js';
export * from './providers/anyscale.js';
export * from './providers/aws-bedrock.js';
export * from './providers/azure-openai.js';
export * from './providers/cerebras.js';
export * from './providers/chrome-ai.js';
export * from './providers/cloudflare.js';
export * from './providers/deepinfra.js';
export * from './providers/deepseek.js';
export * from './providers/fireworks.js';
export * from './providers/function.js';
export * from './providers/huggingface.js';
export * from './providers/lmstudio.js';
export * from './providers/mock.js';
export * from './providers/nvidia.js';
export * from './providers/openrouter.js';
export * from './providers/perplexity.js';
export * from './providers/replicate.js';
export * from './providers/together-ai.js';
export * from './providers/xai.js';
