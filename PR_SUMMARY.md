# Monorepo Migration: Modularize ai.matey into Independent Packages

This PR represents a complete architectural transformation of the ai.matey codebase from a monolithic structure to a fully modular npm monorepo with 80+ independently publishable packages.

## Summary

Migrated the entire ai.matey codebase to a monorepo architecture with granular, scoped packages. This enables users to install only what they need, improves maintainability, and makes the library more accessible for specific use cases.

## Key Changes

### 1. **Monorepo Infrastructure** (Phase 0-1)
- Set up npm workspaces with 80+ packages under `packages/`
- Configured Changesets for coordinated publishing
- Added comprehensive TypeScript build configurations (CJS, ESM, types)
- Established consistent package structure across all modules

### 2. **Core Package Extraction**
- **`ai.matey.core`**: Bridge, Router, MiddlewareStack, and core orchestration
- **`ai.matey.types`**: Centralized TypeScript type definitions
- **`ai.matey.errors`**: Error classes and utilities
- **`ai.matey.utils`**: Shared utilities (streaming, validation, caching, etc.)
- **`ai.matey.testing`**: Testing utilities, fixtures, and property testing

### 3. **Backend Adapters** (28 packages)
Extracted individual backend adapters for:
- Major providers: OpenAI, Anthropic, Gemini, Groq, Mistral, Cohere
- Cloud platforms: AWS Bedrock, Azure OpenAI, Cloudflare Workers AI
- Inference platforms: Together AI, Fireworks, Replicate, Perplexity, OpenRouter
- Local/specialized: Ollama, LM Studio, Chrome AI, NVIDIA NIM
- Utilities: Mock adapter, Function adapter, Shared backend utilities

### 4. **Frontend Adapters** (7 packages)
- OpenAI, Anthropic, Gemini, Ollama, Mistral, Chrome AI formats
- **New**: `ai.matey.frontend.generic` for IR passthrough (universal adapter)

### 5. **HTTP Server Integrations** (7 packages)
- Express, Fastify, Hono, Koa, Node.js http, Deno
- Core HTTP utilities with auth, CORS, rate limiting, health checks

### 6. **Middleware** (10 packages)
- Logging, caching, retry, validation, telemetry
- OpenTelemetry integration, cost tracking, security, conversation history

### 7. **React Integration** (4 packages)
- Core hooks (`useChat`, `useCompletion`) with direct backend support
- Additional hooks, streaming components, Next.js App Router integration

### 8. **SDK Wrappers** (6 packages)
- Drop-in replacements for OpenAI SDK, Anthropic SDK
- Chrome AI wrappers (current + legacy)
- **New**: `ai.matey.wrapper.ir` - IR-native chat client
- Dynamic wrapper (`wrapper.anymethod`)

### 9. **Native Backends** (3 packages)
- llama.cpp via Node, Apple MLX, generic model runner

### 10. **CLI Package**
- OpenAI-compatible proxy server
- Ollama CLI emulation
- Request/response format conversion
- Backend adapter template generation

### 11. **Quality & Testing Improvements**
- **Added 188+ new tests** across utilities, streaming, and core modules
- Fixed security vulnerabilities:
  - Timing attack vulnerabilities in authentication
  - Memory leaks in RateLimiter and retry logic
  - Resource leaks in streaming and connection handling
  - Unhandled promise rejections
- Fixed TypeScript strict mode errors
- Improved test execution speed with fake timers

### 12. **New Capabilities**
- **Bridge statistics tracking**: Monitor request counts, latency, error rates
- **Event listener registration**: Hook into Bridge lifecycle events
- **Generic frontend adapter**: Accept IR directly for universal compatibility
- **Function-based backend**: TDD-friendly adapter for custom implementations
- **Shared backend utilities**: Reduced code duplication across adapters
- **Logical completeness**: Filled gaps in Bridge, Router, and Backend functionality

### 13. **Documentation**
- Updated README with comprehensive examples for all use cases
- Added API documentation for all 80+ packages
- Created migration guide (`docs/MIGRATION.md`)
- Added comprehensive npm publishing guide (`docs/PUBLISHING.md`)
- Added monorepo examples directory with 10 end-to-end examples
- Fixed all template placeholders and API mismatches in documentation

### 14. **Developer Experience**
- Deprecated legacy `src/` directory with clear migration path
- Updated all demos to use monorepo packages
- Fixed CLI command examples in documentation
- Renamed files to lowercase conventions (`README.md` → `readme.md`)
- Updated package metadata with proper licenses and links

## Migration Impact

**Before:**
```typescript
import { Bridge, OpenAIBackend } from 'ai.matey';
```

**After (optimized installs):**
```typescript
import { Bridge } from 'ai.matey.core';
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
```

Users can now install only what they need:
- `npm install ai.matey.core ai.matey.backend.openai` (minimal)
- `npm install ai.matey` (umbrella package with all core dependencies)

## Test Coverage

- **Total new tests**: 188+
- **Streaming utilities**: 170 tests
- **Utility modules**: Comprehensive coverage
- **Frontend/Backend adapters**: Integration tests
- **All tests passing** with improved performance

## Breaking Changes

This is a major architectural change. Migration guide provided in `docs/MIGRATION.md` for:
- Import path updates
- Package installation changes
- Staggered rollout strategy for existing users

## Files Changed

- **446 files changed**
- **56,000+ insertions**
- 80+ new packages created
- Core infrastructure files added (Changesets, ESLint, TypeScript configs)

## What's Next

After merge, this enables:
1. Independent versioning and publishing of packages
2. Tree-shaking for optimal bundle sizes
3. Easier contribution (focused PRs on specific packages)
4. Better discoverability (users find exactly what they need)
5. Faster CI/CD (test only affected packages)

---

**Ready for review.** All tests passing, documentation complete, and migration path established.
