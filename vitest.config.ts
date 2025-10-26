import { defineConfig } from 'vitest/config';

export default defineConfig({
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
        '**/types/**',
        'vitest.config.ts',
        'tsconfig*.json',
        '.eslintrc.json',
      ],
      thresholds: {
        lines: 30,
        functions: 50,
        branches: 60,
        statements: 30,
      },
      all: true,
      include: ['src/**/*.ts'],
    },
  },
});
