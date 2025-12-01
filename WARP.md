# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

ai.matey is a universal AI adapter system that provides a provider-agnostic interface for AI APIs. It enables writing code once that works with any AI provider (OpenAI, Anthropic, Gemini, Ollama, and 20+ others).

**Core Architecture:**
```
Client Format → Frontend Adapter → IR Format → Backend Adapter → AI Provider
```

The **Intermediate Representation (IR)** is the universal format that sits between frontend and backend adapters. All conversions flow through this normalized format.

## Common Development Commands

### Building
```bash
# Build all packages (required before testing)
npm run build

# Build only ESM output
npm run build:esm

# Build only CommonJS output
npm run build:cjs

# Build only TypeScript declarations
npm run build:types

# Clean all build artifacts
npm run clean
```

### Testing
```bash
# Run all tests (requires build first)
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test workspace
npx vitest run --project=unit
npx vitest run --project=integration
npx vitest run --project=core
npx vitest run --project=http
```

### Linting & Type Checking
```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Run TypeScript type checking
npm run typecheck

# Format code
npm run format

# Check formatting
npm run format:check
```

### Package Management
```bash
# Install dependencies
npm install

# Create a changeset for versioning
npm run changeset

# Version packages based on changesets
npm run version-packages

# Publish packages (builds first)
npm run release

# Staggered publish for npm rate limits
npm run release:staggered
npm run release:staggered:dry-run
```

## Architecture Deep Dive

### Monorepo Structure

This is a **monorepo** managed with npm workspaces and Turborepo. All packages live under `packages/`:

**Core Infrastructure:**
- `ai.matey.types` - TypeScript type definitions (all other packages depend on this)
- `ai.matey.errors` - Error classes and utilities
- `ai.matey.utils` - Shared utility functions
- `ai.matey.core` - Bridge, Router, MiddlewareStack
- `ai.matey.testing` - Testing utilities and mocks

**Consolidated Provider Packages:**
- `backend` - All server-side backend adapters (OpenAI, Anthropic, Gemini, etc.)
- `backend-browser` - Browser-compatible backends (Chrome AI, Function, Mock)
- `frontend` - All frontend adapters (OpenAI, Anthropic, Gemini, Mistral, Ollama, Chrome AI, Generic)
- `middleware` - All middleware types (logging, caching, retry, telemetry, etc.)
- `http` - Framework adapters (Express, Fastify, Hono, Koa, http, Deno)
- `wrapper` - SDK wrappers (OpenAI SDK, Anthropic SDK, Chrome AI API)

**Specialized Packages:**
- `http.core` - Core HTTP utilities
- `react-core` - React hooks (useChat, useCompletion)
- `react-hooks` - Additional React hooks
- `react-stream` - React streaming components
- `react-nextjs` - Next.js App Router integration
- `native-model-runner` - Generic model runner
- `native-apple` - Apple MLX backend (macOS 15+)
- `native-node-llamacpp` - llama.cpp via Node
- `cli` - CLI tools and utilities
- `ai.matey` - Main umbrella package

### Key Concepts

#### 1. Frontend vs Backend Adapters

**Frontend Adapters** translate client request formats to IR:
- Input: Provider-specific format (e.g., OpenAI request)
- Output: Universal IR format
- Also handle IR → Provider format response conversion

**Backend Adapters** execute requests on AI providers:
- Input: Universal IR format
- Output: Calls provider API and returns IR response
- Handle model mapping, authentication, and API-specific logic

#### 2. Bridge

The `Bridge` is the main orchestrator that:
- Connects one frontend adapter to one backend adapter
- Executes middleware chain
- Handles errors, retries, and statistics tracking
- Enriches requests with metadata (requestId, timestamp)
- Supports both streaming and non-streaming requests

#### 3. Router

The `Router` is a special backend adapter that:
- Manages multiple backend adapters
- Implements routing strategies (model-based, explicit, capability-based, round-robin)
- Provides fallback chains (sequential or parallel)
- Includes circuit breaker pattern
- Tracks per-backend statistics and health
- Supports parallel dispatch to multiple backends

#### 4. Middleware

Middleware wraps the execution flow for cross-cutting concerns:
- **Logging** - Request/response logging
- **Caching** - Response caching with TTL
- **Retry** - Automatic retries with exponential backoff
- **Transform** - Request/response transformation
- **Validation** - Input validation & sanitization
- **Telemetry** - Metrics collection
- **OpenTelemetry** - Distributed tracing
- **Cost Tracking** - Token usage and cost tracking
- **Security** - Rate limiting, PII detection
- **Conversation History** - Context management

#### 5. IR Format (Intermediate Representation)

The IR is the universal format defined in `ai.matey.types/src/ir.ts`. Key types:
- `IRChatRequest` - Normalized request with messages, parameters, metadata, tools
- `IRChatResponse` - Normalized response with message, usage, metadata
- `IRStreamChunk` - Normalized streaming chunk
- `IRMessage` - Message with role, content (text, image, tool_use, tool_result)

**Critical IR Design Principles:**
- Provider-agnostic (no provider-specific fields in core types)
- Type-safe with discriminated unions
- Stream-friendly (delta and accumulated modes)
- Tracks semantic drift and transformations via metadata

### Package Dependencies

The dependency hierarchy flows:
```
ai.matey.types (base types)
    ↓
ai.matey.errors + ai.matey.utils (shared utilities)
    ↓
ai.matey.core (Bridge, Router, MiddlewareStack)
    ↓
backend + frontend + middleware + http (adapters)
    ↓
wrapper + react-* + native-* (higher-level integrations)
    ↓
ai.matey (umbrella package)
```

**Important:** Changes to `ai.matey.types` may affect all packages. Always rebuild after modifying types.

### Model Translation

Model translation happens at the **Router** level, not in backend adapters:
- Router has `modelMapping` for routing decisions
- Router has `modelTranslationMapping` for actual model substitution
- Backend adapters receive the post-translation model name
- Translation supports: explicit mappings, regex patterns, hybrid strategy, fallback to defaults

### Streaming Architecture

Streaming uses async generators throughout:
```typescript
async *executeStream(request: IRChatRequest): AsyncGenerator<IRStreamChunk>
```

The system supports:
- **Delta mode** - Each chunk contains only new content
- **Accumulated mode** - Each chunk contains all content so far
- Both request streaming and response streaming
- Middleware can wrap and transform streams

## Development Guidelines

### Adding a New Backend Adapter

1. Create provider file in `packages/backend/src/providers/your-provider.ts`
2. Implement `BackendAdapter` interface (execute, executeStream, fromIR, toIR)
3. Add export to `packages/backend/src/index.ts`
4. Add tests in `tests/unit/backend/your-provider.test.ts`
5. Update backend README and type exports

### Adding a New Frontend Adapter

1. Create adapter file in `packages/frontend/src/adapters/your-format.ts`
2. Implement `FrontendAdapter` interface (toIR, fromIR, metadata)
3. Add export to `packages/frontend/src/index.ts`
4. Add tests in `tests/unit/frontend/your-format.test.ts`

### Adding a New Middleware

1. Create middleware in `packages/middleware/src/your-middleware.ts`
2. Implement `Middleware` interface (name, execute method)
3. Export factory function `createYourMiddleware(options)`
4. Add export to `packages/middleware/src/index.ts`
5. Add tests

### TypeScript Configuration

- Target: **ES2022**
- Module: **ESNext** with bundler resolution
- Strict mode enabled
- Each package builds: ESM, CJS, and type declarations
- Use `vitest.config.ts` aliases for cross-package imports during development

### Testing Philosophy

- Tests are **centralized** in `/tests` directory (not per-package)
- Organized by type: `unit/`, `integration/`, `core/`, `http/`
- Use vitest workspaces to run test subsets
- Mock backends available in `ai.matey.testing` package
- **Build before testing** - tests import from built dist files
- Coverage thresholds: 30% lines, 50% functions, 60% branches

### Code Style

- Use **Prettier** for formatting (enforced by ESLint)
- Avoid `console.log` (use `console.warn` or `console.error` only)
- Prefix unused variables with `_`
- Async functions must handle promises properly
- Mark readonly where appropriate
- Document public APIs with JSDoc

### Working with Turbo

Turborepo caches build outputs. Common cache issues:
```bash
# Clear turbo cache
npm run clean

# Force rebuild without cache
turbo run build --force
```

## Important Notes

### CI/CD and Publishing

- This project uses **Changesets** for version management
- Create changesets with `npm run changeset` for any user-facing changes
- Changesets should describe the change and specify semver bump (major/minor/patch)
- Staggered publish script handles npm rate limits when publishing many packages

### Browser vs Node Packages

- **server-only** backends are in `ai.matey.backend`
- **browser-compatible** backends are in `ai.matey.backend.browser`
- Keep browser-specific code (Chrome AI, etc.) separate to avoid Node.js dependency issues in browser builds

### IR Validation

Always validate IR requests before sending to backend:
```typescript
validateIRChatRequest(irRequest, { frontend: 'openai' });
```

This catches common issues:
- Missing required fields
- Invalid message roles
- Malformed tool definitions
- Content type mismatches

### Error Handling

Use `AdapterError` from `ai.matey.errors`:
```typescript
throw new AdapterError({
  code: ErrorCode.PROVIDER_ERROR,
  message: 'API request failed',
  isRetryable: true,
  provenance: { provider: 'openai', requestId },
  cause: originalError
});
```

Error codes are defined in `ai.matey.errors` package.

### Provenance Tracking

All IR requests and responses include `metadata.provenance` to track:
- Which frontend/backend adapters were used
- Model translations that occurred
- Semantic drift warnings
- Compatibility issues

This is crucial for debugging multi-adapter chains.

## Resources

- **IR Format Spec**: `docs/IR-FORMAT.md` - Complete IR format documentation
- **API Reference**: `docs/API.md` - Full API documentation
- **Examples**: `examples/` directory - Working code examples
- **Feature Guides**: `docs/GUIDES.md` - Parallel dispatch, CLI tools, etc.
- **Roadmap**: `docs/ROADMAP.md` - Future features and plans
