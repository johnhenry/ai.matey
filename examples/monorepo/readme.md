# Monorepo Examples

These examples demonstrate the new monorepo package structure where each component
is available as a separate npm package for optimal bundle sizes and dependency management.

## Package Structure

```
aimatey                    # Umbrella package (backwards compatibility)
├── aimatey-core           # Core Bridge and Router
├── aimatey-types          # TypeScript type definitions
├── aimatey-errors         # Error classes and utilities
├── aimatey-utils          # Shared utilities
├── aimatey-testing        # Testing utilities and mocks
├── aimatey-frontend.*     # Frontend adapters (openai, anthropic, etc.)
├── aimatey-backend.*      # Backend adapters (openai, anthropic, gemini, etc.)
├── aimatey-middleware.*   # Middleware packages
├── aimatey-http.*         # HTTP framework integrations
├── aimatey-wrapper.*      # SDK wrapper packages
└── aimatey-react.*        # React hooks and components
```

## Examples

| File | Description |
|------|-------------|
| `01-basic-bridge.ts` | Basic Bridge setup with direct package imports |
| `02-multi-backend-router.ts` | Router with multiple backends from different packages |
| `03-middleware-stack.ts` | Composing multiple middleware packages |
| `04-http-server.ts` | Express server with HTTP framework integration |
| `05-streaming.ts` | Streaming support and utilities |
| `06-error-handling.ts` | Error handling with the errors package |
| `07-react-hooks.tsx` | React hooks and stream components |
| `08-testing.ts` | Testing utilities and mock adapters |
| `09-local-models.ts` | Local model backends (Ollama, LM Studio) |
| `10-sdk-wrappers.ts` | Official SDK-compatible wrappers |

## Import Patterns

### New Style (Recommended for New Projects)
```typescript
// Import only what you need
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { createLoggingMiddleware } from '@johnhenry/aimatey-middleware';
```

### Specific Package Imports (Alternative Style)
```typescript
// Import from specific subpackage paths
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';
import { createLoggingMiddleware } from '@johnhenry/aimatey-middleware/logging';
```

Note: The umbrella package `@johnhenry/aimatey` only exports `VERSION` for version checking. Always import from specific packages as shown above.

## Running Examples

```bash
# Install dependencies
npm install

# Run an example
npx tsx examples/monorepo/01-basic-bridge.ts

# Or with environment variables
ANTHROPIC_API_KEY=sk-ant-xxx npx tsx examples/monorepo/01-basic-bridge.ts
```

## Benefits of Monorepo Structure

1. **Tree-shaking**: Import only what you use, smaller bundles
2. **Independent versioning**: Update packages individually
3. **Faster installs**: Only install required dependencies
4. **Better type inference**: Focused type definitions per package
5. **Easier testing**: Mock individual packages
6. **Clear dependencies**: Explicit package relationships
