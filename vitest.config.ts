import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Core packages
      'ai.matey.types': path.resolve(__dirname, 'packages/ai.matey.types/src'),
      'ai.matey.errors': path.resolve(__dirname, 'packages/ai.matey.errors/src'),
      'ai.matey.utils': path.resolve(__dirname, 'packages/ai.matey.utils/src'),
      'ai.matey.core': path.resolve(__dirname, 'packages/ai.matey.core/src'),
      'ai.matey.testing': path.resolve(__dirname, 'packages/ai.matey.testing/src'),
      'ai.matey': path.resolve(__dirname, 'packages/ai.matey/src'),

      // Backend adapters
      'ai.matey.backend.shared': path.resolve(__dirname, 'packages/backend-shared/src'),
      'ai.matey.backend.function': path.resolve(__dirname, 'packages/backend-function/src'),
      'ai.matey.backend.openai': path.resolve(__dirname, 'packages/backend-openai/src'),
      'ai.matey.backend.anthropic': path.resolve(__dirname, 'packages/backend-anthropic/src'),
      'ai.matey.backend.gemini': path.resolve(__dirname, 'packages/backend-gemini/src'),
      'ai.matey.backend.groq': path.resolve(__dirname, 'packages/backend-groq/src'),
      'ai.matey.backend.mistral': path.resolve(__dirname, 'packages/backend-mistral/src'),
      'ai.matey.backend.ollama': path.resolve(__dirname, 'packages/backend-ollama/src'),
      'ai.matey.backend.deepseek': path.resolve(__dirname, 'packages/backend-deepseek/src'),
      'ai.matey.backend.mock': path.resolve(__dirname, 'packages/backend-mock/src'),
      'ai.matey.backend.cohere': path.resolve(__dirname, 'packages/backend-cohere/src'),
      'ai.matey.backend.xai': path.resolve(__dirname, 'packages/backend-xai/src'),
      'ai.matey.backend.perplexity': path.resolve(__dirname, 'packages/backend-perplexity/src'),
      'ai.matey.backend.together-ai': path.resolve(__dirname, 'packages/backend-together-ai/src'),
      'ai.matey.backend.fireworks': path.resolve(__dirname, 'packages/backend-fireworks/src'),
      'ai.matey.backend.deepinfra': path.resolve(__dirname, 'packages/backend-deepinfra/src'),
      'ai.matey.backend.openrouter': path.resolve(__dirname, 'packages/backend-openrouter/src'),
      'ai.matey.backend.replicate': path.resolve(__dirname, 'packages/backend-replicate/src'),
      'ai.matey.backend.huggingface': path.resolve(__dirname, 'packages/backend-huggingface/src'),
      'ai.matey.backend.ai21': path.resolve(__dirname, 'packages/backend-ai21/src'),
      'ai.matey.backend.anyscale': path.resolve(__dirname, 'packages/backend-anyscale/src'),
      'ai.matey.backend.cerebras': path.resolve(__dirname, 'packages/backend-cerebras/src'),
      'ai.matey.backend.cloudflare': path.resolve(__dirname, 'packages/backend-cloudflare/src'),
      'ai.matey.backend.nvidia': path.resolve(__dirname, 'packages/backend-nvidia/src'),
      'ai.matey.backend.lmstudio': path.resolve(__dirname, 'packages/backend-lmstudio/src'),
      'ai.matey.backend.azure-openai': path.resolve(__dirname, 'packages/backend-azure-openai/src'),
      'ai.matey.backend.aws-bedrock': path.resolve(__dirname, 'packages/backend-aws-bedrock/src'),
      'ai.matey.backend.chrome-ai': path.resolve(__dirname, 'packages/backend-chrome-ai/src'),

      // Frontend adapters
      'ai.matey.frontend.openai': path.resolve(__dirname, 'packages/frontend-openai/src'),
      'ai.matey.frontend.anthropic': path.resolve(__dirname, 'packages/frontend-anthropic/src'),
      'ai.matey.frontend.gemini': path.resolve(__dirname, 'packages/frontend-gemini/src'),
      'ai.matey.frontend.mistral': path.resolve(__dirname, 'packages/frontend-mistral/src'),
      'ai.matey.frontend.ollama': path.resolve(__dirname, 'packages/frontend-ollama/src'),
      'ai.matey.frontend.chrome-ai': path.resolve(__dirname, 'packages/frontend-chrome-ai/src'),

      // Middleware
      'ai.matey.middleware.logging': path.resolve(__dirname, 'packages/middleware-logging/src'),
      'ai.matey.middleware.caching': path.resolve(__dirname, 'packages/middleware-caching/src'),
      'ai.matey.middleware.retry': path.resolve(__dirname, 'packages/middleware-retry/src'),
      'ai.matey.middleware.transform': path.resolve(__dirname, 'packages/middleware-transform/src'),
      'ai.matey.middleware.validation': path.resolve(__dirname, 'packages/middleware-validation/src'),
      'ai.matey.middleware.telemetry': path.resolve(__dirname, 'packages/middleware-telemetry/src'),
      'ai.matey.middleware.opentelemetry': path.resolve(__dirname, 'packages/middleware-opentelemetry/src'),
      'ai.matey.middleware.security': path.resolve(__dirname, 'packages/middleware-security/src'),
      'ai.matey.middleware.cost-tracking': path.resolve(__dirname, 'packages/middleware-cost-tracking/src'),
      'ai.matey.middleware.conversation-history': path.resolve(__dirname, 'packages/middleware-conversation-history/src'),

      // HTTP adapters
      'ai.matey.http.core': path.resolve(__dirname, 'packages/http-core/src'),
      'ai.matey.http.node': path.resolve(__dirname, 'packages/http-node/src'),
      'ai.matey.http.express': path.resolve(__dirname, 'packages/http-express/src'),
      'ai.matey.http.fastify': path.resolve(__dirname, 'packages/http-fastify/src'),
      'ai.matey.http.hono': path.resolve(__dirname, 'packages/http-hono/src'),
      'ai.matey.http.koa': path.resolve(__dirname, 'packages/http-koa/src'),
      'ai.matey.http.deno': path.resolve(__dirname, 'packages/http-deno/src'),

      // Wrappers
      'ai.matey.wrapper.openai-sdk': path.resolve(__dirname, 'packages/wrapper-openai-sdk/src'),
      'ai.matey.wrapper.anthropic-sdk': path.resolve(__dirname, 'packages/wrapper-anthropic-sdk/src'),
      'ai.matey.wrapper.chrome-ai': path.resolve(__dirname, 'packages/wrapper-chrome-ai/src'),
      'ai.matey.wrapper.anymethod': path.resolve(__dirname, 'packages/wrapper-anymethod/src'),

      // React
      'ai.matey.react.core': path.resolve(__dirname, 'packages/react-core/src'),
      'ai.matey.react.hooks': path.resolve(__dirname, 'packages/react-hooks/src'),
      'ai.matey.react.stream': path.resolve(__dirname, 'packages/react-stream/src'),
      'ai.matey.react.nextjs': path.resolve(__dirname, 'packages/react-nextjs/src'),

      // Native
      'ai.matey.native.model-runner': path.resolve(__dirname, 'packages/native-model-runner/src'),
      'ai.matey.native.apple': path.resolve(__dirname, 'packages/native-apple/src'),
      'ai.matey.native.node-llamacpp': path.resolve(__dirname, 'packages/native-node-llamacpp/src'),

      // CLI
      'ai.matey.cli': path.resolve(__dirname, 'packages/cli/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'examples/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vitest.config.ts',
        'tsconfig*.json',
        '.eslintrc.json',
        // Legacy src directory (deprecated)
        'src/**',
      ],
      thresholds: {
        lines: 30,
        functions: 50,
        branches: 60,
        statements: 30,
      },
      all: true,
      include: ['packages/*/src/**/*.ts'],
    },
  },
});
