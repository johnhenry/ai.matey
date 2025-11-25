import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Root level tests (if any remain)
  'vitest.config.ts',
  // All packages with vitest config
  'packages/*/vitest.config.ts',
]);
