import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Root level tests - all tests are centralized here
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'core',
      include: ['tests/core/**/*.test.ts'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'http',
      include: ['tests/http/**/*.test.ts'],
    },
  },
]);
