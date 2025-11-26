#!/usr/bin/env node

/**
 * Generate comprehensive API documentation for all packages.
 *
 * This script reads package source files and generates detailed README.md
 * files with API documentation for each package.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.join(__dirname, '..', 'packages');

// ============================================================================
// Package Metadata
// ============================================================================

const packageInfo = {
  // Core packages
  'ai.matey': {
    category: 'core',
    title: 'ai.matey',
    description: 'Main umbrella package for the ai.matey monorepo',
    exports: ['VERSION'],
  },
  'ai.matey.core': {
    category: 'core',
    title: 'ai.matey.core',
    description: 'Core Bridge, Router, and MiddlewareStack implementations',
    exports: ['Bridge', 'createBridge', 'Router', 'createRouter', 'MiddlewareStack', 'createMiddlewareContext'],
  },
  'ai.matey.types': {
    category: 'core',
    title: 'ai.matey.types',
    description: 'TypeScript type definitions for the ai.matey ecosystem',
    exports: ['IRChatRequest', 'IRChatResponse', 'IRMessage', 'IRStreamChunk', 'FrontendAdapter', 'BackendAdapter', 'Middleware'],
  },
  'ai.matey.errors': {
    category: 'core',
    title: 'ai.matey.errors',
    description: 'Error classes and error handling utilities',
    exports: ['AdapterError', 'AuthenticationError', 'RateLimitError', 'ValidationError', 'ProviderError', 'NetworkError', 'ErrorCode'],
  },
  'ai.matey.utils': {
    category: 'core',
    title: 'ai.matey.utils',
    description: 'Shared utility functions for streaming, validation, and more',
    exports: ['asyncGeneratorToReadableStream', 'readableStreamToAsyncGenerator', 'collectStreamChunks'],
  },
  'ai.matey.testing': {
    category: 'core',
    title: 'ai.matey.testing',
    description: 'Testing utilities, mocks, and fixtures for ai.matey',
    exports: ['MockBackendAdapter', 'createMockResponse', 'assertChatRequest'],
  },
  'ai.matey.cli': {
    category: 'core',
    title: 'ai.matey.cli',
    description: 'Command-line interface and conversion utilities',
    exports: ['toOpenAIRequest', 'toAnthropicRequest', 'toOpenAI', 'toAnthropic'],
  },

  // Backend adapters
  'backend-openai': {
    category: 'backend',
    title: 'ai.matey.backend.openai',
    provider: 'OpenAI',
    description: 'Backend adapter for OpenAI API (GPT-4, GPT-3.5, etc.)',
    exports: ['OpenAIBackendAdapter'],
    config: ['apiKey', 'baseUrl', 'organization'],
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'],
  },
  'backend-anthropic': {
    category: 'backend',
    title: 'ai.matey.backend.anthropic',
    provider: 'Anthropic',
    description: 'Backend adapter for Anthropic API (Claude models)',
    exports: ['AnthropicBackendAdapter'],
    config: ['apiKey', 'baseUrl'],
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-5-sonnet'],
  },
  'backend-gemini': {
    category: 'backend',
    title: 'ai.matey.backend.gemini',
    provider: 'Google',
    description: 'Backend adapter for Google Gemini API',
    exports: ['GeminiBackendAdapter'],
    config: ['apiKey'],
    models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  'backend-groq': {
    category: 'backend',
    title: 'ai.matey.backend.groq',
    provider: 'Groq',
    description: 'Backend adapter for Groq API (fast inference)',
    exports: ['GroqBackendAdapter'],
    config: ['apiKey'],
    models: ['llama-3.1-70b', 'llama-3.1-8b', 'mixtral-8x7b'],
  },
  'backend-mistral': {
    category: 'backend',
    title: 'ai.matey.backend.mistral',
    provider: 'Mistral',
    description: 'Backend adapter for Mistral AI API',
    exports: ['MistralBackendAdapter'],
    config: ['apiKey'],
    models: ['mistral-large', 'mistral-medium', 'mistral-small', 'mistral-tiny'],
  },
  'backend-ollama': {
    category: 'backend',
    title: 'ai.matey.backend.ollama',
    provider: 'Ollama',
    description: 'Backend adapter for Ollama (local LLM inference)',
    exports: ['OllamaBackendAdapter'],
    config: ['baseUrl', 'model'],
    models: ['llama3.2', 'llama3.1', 'mistral', 'codellama'],
  },
  'backend-deepseek': {
    category: 'backend',
    title: 'ai.matey.backend.deepseek',
    provider: 'DeepSeek',
    description: 'Backend adapter for DeepSeek API',
    exports: ['DeepSeekBackendAdapter'],
    config: ['apiKey'],
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  'backend-cohere': {
    category: 'backend',
    title: 'ai.matey.backend.cohere',
    provider: 'Cohere',
    description: 'Backend adapter for Cohere API',
    exports: ['CohereBackendAdapter'],
    config: ['apiKey'],
    models: ['command', 'command-light', 'command-r', 'command-r-plus'],
  },
  'backend-huggingface': {
    category: 'backend',
    title: 'ai.matey.backend.huggingface',
    provider: 'Hugging Face',
    description: 'Backend adapter for Hugging Face Inference API',
    exports: ['HuggingFaceBackendAdapter'],
    config: ['apiKey', 'model'],
    models: ['Various HuggingFace models'],
  },
  'backend-nvidia': {
    category: 'backend',
    title: 'ai.matey.backend.nvidia',
    provider: 'NVIDIA',
    description: 'Backend adapter for NVIDIA NIM endpoints',
    exports: ['NVIDIABackendAdapter'],
    config: ['apiKey'],
    models: ['meta/llama3-8b-instruct', 'meta/llama3-70b-instruct'],
  },
  'backend-lmstudio': {
    category: 'backend',
    title: 'ai.matey.backend.lmstudio',
    provider: 'LM Studio',
    description: 'Backend adapter for LM Studio local server',
    exports: ['LMStudioBackendAdapter'],
    config: ['baseUrl'],
    models: ['Local models loaded in LM Studio'],
  },
  'backend-mock': {
    category: 'backend',
    title: 'ai.matey.backend.mock',
    provider: 'Mock',
    description: 'Mock backend adapter for testing',
    exports: ['MockBackendAdapter', 'createEchoBackend', 'createErrorBackend', 'createDelayedBackend'],
    config: ['defaultResponse', 'modelResponses', 'responseGenerator'],
    models: ['mock-gpt-4', 'mock-claude-3', 'mock-fast'],
  },
  'backend-azure-openai': {
    category: 'backend',
    title: 'ai.matey.backend.azure-openai',
    provider: 'Azure OpenAI',
    description: 'Backend adapter for Azure OpenAI Service',
    exports: ['AzureOpenAIBackendAdapter'],
    config: ['apiKey', 'endpoint', 'deploymentName', 'apiVersion'],
    models: ['Your Azure deployments'],
  },
  'backend-aws-bedrock': {
    category: 'backend',
    title: 'ai.matey.backend.aws-bedrock',
    provider: 'AWS Bedrock',
    description: 'Backend adapter for AWS Bedrock',
    exports: ['AWSBedrockBackendAdapter'],
    config: ['region', 'credentials'],
    models: ['anthropic.claude-v2', 'amazon.titan-text-express'],
  },
  'backend-cloudflare': {
    category: 'backend',
    title: 'ai.matey.backend.cloudflare',
    provider: 'Cloudflare',
    description: 'Backend adapter for Cloudflare Workers AI',
    exports: ['CloudflareBackendAdapter'],
    config: ['accountId', 'apiToken'],
    models: ['@cf/meta/llama-2-7b-chat-fp16'],
  },
  'backend-replicate': {
    category: 'backend',
    title: 'ai.matey.backend.replicate',
    provider: 'Replicate',
    description: 'Backend adapter for Replicate API',
    exports: ['ReplicateBackendAdapter'],
    config: ['apiToken'],
    models: ['meta/llama-2-70b-chat', 'mistralai/mistral-7b-instruct'],
  },
  'backend-together-ai': {
    category: 'backend',
    title: 'ai.matey.backend.together-ai',
    provider: 'Together AI',
    description: 'Backend adapter for Together AI API',
    exports: ['TogetherAIBackendAdapter'],
    config: ['apiKey'],
    models: ['togethercomputer/llama-2-70b-chat', 'mistralai/Mixtral-8x7B-Instruct'],
  },
  'backend-fireworks': {
    category: 'backend',
    title: 'ai.matey.backend.fireworks',
    provider: 'Fireworks',
    description: 'Backend adapter for Fireworks AI API',
    exports: ['FireworksBackendAdapter'],
    config: ['apiKey'],
    models: ['accounts/fireworks/models/llama-v2-70b-chat'],
  },
  'backend-perplexity': {
    category: 'backend',
    title: 'ai.matey.backend.perplexity',
    provider: 'Perplexity',
    description: 'Backend adapter for Perplexity API',
    exports: ['PerplexityBackendAdapter'],
    config: ['apiKey'],
    models: ['pplx-7b-online', 'pplx-70b-online'],
  },
  'backend-openrouter': {
    category: 'backend',
    title: 'ai.matey.backend.openrouter',
    provider: 'OpenRouter',
    description: 'Backend adapter for OpenRouter (multi-provider routing)',
    exports: ['OpenRouterBackendAdapter'],
    config: ['apiKey'],
    models: ['openai/gpt-4', 'anthropic/claude-3-opus', 'google/gemini-pro'],
  },
  'backend-anyscale': {
    category: 'backend',
    title: 'ai.matey.backend.anyscale',
    provider: 'Anyscale',
    description: 'Backend adapter for Anyscale Endpoints',
    exports: ['AnyscaleBackendAdapter'],
    config: ['apiKey'],
    models: ['meta-llama/Llama-2-70b-chat-hf'],
  },
  'backend-deepinfra': {
    category: 'backend',
    title: 'ai.matey.backend.deepinfra',
    provider: 'DeepInfra',
    description: 'Backend adapter for DeepInfra API',
    exports: ['DeepInfraBackendAdapter'],
    config: ['apiKey'],
    models: ['meta-llama/Llama-2-70b-chat-hf'],
  },
  'backend-cerebras': {
    category: 'backend',
    title: 'ai.matey.backend.cerebras',
    provider: 'Cerebras',
    description: 'Backend adapter for Cerebras Inference',
    exports: ['CerebrasBackendAdapter'],
    config: ['apiKey'],
    models: ['cerebras/Cerebras-GPT-13B'],
  },
  'backend-ai21': {
    category: 'backend',
    title: 'ai.matey.backend.ai21',
    provider: 'AI21',
    description: 'Backend adapter for AI21 Labs API',
    exports: ['AI21BackendAdapter'],
    config: ['apiKey'],
    models: ['j2-ultra', 'j2-mid', 'jamba-instruct'],
  },
  'backend-xai': {
    category: 'backend',
    title: 'ai.matey.backend.xai',
    provider: 'xAI',
    description: 'Backend adapter for xAI (Grok)',
    exports: ['XAIBackendAdapter'],
    config: ['apiKey'],
    models: ['grok-beta'],
  },
  'backend-chrome-ai': {
    category: 'backend',
    title: 'ai.matey.backend.chrome-ai',
    provider: 'Chrome AI',
    description: 'Backend adapter for Chrome built-in AI (experimental)',
    exports: ['ChromeAIBackendAdapter'],
    config: [],
    models: ['Built-in Chrome AI model'],
  },

  // Frontend adapters
  'frontend-openai': {
    category: 'frontend',
    title: 'ai.matey.frontend.openai',
    description: 'Frontend adapter for OpenAI-compatible request format',
    exports: ['OpenAIFrontendAdapter'],
  },
  'frontend-anthropic': {
    category: 'frontend',
    title: 'ai.matey.frontend.anthropic',
    description: 'Frontend adapter for Anthropic-compatible request format',
    exports: ['AnthropicFrontendAdapter'],
  },
  'frontend-gemini': {
    category: 'frontend',
    title: 'ai.matey.frontend.gemini',
    description: 'Frontend adapter for Gemini-compatible request format',
    exports: ['GeminiFrontendAdapter'],
  },
  'frontend-ollama': {
    category: 'frontend',
    title: 'ai.matey.frontend.ollama',
    description: 'Frontend adapter for Ollama-compatible request format',
    exports: ['OllamaFrontendAdapter'],
  },
  'frontend-mistral': {
    category: 'frontend',
    title: 'ai.matey.frontend.mistral',
    description: 'Frontend adapter for Mistral-compatible request format',
    exports: ['MistralFrontendAdapter'],
  },
  'frontend-chrome-ai': {
    category: 'frontend',
    title: 'ai.matey.frontend.chrome-ai',
    description: 'Frontend adapter for Chrome AI request format',
    exports: ['ChromeAIFrontendAdapter'],
  },

  // HTTP integrations
  'http-express': {
    category: 'http',
    title: 'ai.matey.http.express',
    framework: 'Express',
    description: 'HTTP integration for Express.js',
    exports: ['createExpressHandler', 'createExpressMiddleware'],
  },
  'http-fastify': {
    category: 'http',
    title: 'ai.matey.http.fastify',
    framework: 'Fastify',
    description: 'HTTP integration for Fastify',
    exports: ['createFastifyHandler', 'createFastifyPlugin'],
  },
  'http-hono': {
    category: 'http',
    title: 'ai.matey.http.hono',
    framework: 'Hono',
    description: 'HTTP integration for Hono',
    exports: ['createHonoHandler', 'createHonoMiddleware'],
  },
  'http-koa': {
    category: 'http',
    title: 'ai.matey.http.koa',
    framework: 'Koa',
    description: 'HTTP integration for Koa',
    exports: ['createKoaHandler', 'createKoaMiddleware'],
  },
  'http-node': {
    category: 'http',
    title: 'ai.matey.http.node',
    framework: 'Node.js',
    description: 'HTTP integration for Node.js http module',
    exports: ['NodeHTTPListener', 'createNodeHandler'],
  },
  'http-deno': {
    category: 'http',
    title: 'ai.matey.http.deno',
    framework: 'Deno',
    description: 'HTTP integration for Deno',
    exports: ['createDenoHandler'],
  },
  'http-core': {
    category: 'http',
    title: 'ai.matey.http.core',
    framework: 'Core',
    description: 'Core HTTP utilities shared across integrations',
    exports: ['createCorsMiddleware', 'validateApiKey', 'parseRequestBody'],
  },

  // Middleware
  'middleware-logging': {
    category: 'middleware',
    title: 'ai.matey.middleware.logging',
    description: 'Logging middleware for request/response logging',
    exports: ['createLoggingMiddleware'],
    config: ['level', 'logRequests', 'logResponses', 'logErrors', 'redactFields'],
  },
  'middleware-caching': {
    category: 'middleware',
    title: 'ai.matey.middleware.caching',
    description: 'Caching middleware for response caching',
    exports: ['createCachingMiddleware', 'InMemoryCacheStorage'],
    config: ['maxSize', 'ttlMs', 'keyGenerator'],
  },
  'middleware-retry': {
    category: 'middleware',
    title: 'ai.matey.middleware.retry',
    description: 'Retry middleware for automatic request retries',
    exports: ['createRetryMiddleware'],
    config: ['maxRetries', 'initialDelayMs', 'maxDelayMs', 'backoffMultiplier', 'retryableErrors'],
  },
  'middleware-transform': {
    category: 'middleware',
    title: 'ai.matey.middleware.transform',
    description: 'Transform middleware for request/response modification',
    exports: ['createTransformMiddleware'],
    config: ['transformRequest', 'transformResponse', 'transformMessages'],
  },
  'middleware-validation': {
    category: 'middleware',
    title: 'ai.matey.middleware.validation',
    description: 'Validation middleware for request validation',
    exports: ['createValidationMiddleware'],
    config: ['validateRequest', 'validateResponse', 'schema'],
  },
  'middleware-telemetry': {
    category: 'middleware',
    title: 'ai.matey.middleware.telemetry',
    description: 'Telemetry middleware for metrics collection',
    exports: ['createTelemetryMiddleware', 'InMemoryTelemetrySink'],
    config: ['sink', 'collectLatency', 'collectTokens'],
  },
  'middleware-opentelemetry': {
    category: 'middleware',
    title: 'ai.matey.middleware.opentelemetry',
    description: 'OpenTelemetry middleware for distributed tracing',
    exports: ['createOpenTelemetryMiddleware'],
    config: ['tracer', 'spanName'],
  },
  'middleware-cost-tracking': {
    category: 'middleware',
    title: 'ai.matey.middleware.cost-tracking',
    description: 'Cost tracking middleware for usage monitoring',
    exports: ['createCostTrackingMiddleware'],
    config: ['costPerToken', 'onCost'],
  },
  'middleware-security': {
    category: 'middleware',
    title: 'ai.matey.middleware.security',
    description: 'Security middleware for rate limiting and access control',
    exports: ['createSecurityMiddleware'],
    config: ['rateLimit', 'allowedModels', 'blockedPatterns'],
  },
  'middleware-conversation-history': {
    category: 'middleware',
    title: 'ai.matey.middleware.conversation-history',
    description: 'Conversation history middleware for maintaining context',
    exports: ['createConversationHistoryMiddleware'],
    config: ['maxMessages', 'storage'],
  },

  // Wrappers
  'wrapper-openai-sdk': {
    category: 'wrapper',
    title: 'ai.matey.wrapper.openai-sdk',
    description: 'OpenAI SDK-compatible wrapper for any backend',
    exports: ['OpenAI', 'OpenAIClient', 'ChatCompletions'],
  },
  'wrapper-anthropic-sdk': {
    category: 'wrapper',
    title: 'ai.matey.wrapper.anthropic-sdk',
    description: 'Anthropic SDK-compatible wrapper for any backend',
    exports: ['Anthropic', 'AnthropicClient', 'Messages'],
  },
  'wrapper-chrome-ai': {
    category: 'wrapper',
    title: 'ai.matey.wrapper.chrome-ai',
    description: 'Chrome AI API wrapper for any backend',
    exports: ['ChromeAILanguageModel'],
  },
  'wrapper-chrome-ai-legacy': {
    category: 'wrapper',
    title: 'ai.matey.wrapper.chrome-ai-legacy',
    description: 'Legacy Chrome AI API wrapper',
    exports: ['ChromeAILegacyWrapper'],
  },
  'wrapper-anymethod': {
    category: 'wrapper',
    title: 'ai.matey.wrapper.anymethod',
    description: 'Dynamic method wrapper for flexible API patterns',
    exports: ['AnyMethodWrapper'],
  },

  // React
  'react-core': {
    category: 'react',
    title: 'ai.matey.react.core',
    description: 'Core React hooks for AI chat interactions',
    exports: ['useChat', 'useCompletion', 'useObject'],
  },
  'react-hooks': {
    category: 'react',
    title: 'ai.matey.react.hooks',
    description: 'Additional React hooks for AI features',
    exports: ['useAssistant', 'useStream', 'useTokenCount'],
  },
  'react-stream': {
    category: 'react',
    title: 'ai.matey.react.stream',
    description: 'React components for streaming AI responses',
    exports: ['StreamProvider', 'StreamText', 'TypeWriter'],
  },
  'react-nextjs': {
    category: 'react',
    title: 'ai.matey.react.nextjs',
    description: 'Next.js App Router integration',
    exports: ['createStreamingResponse', 'AIProvider'],
  },

  // Native
  'native-node-llamacpp': {
    category: 'native',
    title: 'ai.matey.native.node-llamacpp',
    description: 'Native llama.cpp integration via node-llama-cpp',
    exports: ['NodeLlamaCppBackend'],
  },
  'native-apple': {
    category: 'native',
    title: 'ai.matey.native.apple',
    description: 'Native Apple Intelligence integration (macOS 15+)',
    exports: ['AppleBackend'],
  },
  'native-model-runner': {
    category: 'native',
    title: 'ai.matey.native.model-runner',
    description: 'Generic model runner for local models',
    exports: ['ModelRunner', 'createModelRunner'],
  },
};

// ============================================================================
// Documentation Templates
// ============================================================================

function generateBackendDocs(pkgName, info) {
  const npmName = info.title;
  const provider = info.provider || 'Provider';
  const exports = info.exports || [];
  const config = info.config || [];
  const models = info.models || [];
  const mainExport = exports[0] || 'Adapter';

  return `# ${npmName}

${info.description}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${npmName}
\`\`\`

## Quick Start

\`\`\`typescript
import { ${mainExport} } from '${npmName}';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';

// Create the backend adapter
const backend = new ${mainExport}({
${config.map(c => `  ${c}: process.env.${c.toUpperCase().replace(/([A-Z])/g, '_$1')},`).join('\n')}
});

// Create a bridge
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  backend
);

// Make a request
const response = await bridge.chat({
  model: '${models[0] || 'model-name'}',
  messages: [{ role: 'user', content: 'Hello!' }],
});

console.log(response.choices[0].message.content);
\`\`\`

## API Reference

### ${mainExport}

The main adapter class for ${provider}.

#### Constructor

\`\`\`typescript
new ${mainExport}(config: ${mainExport}Config)
\`\`\`

#### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
${config.map(c => `| \`${c}\` | \`string\` | ${c === 'apiKey' ? 'Yes' : 'No'} | ${getConfigDescription(c)} |`).join('\n')}

#### Methods

##### \`execute(request: IRChatRequest): Promise<IRChatResponse>\`

Execute a chat completion request.

\`\`\`typescript
const response = await backend.execute({
  messages: [{ role: 'user', content: 'Hello!' }],
  parameters: { model: '${models[0] || 'model-name'}' },
  metadata: { requestId: 'req-123', timestamp: Date.now() },
});
\`\`\`

##### \`executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk>\`

Execute a streaming chat completion request.

\`\`\`typescript
const stream = backend.executeStream({
  messages: [{ role: 'user', content: 'Tell me a story' }],
  parameters: { model: '${models[0] || 'model-name'}' },
  metadata: { requestId: 'req-123', timestamp: Date.now() },
});

for await (const chunk of stream) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.delta);
  }
}
\`\`\`

##### \`listModels(): Promise<ListModelsResult>\`

List available models.

\`\`\`typescript
const models = await backend.listModels();
console.log(models.models.map(m => m.id));
\`\`\`

## Supported Models

${models.map(m => `- \`${m}\``).join('\n')}

## Streaming Support

This adapter supports streaming responses. Use \`executeStream()\` for real-time token generation.

## Error Handling

\`\`\`typescript
import { AuthenticationError, RateLimitError } from 'ai.matey.errors';

try {
  const response = await backend.execute(request);
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited, retry after:', error.retryAfter);
  }
}
\`\`\`

## License

MIT - see [LICENSE](./LICENSE) for details.
`;
}

function generateFrontendDocs(pkgName, info) {
  const npmName = info.title;
  const exports = info.exports || [];
  const mainExport = exports[0] || 'Adapter';

  return `# ${npmName}

${info.description}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${npmName}
\`\`\`

## Quick Start

\`\`\`typescript
import { ${mainExport} } from '${npmName}';
import { Bridge } from 'ai.matey.core';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

// Create a bridge that accepts ${mainExport.replace('FrontendAdapter', '')} format requests
const bridge = new Bridge(
  new ${mainExport}(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);
\`\`\`

## API Reference

### ${mainExport}

Converts incoming requests from ${mainExport.replace('FrontendAdapter', '')} format to the internal IR format.

#### Constructor

\`\`\`typescript
new ${mainExport}()
\`\`\`

#### Methods

##### \`toIR(request: ProviderRequest): IRChatRequest\`

Convert a provider-specific request to the internal IR format.

##### \`fromIR(response: IRChatResponse): ProviderResponse\`

Convert an IR response back to the provider-specific format.

##### \`fromIRStream(chunk: IRStreamChunk): ProviderStreamChunk\`

Convert an IR stream chunk to the provider-specific format.

## Use Cases

### Accept OpenAI Format, Use Any Backend

\`\`\`typescript
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
import { Bridge } from 'ai.matey.core';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Client sends OpenAI format, ai.matey translates to Anthropic
const response = await bridge.chat({
  model: 'gpt-4',  // Will be mapped to Claude
  messages: [{ role: 'user', content: 'Hello!' }],
});
\`\`\`

## License

MIT - see [LICENSE](./LICENSE) for details.
`;
}

function generateMiddlewareDocs(pkgName, info) {
  const npmName = info.title;
  const exports = info.exports || [];
  const config = info.config || [];
  const mainExport = exports[0] || 'createMiddleware';

  return `# ${npmName}

${info.description}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${npmName}
\`\`\`

## Quick Start

\`\`\`typescript
import { ${mainExport} } from '${npmName}';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

// Add middleware
bridge.use(${mainExport}({
${config.map(c => `  ${c}: /* value */,`).join('\n')}
}));
\`\`\`

## API Reference

### ${mainExport}

Creates middleware for ${info.description.toLowerCase()}.

#### Configuration

\`\`\`typescript
${mainExport}(config?: ${mainExport.replace('create', '')}Config): Middleware
\`\`\`

| Option | Type | Description |
|--------|------|-------------|
${config.map(c => `| \`${c}\` | \`${getConfigType(c)}\` | ${getConfigDescription(c)} |`).join('\n')}

## Exports

${exports.map(e => `- \`${e}\``).join('\n')}

## Example

\`\`\`typescript
import { ${mainExport} } from '${npmName}';

const middleware = ${mainExport}({
  // configuration options
});

bridge.use(middleware);
\`\`\`

## License

MIT - see [LICENSE](./LICENSE) for details.
`;
}

function generateHttpDocs(pkgName, info) {
  const npmName = info.title;
  const exports = info.exports || [];
  const framework = info.framework || 'Framework';
  const mainExport = exports[0] || 'createHandler';

  return `# ${npmName}

${info.description}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${npmName}
\`\`\`

## Quick Start

\`\`\`typescript
import { ${mainExport} } from '${npmName}';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend.openai';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const handler = ${mainExport}(bridge, {
  streaming: true,
  timeout: 30000,
});

// Use with your ${framework} server
\`\`\`

## API Reference

### ${mainExport}

Creates an HTTP handler for ${framework}.

\`\`\`typescript
${mainExport}(bridge: Bridge, options?: HandlerOptions): Handler
\`\`\`

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| \`streaming\` | \`boolean\` | \`true\` | Enable streaming responses |
| \`timeout\` | \`number\` | \`30000\` | Request timeout in milliseconds |
| \`cors\` | \`boolean\` | \`false\` | Enable CORS headers |

## Exports

${exports.map(e => `- \`${e}\``).join('\n')}

## License

MIT - see [LICENSE](./LICENSE) for details.
`;
}

function generateWrapperDocs(pkgName, info) {
  const npmName = info.title;
  const exports = info.exports || [];
  const mainExport = exports[0] || 'Wrapper';

  return `# ${npmName}

${info.description}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${npmName}
\`\`\`

## Quick Start

\`\`\`typescript
import { ${mainExport} } from '${npmName}';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';

// Create an SDK-compatible client backed by any adapter
const client = ${mainExport}(
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY })
);

// Use the same API as the official SDK
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
\`\`\`

## API Reference

### ${mainExport}

Creates an SDK-compatible client wrapper.

\`\`\`typescript
${mainExport}(backend: BackendAdapter, config?: WrapperConfig): Client
\`\`\`

## Exports

${exports.map(e => `- \`${e}\``).join('\n')}

## Use Cases

### Migrate Existing Code

Replace your existing SDK import with ai.matey wrapper:

\`\`\`typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: '...' });

// After
import { ${mainExport} } from '${npmName}';
import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
const client = ${mainExport}(new AnthropicBackendAdapter({ apiKey: '...' }));

// Same API, different backend!
\`\`\`

## License

MIT - see [LICENSE](./LICENSE) for details.
`;
}

function generateReactDocs(pkgName, info) {
  const npmName = info.title;
  const exports = info.exports || [];

  return `# ${npmName}

${info.description}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${npmName}
\`\`\`

## Quick Start

\`\`\`typescript
import { ${exports[0] || 'useChat'} } from '${npmName}';

function ChatComponent() {
  const { messages, input, handleSubmit, setInput } = ${exports[0] || 'useChat'}({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map((m, i) => (
        <div key={i}>{m.content}</div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
\`\`\`

## Exports

${exports.map(e => `- \`${e}\``).join('\n')}

## API Reference

${exports.map(e => `### ${e}

See the TypeScript definitions for detailed API documentation.
`).join('\n')}

## License

MIT - see [LICENSE](./LICENSE) for details.
`;
}

function generateCoreDocs(pkgName, info) {
  const npmName = info.title;
  const exports = info.exports || [];

  return `# ${npmName}

${info.description}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${npmName}
\`\`\`

## Exports

${exports.map(e => `- \`${e}\``).join('\n')}

## Usage

\`\`\`typescript
import { ${exports.join(', ')} } from '${npmName}';
\`\`\`

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.
`;
}

function generateNativeDocs(pkgName, info) {
  const npmName = info.title;
  const exports = info.exports || [];

  return `# ${npmName}

${info.description}

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

\`\`\`bash
npm install ${npmName}
\`\`\`

## Requirements

- Node.js 18+
${pkgName.includes('apple') ? '- macOS 15+ (Sequoia)' : ''}
${pkgName.includes('llamacpp') ? '- GGUF model file' : ''}

## Quick Start

\`\`\`typescript
import { ${exports[0] || 'Backend'} } from '${npmName}';

const backend = new ${exports[0] || 'Backend'}({
  // configuration
});
\`\`\`

## Exports

${exports.map(e => `- \`${e}\``).join('\n')}

## License

MIT - see [LICENSE](./LICENSE) for details.
`;
}

// Helper functions
function getConfigDescription(config) {
  const descriptions = {
    apiKey: 'API key for authentication',
    baseUrl: 'Custom base URL for API endpoint',
    organization: 'Organization ID',
    model: 'Default model to use',
    endpoint: 'API endpoint URL',
    deploymentName: 'Azure deployment name',
    apiVersion: 'API version',
    region: 'AWS region',
    credentials: 'AWS credentials',
    accountId: 'Account identifier',
    apiToken: 'API token for authentication',
    level: 'Log level (debug, info, warn, error)',
    logRequests: 'Log incoming requests',
    logResponses: 'Log outgoing responses',
    logErrors: 'Log errors',
    redactFields: 'Fields to redact from logs',
    maxSize: 'Maximum cache size',
    ttlMs: 'Time-to-live in milliseconds',
    keyGenerator: 'Custom cache key generator function',
    maxRetries: 'Maximum number of retry attempts',
    initialDelayMs: 'Initial delay before first retry',
    maxDelayMs: 'Maximum delay between retries',
    backoffMultiplier: 'Backoff multiplier for exponential retry',
    retryableErrors: 'Error types to retry',
    transformRequest: 'Function to transform requests',
    transformResponse: 'Function to transform responses',
    transformMessages: 'Function to transform messages',
    validateRequest: 'Request validation function',
    validateResponse: 'Response validation function',
    schema: 'Validation schema',
    sink: 'Telemetry data sink',
    collectLatency: 'Collect latency metrics',
    collectTokens: 'Collect token usage metrics',
    tracer: 'OpenTelemetry tracer',
    spanName: 'Span name for traces',
    costPerToken: 'Cost per token for tracking',
    onCost: 'Callback for cost events',
    rateLimit: 'Rate limiting configuration',
    allowedModels: 'List of allowed models',
    blockedPatterns: 'Patterns to block',
    maxMessages: 'Maximum messages to retain',
    storage: 'Storage backend for history',
  };
  return descriptions[config] || `${config} configuration`;
}

function getConfigType(config) {
  const types = {
    apiKey: 'string',
    baseUrl: 'string',
    organization: 'string',
    model: 'string',
    level: "'debug' | 'info' | 'warn' | 'error'",
    logRequests: 'boolean',
    logResponses: 'boolean',
    logErrors: 'boolean',
    redactFields: 'string[]',
    maxSize: 'number',
    ttlMs: 'number',
    keyGenerator: 'Function',
    maxRetries: 'number',
    initialDelayMs: 'number',
    maxDelayMs: 'number',
    backoffMultiplier: 'number',
    retryableErrors: 'string[]',
    transformRequest: 'Function',
    transformResponse: 'Function',
    transformMessages: 'Function',
  };
  return types[config] || 'any';
}

function generateDocumentation(pkgName, info) {
  switch (info.category) {
    case 'backend':
      return generateBackendDocs(pkgName, info);
    case 'frontend':
      return generateFrontendDocs(pkgName, info);
    case 'middleware':
      return generateMiddlewareDocs(pkgName, info);
    case 'http':
      return generateHttpDocs(pkgName, info);
    case 'wrapper':
      return generateWrapperDocs(pkgName, info);
    case 'react':
      return generateReactDocs(pkgName, info);
    case 'native':
      return generateNativeDocs(pkgName, info);
    default:
      return generateCoreDocs(pkgName, info);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const packages = fs.readdirSync(packagesDir).filter(f =>
    fs.statSync(path.join(packagesDir, f)).isDirectory()
  );

  let generated = 0;

  for (const pkg of packages) {
    const pkgDir = path.join(packagesDir, pkg);
    const readmePath = path.join(pkgDir, 'README.md');
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) {
      continue;
    }

    // Find matching info
    let info = packageInfo[pkg];
    if (!info) {
      // Try to find by package name pattern
      for (const [key, value] of Object.entries(packageInfo)) {
        if (pkg === key || pkg.replace(/-/g, '.') === key.replace('ai.matey.', '')) {
          info = value;
          break;
        }
      }
    }

    if (!info) {
      // Generate generic docs
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      info = {
        category: 'core',
        title: pkgJson.name,
        description: pkgJson.description,
        exports: [],
      };
    }

    const readme = generateDocumentation(pkg, info);
    fs.writeFileSync(readmePath, readme);
    generated++;
    console.log(`Generated: ${pkg}/README.md`);
  }

  console.log(`\nGenerated ${generated} README files`);
}

main().catch(console.error);
