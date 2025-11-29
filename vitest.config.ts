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

      // Backend adapters (consolidated packages)
      'ai.matey.backend': path.resolve(__dirname, 'packages/backend/src'),
      'ai.matey.backend.browser': path.resolve(__dirname, 'packages/backend-browser/src'),

      // Frontend adapters (consolidated package)
      'ai.matey.frontend': path.resolve(__dirname, 'packages/frontend/src'),

      // Middleware (consolidated package)
      'ai.matey.middleware': path.resolve(__dirname, 'packages/middleware/src'),

      // HTTP adapters (consolidated package)
      'ai.matey.http': path.resolve(__dirname, 'packages/http/src'),
      'ai.matey.http.core': path.resolve(__dirname, 'packages/http.core/src'),

      // Wrappers (consolidated package)
      'ai.matey.wrapper': path.resolve(__dirname, 'packages/wrapper/src'),

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
