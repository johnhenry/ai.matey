# DEPRECATED: Legacy Source Directory

> **Warning**: This directory contains the legacy monolithic codebase and is deprecated.
> All new development should use the modular packages in the `packages/` directory.

## Migration Status

The ai.matey codebase has been migrated to a monorepo structure with independently publishable packages located in the `packages/` directory.

### What This Directory Contains

This `src/` directory contains the original monolithic implementation:
- `src/adapters/backend/` - Backend adapters (26 files)
- `src/adapters/frontend/` - Frontend adapters (6 files)
- `src/core/` - Core Bridge and Router implementation
- `src/middleware/` - Middleware implementations
- `src/http/` - HTTP server adapters
- `src/types/` - TypeScript type definitions
- `src/errors/` - Error classes
- `src/utils/` - Utility functions

### Where to Find the New Code

All functionality has been migrated to the `packages/` directory:

| Legacy Location | New Package |
|-----------------|-------------|
| `src/types/` | `packages/ai.matey.types/` |
| `src/errors/` | `packages/ai.matey.errors/` |
| `src/utils/` | `packages/ai.matey.utils/` |
| `src/core/` | `packages/ai.matey.core/` |
| `src/adapters/backend/openai.ts` | `packages/backend-openai/` |
| `src/adapters/backend/anthropic.ts` | `packages/backend-anthropic/` |
| `src/adapters/frontend/openai.ts` | `packages/frontend-openai/` |
| `src/middleware/*.ts` | `packages/middleware-*/` |
| `src/http/adapters/express/` | `packages/http-express/` |
| ... | ... |

### Tests

All tests have been migrated to use the new packages. The test files in `tests/` now import from package names (e.g., `ai.matey.backend.openai`) rather than relative paths.

### Removal Timeline

This directory will be removed in a future major version. Please ensure all imports reference the new packages:

```typescript
// Old (deprecated)
import { OpenAIBackendAdapter } from './src/adapters/backend/openai.js';

// New (recommended)
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
```

### Questions?

If you have questions about the migration, please open an issue in the repository.
