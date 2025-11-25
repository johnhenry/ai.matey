# AI.MATEY MONOREPO MIGRATION PLAN

## Executive Summary

This plan details the migration of ai.matey from a single 50K+ line TypeScript package into a fine-grained monorepo with 68 independently publishable packages. The migration uses npm workspaces, Turborepo for build orchestration, and Changesets for version management.

**Key Decisions:**
- **Namespace:** `ai.matey.*`
- **Granularity:** 68 packages (individual per backend adapter, wrapper, React hook, middleware, HTTP adapter)
- **Approach:** Phased migration to reduce risk
- **Tools:** npm workspaces + Turborepo + Changesets
- **Build:** Dual ESM/CJS output per package

---

## 1. Recommended Package Structure (68 Packages)

### 1.1 Package Naming Convention

Following user's suggestion: `ai.matey.*` with descriptive suffixes:
- Core: `ai.matey`, `ai.matey.types`, `ai.matey.errors`
- Backends: `ai.matey.backend.<provider>` (e.g., `ai.matey.backend.openai`)
- Frontend: `ai.matey.frontend.<provider>`
- HTTP Servers: `ai.matey.server.<framework>`
- Middleware: `ai.matey.middleware.<name>`
- Native: `ai.matey.backend.native.<runtime>`
- Utilities: `ai.matey.utils`, `ai.matey.testing`, etc.

### 1.2 Complete Package List (68 packages)

#### Tier 1: Foundation (6 packages) - Build First
1. **ai.matey.types** - All TypeScript type definitions (IRChatRequest, adapters, etc.)
2. **ai.matey.errors** - Error classes and utilities
3. **ai.matey.utils** - Shared utilities (streaming, validation, converters)
4. **ai.matey.core** - Router, bridge, capability matcher, middleware stack
5. **ai.matey.testing** - Test utilities and fixtures
6. **ai.matey** - Main entry point (re-exports + backward compatibility layer)

#### Tier 2: Backend Adapters - HTTP-based (26 packages)
7. **ai.matey.backend.openai** - OpenAI adapter
8. **ai.matey.backend.anthropic** - Anthropic adapter
9. **ai.matey.backend.gemini** - Google Gemini adapter
10. **ai.matey.backend.ollama** - Ollama adapter
11. **ai.matey.backend.mistral** - Mistral AI adapter
12. **ai.matey.backend.cohere** - Cohere adapter
13. **ai.matey.backend.ai21** - AI21 Labs adapter
14. **ai.matey.backend.azure-openai** - Azure OpenAI adapter
15. **ai.matey.backend.deepinfra** - DeepInfra adapter
16. **ai.matey.backend.xai** - xAI (Grok) adapter
17. **ai.matey.backend.huggingface** - HuggingFace adapter
18. **ai.matey.backend.deepseek** - DeepSeek adapter
19. **ai.matey.backend.fireworks** - Fireworks AI adapter
20. **ai.matey.backend.groq** - Groq adapter
21. **ai.matey.backend.aws-bedrock** - AWS Bedrock adapter
22. **ai.matey.backend.cloudflare** - Cloudflare Workers AI adapter
23. **ai.matey.backend.perplexity** - Perplexity adapter
24. **ai.matey.backend.anyscale** - Anyscale adapter
25. **ai.matey.backend.replicate** - Replicate adapter
26. **ai.matey.backend.openrouter** - OpenRouter adapter
27. **ai.matey.backend.lmstudio** - LM Studio adapter
28. **ai.matey.backend.together-ai** - Together AI adapter
29. **ai.matey.backend.cerebras** - Cerebras adapter
30. **ai.matey.backend.nvidia** - NVIDIA NIM adapter
31. **ai.matey.backend.chrome-ai** - Chrome AI (Backend) adapter
32. **ai.matey.backend.mock** - Mock adapter for testing

#### Tier 3: Frontend Adapters (6 packages)
33. **ai.matey.frontend.openai** - OpenAI frontend format
34. **ai.matey.frontend.anthropic** - Anthropic frontend format
35. **ai.matey.frontend.gemini** - Gemini frontend format
36. **ai.matey.frontend.ollama** - Ollama frontend format
37. **ai.matey.frontend.mistral** - Mistral frontend format
38. **ai.matey.frontend.chrome-ai** - Chrome AI frontend

#### Tier 4: Backend Native Adapters (3 packages)
39. **ai.matey.backend.native.apple** - Apple Foundation Models (macOS)
40. **ai.matey.backend.native.llamacpp** - node-llama-cpp integration
41. **ai.matey.backend.native.runners** - Model runner utilities

#### Tier 5: HTTP Server Adapters (6 packages)
42. **ai.matey.server.node** - Node.js HTTP server
43. **ai.matey.server.express** - Express.js middleware
44. **ai.matey.server.koa** - Koa middleware
45. **ai.matey.server.hono** - Hono middleware
46. **ai.matey.server.fastify** - Fastify plugin
47. **ai.matey.server.deno** - Deno server adapter

#### Tier 6: Middleware (10 packages)
48. **ai.matey.middleware.logging** - Logging middleware
49. **ai.matey.middleware.telemetry** - Basic telemetry
50. **ai.matey.middleware.opentelemetry** - OpenTelemetry integration
51. **ai.matey.middleware.caching** - Response caching
52. **ai.matey.middleware.retry** - Retry logic with backoff
53. **ai.matey.middleware.transform** - Request/response transforms
54. **ai.matey.middleware.conversation-history** - Conversation management
55. **ai.matey.middleware.security** - Security validations
56. **ai.matey.middleware.cost-tracking** - Cost calculation
57. **ai.matey.middleware.validation** - Input validation and PII detection

#### Tier 7: Wrappers (6 packages)
58. **ai.matey.wrapper.openai-sdk** - OpenAI SDK wrapper
59. **ai.matey.wrapper.anthropic-sdk** - Anthropic SDK wrapper
60. **ai.matey.wrapper.chrome-ai** - Chrome AI wrapper
61. **ai.matey.wrapper.chrome-ai-legacy** - Legacy Chrome AI wrapper
62. **ai.matey.wrapper.anymethod** - Generic method wrapper
63. **ai.matey.wrappers** - Optional meta package re-exporting all wrappers

#### Tier 8: React Hooks (4 packages)
64. **ai.matey.react.use-chat** - useChat hook
65. **ai.matey.react.use-completion** - useCompletion hook
66. **ai.matey.react.use-object** - useObject hook
67. **ai.matey.react** - Meta package re-exporting all React hooks + shared types

#### Tier 9: Utilities (3 packages)
68. **ai.matey.structured** - Structured output (Zod integration)
69. **ai.matey.profiler** - Performance profiling
70. **ai.matey.debug** - Debug utilities

#### Tier 10: CLI (1 package)
71. **ai.matey.cli** - Command-line interface + Ollama utils

#### Tier 11: Meta Package (1 package)
72. **ai.matey.all** - Optional convenience package with dependencies on all other packages

**Total: 68 packages**

**Note**: `ai.matey` (Tier 1, #6) serves as the main backward-compatible re-export package, while `ai.matey.all` (Tier 11, #72) is an optional convenience installer that brings in all packages as dependencies.

### 1.3 Dependency Graph (Simplified)

```
ai.matey.types (no deps)
    ↓
ai.matey.errors (deps: types)
    ↓
ai.matey.utils (deps: types, errors)
    ↓
ai.matey.core (deps: types, errors, utils)
    ↓
┌─────────────────────┬──────────────────┬────────────────┬────────────────┐
↓                     ↓                  ↓                ↓                ↓
backends            frontends         middleware      servers         wrappers
(deps: core)        (deps: core)      (deps: core)   (deps: core)   (deps: core/types)
    ↓                                       ↓
react hooks                              utilities
(deps: core)                            (deps: core)
    ↓                                       ↓
    └───────────────────┬───────────────────┘
                        ↓
                   ai.matey (re-exports all for backward compat)
                        ↓
                   ai.matey.all (optional meta installer)
```

---

## 2. Directory Structure

### 2.1 Root Structure

```
ai.matey/
├── package.json                 # Root workspace config
├── turbo.json                   # Turborepo pipeline config
├── tsconfig.base.json           # Base TypeScript config (shared)
├── vitest.workspace.ts          # Vitest workspace config
├── .changeset/
│   └── config.json              # Changesets config
├── .github/
│   └── workflows/
│       ├── ci.yml               # Updated CI workflow
│       └── release.yml          # Changesets release workflow
├── packages/
│   ├── ai.matey.types/          # Tier 1: Foundation
│   ├── ai.matey.errors/
│   ├── ai.matey.utils/
│   ├── ai.matey.core/
│   ├── ai.matey.testing/
│   ├── ai.matey/                # Main entry (re-exports)
│   │
│   ├── backend-openai/          # Tier 2: Backend adapters
│   ├── backend-anthropic/
│   ├── backend-gemini/
│   ├── backend-ollama/
│   ├── ...                      # (32 total backend packages)
│   │
│   ├── frontend-openai/         # Tier 3: Frontend adapters
│   ├── frontend-anthropic/
│   ├── ...                      # (6 total frontend packages)
│   │
│   ├── backend-native-apple/    # Tier 4: Native backends
│   ├── backend-native-llamacpp/
│   ├── backend-native-runners/
│   │
│   ├── server-node/             # Tier 5: HTTP servers
│   ├── server-express/
│   ├── server-koa/
│   ├── ...                      # (6 total server packages)
│   │
│   ├── middleware-logging/      # Tier 6: Middleware
│   ├── middleware-caching/
│   ├── ...                      # (10 total middleware packages)
│   │
│   ├── wrappers/                # Tier 7: Wrappers
│   ├── react/
│   ├── structured/
│   ├── profiler/
│   ├── debug/
│   │
│   ├── cli/                     # Tier 8: CLI
│   │
│   └── ai.matey.all/            # Tier 9: Meta package
│
├── docs/                        # Existing docs
├── examples/                    # Examples for all packages
└── scripts/
    ├── migrate-phase-1.sh       # Migration automation
    ├── migrate-phase-2.sh
    ├── extract-backend.sh
    ├── extract-frontend.sh
    └── validate-migration.sh
```

### 2.2 Individual Package Structure

Each package follows this pattern:

```
packages/backend-openai/         # Example: ai.matey.backend.openai
├── package.json                 # Package metadata
├── tsconfig.json                # Extends tsconfig.base.json
├── tsconfig.esm.json            # ESM build config
├── tsconfig.cjs.json            # CJS build config
├── tsconfig.types.json          # Type declarations config
├── src/
│   ├── index.ts                 # Main entry point
│   └── ...                      # Source files
├── tests/
│   ├── unit/
│   └── integration/
├── dist/
│   ├── esm/                     # ESM output
│   ├── cjs/                     # CJS output
│   └── types/                   # Type declarations
├── README.md                    # Package documentation
└── CHANGELOG.md                 # Auto-generated by Changesets
```

### 2.3 Shared Configs Location

```
root/
├── tsconfig.base.json           # Shared TypeScript config
├── vitest.workspace.ts          # Shared test config
├── .eslintrc.json               # Shared ESLint config (move from root)
├── prettier.config.js           # Shared Prettier config
└── turbo.json                   # Turborepo pipeline
```

### 2.4 Test Organization

**Approach: Co-located tests** (Recommended)
```
packages/backend-openai/
├── src/
│   └── index.ts
└── tests/
    ├── unit/
    └── integration/
```

Use this approach - keeps tests close to source, easier to maintain.

---

## 3. Migration Steps (Phased Approach)

### Phase 0: Preparation

1. **Create feature branch:**
   ```bash
   cd /Users/johnhenry/Projects/ai.matey
   git checkout -b feat/monorepo-migration
   ```

2. **Backup current state:**
   ```bash
   git tag pre-monorepo-backup
   ```

3. **Install tooling:**
   ```bash
   npm install -D turbo@latest @changesets/cli@latest
   npx changeset init
   ```

4. **Create root structure:**
   ```bash
   mkdir -p packages scripts
   ```

5. **Create shared configs** (see Section 4 for file contents):
   - `tsconfig.base.json`
   - `turbo.json`
   - `.changeset/config.json`
   - `vitest.workspace.ts`

6. **Update root package.json** to enable workspaces

### Phase 1: Foundation Packages

**Goal:** Extract core types, errors, utils, and core logic into independent packages.

1. **Create Tier 1 packages in dependency order:**

   a. **ai.matey.types** (no dependencies)
   ```bash
   mkdir -p packages/ai.matey.types/src
   cp -r src/types/* packages/ai.matey.types/src/
   # Create package.json, tsconfig files
   ```

   b. **ai.matey.errors** (depends on types)
   ```bash
   mkdir -p packages/ai.matey.errors/src
   cp -r src/errors/* packages/ai.matey.errors/src/
   # Update imports to use ai.matey.types
   ```

   c. **ai.matey.utils** (depends on types, errors)
   ```bash
   mkdir -p packages/ai.matey.utils/src
   cp -r src/utils/* packages/ai.matey.utils/src/
   # Update imports
   ```

   d. **ai.matey.core** (depends on types, errors, utils)
   ```bash
   mkdir -p packages/ai.matey.core/src
   cp -r src/core/* packages/ai.matey.core/src/
   # Update imports
   ```

   e. **ai.matey.testing** (depends on types, utils)
   ```bash
   mkdir -p packages/ai.matey.testing/src
   cp -r src/testing/* packages/ai.matey.testing/src/
   ```

   f. **ai.matey** (main package - re-exports everything)
   ```bash
   mkdir -p packages/ai.matey/src
   # Create index.ts that re-exports from all packages
   ```

2. **Update imports across all packages:**
   - Replace `../../types/` → `ai.matey.types`
   - Replace `../../errors/` → `ai.matey.errors`
   - Replace `../../utils/` → `ai.matey.utils`
   - Replace `../../core/` → `ai.matey.core`

3. **Build and test:**
   ```bash
   npm run build --workspace=packages/ai.matey.types
   npm run build --workspace=packages/ai.matey.errors
   npm run build --workspace=packages/ai.matey.utils
   npm run build --workspace=packages/ai.matey.core
   npm run build --workspace=packages/ai.matey.testing
   npm run build --workspace=packages/ai.matey
   
   # Run tests
   npm test --workspace=packages/ai.matey.types
   # ... repeat for all packages
   ```

4. **Commit Phase 1:**
   ```bash
   git add packages/ai.matey.types packages/ai.matey.errors packages/ai.matey.utils \
           packages/ai.matey.core packages/ai.matey.testing packages/ai.matey
   git commit -m "Phase 1: Extract foundation packages"
   ```

### Phase 2: Backend Adapters

**Goal:** Extract all 32 backend adapters into individual packages.

1. **Create script to automate backend extraction** (see Appendix B)

2. **Extract backends in batches:**

   **Batch 1: Major providers** (highest priority)
   ```bash
   ./scripts/extract-backend.sh openai
   ./scripts/extract-backend.sh anthropic
   ./scripts/extract-backend.sh gemini
   ./scripts/extract-backend.sh ollama
   # Test and build
   ```

   **Batch 2: Popular providers**
   ```bash
   ./scripts/extract-backend.sh mistral
   ./scripts/extract-backend.sh cohere
   ./scripts/extract-backend.sh groq
   ./scripts/extract-backend.sh deepseek
   # Test and build
   ```

   **Batch 3: Remaining providers** (all others)
   ```bash
   # Run extract-backend.sh for all remaining providers
   ```

3. **Handle special cases:**
   - `mock.ts` → `ai.matey.backend.mock`
   - `chrome-ai.ts` → `ai.matey.backend.chrome-ai`

4. **Build and test:**
   ```bash
   turbo run build --filter='./packages/backend-*'
   turbo run test --filter='./packages/backend-*'
   ```

5. **Commit Phase 2:**
   ```bash
   git add packages/backend-*
   git commit -m "Phase 2: Extract backend adapters"
   ```

### Phase 3: Frontend Adapters

**Goal:** Extract 6 frontend adapters.

```bash
# Similar to backend extraction
./scripts/extract-frontend.sh openai
./scripts/extract-frontend.sh anthropic
./scripts/extract-frontend.sh gemini
./scripts/extract-frontend.sh ollama
./scripts/extract-frontend.sh mistral
./scripts/extract-frontend.sh chrome-ai

turbo run build --filter='./packages/frontend-*'
turbo run test --filter='./packages/frontend-*'

git add packages/frontend-*
git commit -m "Phase 3: Extract frontend adapters"
```

### Phase 4: Native Backends

**Goal:** Extract 3 native backend packages.

```bash
mkdir -p packages/backend-native-apple/src
mkdir -p packages/backend-native-llamacpp/src
mkdir -p packages/backend-native-runners/src

# Move files
cp src/adapters/backend-native/apple.ts packages/backend-native-apple/src/index.ts
cp src/adapters/backend-native/node-llamacpp.ts packages/backend-native-llamacpp/src/index.ts
cp -r src/adapters/backend-native/model-runners/* packages/backend-native-runners/src/

# Update peerDependencies carefully
# apple-foundation-models → backend-native-apple
# node-llama-cpp → backend-native-llamacpp

turbo run build --filter='./packages/backend-native-*'
git add packages/backend-native-*
git commit -m "Phase 4: Extract native backends"
```

### Phase 5: HTTP Server Adapters

**Goal:** Extract 6 HTTP server packages.

```bash
mkdir -p packages/server-{node,express,koa,hono,fastify,deno}/src

# Move files from src/http/adapters/* to respective packages
cp -r src/http/adapters/node/* packages/server-node/src/
cp -r src/http/adapters/express/* packages/server-express/src/
cp -r src/http/adapters/koa/* packages/server-koa/src/
cp -r src/http/adapters/hono/* packages/server-hono/src/
cp -r src/http/adapters/fastify/* packages/server-fastify/src/
cp -r src/http/adapters/deno/* packages/server-deno/src/

# Update peerDependencies
# express → server-express package.json
# koa → server-koa package.json
# etc.

turbo run build --filter='./packages/server-*'
git add packages/server-*
git commit -m "Phase 5: Extract HTTP server adapters"
```

### Phase 6: Middleware

**Goal:** Extract 10 middleware packages.

```bash
# Extract each middleware
mkdir -p packages/middleware-{logging,telemetry,opentelemetry,caching,retry,transform,conversation-history,security,cost-tracking,validation}/src

cp src/middleware/logging.ts packages/middleware-logging/src/index.ts
cp src/middleware/telemetry.ts packages/middleware-telemetry/src/index.ts
cp src/middleware/opentelemetry.ts packages/middleware-opentelemetry/src/index.ts
cp src/middleware/caching.ts packages/middleware-caching/src/index.ts
cp src/middleware/retry.ts packages/middleware-retry/src/index.ts
cp src/middleware/transform.ts packages/middleware-transform/src/index.ts
cp src/middleware/conversation-history.ts packages/middleware-conversation-history/src/index.ts
cp src/middleware/security.ts packages/middleware-security/src/index.ts
cp src/middleware/cost-tracking.ts packages/middleware-cost-tracking/src/index.ts
cp src/middleware/validation.ts packages/middleware-validation/src/index.ts

# Handle OpenTelemetry special case (optional peer dependencies)
# Update middleware-opentelemetry/package.json with peerDependencies

turbo run build --filter='./packages/middleware-*'
git add packages/middleware-*
git commit -m "Phase 6: Extract middleware packages"
```

### Phase 7: Wrappers

**Goal:** Extract 6 wrapper packages.

```bash
# Extract individual wrappers
mkdir -p packages/wrapper-{openai-sdk,anthropic-sdk,chrome-ai,chrome-ai-legacy,anymethod}/src

cp src/wrappers/openai-sdk.ts packages/wrapper-openai-sdk/src/index.ts
cp src/wrappers/anthropic-sdk.ts packages/wrapper-anthropic-sdk/src/index.ts
cp src/wrappers/chrome-ai.ts packages/wrapper-chrome-ai/src/index.ts
cp src/wrappers/chrome-ai-legacy.ts packages/wrapper-chrome-ai-legacy/src/index.ts
cp src/wrappers/anymethod.ts packages/wrapper-anymethod/src/index.ts

# Create meta wrappers package
mkdir -p packages/wrappers/src
# Create index.ts that re-exports all wrappers

turbo run build --filter='./packages/wrapper-*'
turbo run build --filter='./packages/wrappers'
git add packages/wrapper-* packages/wrappers
git commit -m "Phase 7: Extract wrapper packages"
```

### Phase 8: React Hooks

**Goal:** Extract 4 React packages.

```bash
# Extract individual hooks
mkdir -p packages/react-{use-chat,use-completion,use-object}/src

cp src/react/use-chat.ts packages/react-use-chat/src/index.ts
cp src/react/use-completion.ts packages/react-use-completion/src/index.ts
cp src/react/use-object.ts packages/react-use-object/src/index.ts

# Create meta React package with shared types
mkdir -p packages/react/src
cp src/react/types.ts packages/react/src/types.ts
# Create index.ts that re-exports all hooks

# Handle peerDependencies: react, react-dom

turbo run build --filter='./packages/react-*'
turbo run build --filter='./packages/react'
git add packages/react-* packages/react
git commit -m "Phase 8: Extract React hook packages"
```

### Phase 9: Utilities

**Goal:** Extract utility packages.

```bash
mkdir -p packages/{structured,profiler,debug}/src

cp -r src/structured/* packages/structured/src/
cp -r src/profiler/* packages/profiler/src/
cp -r src/debug/* packages/debug/src/

# Handle peerDependencies
# structured package: peerDeps on zod, zod-to-json-schema

turbo run build --filter='./packages/{structured,profiler,debug}'
git add packages/structured packages/profiler packages/debug
git commit -m "Phase 9: Extract utility packages"
```

### Phase 10: CLI

**Goal:** Extract CLI package.

```bash
mkdir -p packages/cli/{src,bin}

cp -r src/cli/* packages/cli/src/
cp bin/ai-matey packages/cli/bin/

# Update packages/cli/package.json with bin entry
# "bin": { "ai-matey": "./bin/ai-matey" }

turbo run build --filter='./packages/cli'
git add packages/cli
git commit -m "Phase 10: Extract CLI package"
```

### Phase 11: Main Package & Meta Package

**Goal:** Create main re-export package and optional convenience meta package.

1. **Update ai.matey package** (already created in Phase 1, now flesh out to re-export everything)

2. **Create ai.matey.all meta package (optional):**
   ```bash
   mkdir -p packages/ai.matey.all
   # Create package.json with dependencies on all other packages
   # No exports - just a convenience installer
   ```

**Note on ai.matey vs ai.matey.all:**
- `ai.matey`: Re-exports everything for backward compatibility
- `ai.matey.all`: Optional package with dependencies on all packages (convenience installer)
- Consider keeping only `ai.matey` unless there's strong need for `ai.matey.all`

3. **Build and test:**
   ```bash
   turbo run build
   npm test
   ```

4. **Commit Phase 11:**
   ```bash
   git add packages/ai.matey packages/ai.matey.all
   git commit -m "Phase 11: Finalize main and meta packages"
   ```

### Phase 12: Cleanup & Documentation

1. **Remove old src/ directory:**
   ```bash
   # Verify everything works first!
   npm run build
   npm test

   # Then remove
   rm -rf src/
   ```

2. **Update root README.md** with monorepo structure

3. **Create migration guide** in docs/MIGRATION_GUIDE.md

4. **Update examples** to use new package structure

5. **Final commit:**
   ```bash
   git add -A
   git commit -m "Phase 12: Complete monorepo migration"
   git push origin feat/monorepo-migration
   ```

### Phase 13: Testing & Validation

1. **Run full CI pipeline:**
   ```bash
   turbo run lint
   turbo run typecheck
   turbo run test
   turbo run build
   ```

2. **Test package installation:**
   ```bash
   mkdir /tmp/test-install
   cd /tmp/test-install
   npm init -y
   npm install /Users/johnhenry/Projects/ai.matey/packages/backend-openai
   ```

3. **Validate examples work**

4. **Create release PR:**
   ```bash
   # Create PR: feat/monorepo-migration → main
   ```

---

## 4. Configuration Files

### 4.1 Root package.json

```json
{
  "name": "ai.matey-monorepo",
  "version": "0.0.0",
  "private": true,
  "description": "AI Matey Monorepo - Universal AI Adapter System",
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "build:esm": "turbo run build:esm",
    "build:cjs": "turbo run build:cjs",
    "build:types": "turbo run build:types",
    "clean": "turbo run clean && rm -rf node_modules/.cache",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "format": "prettier --write \"packages/*/src/**/*.ts\"",
    "format:check": "prettier --check \"packages/*/src/**/*.ts\"",
    "test": "turbo run test",
    "test:watch": "turbo run test:watch",
    "test:coverage": "turbo run test:coverage",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "turbo run build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "@types/node": "^24.7.2",
    "@typescript-eslint/eslint-plugin": "^8.46.1",
    "@typescript-eslint/parser": "^8.46.1",
    "@vitest/coverage-v8": "^3.2.4",
    "eslint": "^9.37.0",
    "eslint-config-prettier": "^10.1.8",
    "eslint-plugin-prettier": "^5.5.4",
    "prettier": "^3.6.2",
    "turbo": "^2.0.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  },
  "packageManager": "npm@10.0.0"
}
```

### 4.2 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    "tsconfig.base.json",
    ".eslintrc.json",
    "prettier.config.js"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "cache": true
    },
    "build:esm": {
      "dependsOn": ["^build:esm"],
      "outputs": ["dist/esm/**"],
      "cache": true
    },
    "build:cjs": {
      "dependsOn": ["^build:cjs"],
      "outputs": ["dist/cjs/**"],
      "cache": true
    },
    "build:types": {
      "dependsOn": ["^build:types"],
      "outputs": ["dist/types/**"],
      "cache": true
    },
    "clean": {
      "cache": false
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": [],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "lint:fix": {
      "outputs": [],
      "cache": false
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "test:watch": {
      "cache": false,
      "persistent": true
    },
    "test:coverage": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  },
  "remoteCache": {
    "enabled": false
  }
}
```

### 4.3 .changeset/config.json

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
    "onlyUpdatePeerDependentsWhenOutOfRange": true
  }
}
```

### 4.4 tsconfig.base.json (Shared)

```json
{
  "compilerOptions": {
    /* Language and Environment */
    "target": "ES2022",
    "lib": ["ES2022"],

    /* Modules */
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,

    /* Emit */
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": false,
    "importHelpers": false,
    "downlevelIteration": true,

    /* Interop Constraints */
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,

    /* Type Checking */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": false,
    "noPropertyAccessFromIndexSignature": false,
    "exactOptionalPropertyTypes": false,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    /* Completeness */
    "skipLibCheck": true
  },
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

### 4.5 Individual Package tsconfig.json (Example)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": [
    "node_modules",
    "dist",
    "tests"
  ]
}
```

### 4.6 Individual Package tsconfig.esm.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/esm",
    "declaration": false,
    "declarationMap": false
  }
}
```

### 4.7 Individual Package tsconfig.cjs.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist/cjs",
    "declaration": false,
    "declarationMap": false
  }
}
```

### 4.8 Individual Package tsconfig.types.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/types",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true
  }
}
```

### 4.9 Individual Package package.json (Example: backend-openai)

```json
{
  "name": "ai.matey.backend.openai",
  "version": "1.0.0",
  "description": "OpenAI backend adapter for AI Matey",
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    }
  },
  "files": [
    "dist",
    "README.md",
    "CHANGELOG.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "npm run build:esm && npm run build:cjs && npm run build:types",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "build:types": "tsc -p tsconfig.types.json",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ai.matey.types": "workspace:*",
    "ai.matey.errors": "workspace:*",
    "ai.matey.utils": "workspace:*",
    "ai.matey.core": "workspace:*"
  },
  "peerDependencies": {},
  "devDependencies": {
    "ai.matey.testing": "workspace:*",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  },
  "keywords": [
    "ai",
    "llm",
    "openai",
    "adapter",
    "ai-matey"
  ],
  "author": "AI Matey",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/johnhenry/ai.matey.git",
    "directory": "packages/backend-openai"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 4.10 vitest.workspace.ts

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
]);
```

### 4.11 Individual Package vitest.config.ts

```typescript
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
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
});
```

---

## 5. CI/CD Updates

### 5.1 Updated .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main, develop, feat/monorepo-migration]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Check formatting
        run: npm run format:check

  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run type check
        run: npm run typecheck

  test:
    name: Test (Node ${{ matrix.node-version }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Generate coverage report
        if: matrix.node-version == 20
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        if: matrix.node-version == 20
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build all packages
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: packages/*/dist/
          retention-days: 7

  all-checks:
    name: All Checks Passed
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test, build]
    steps:
      - name: All checks passed
        run: echo "All CI checks passed successfully!"
```

### 5.2 New .github/workflows/release.yml (Changesets)

```yaml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: npm run release
          version: npm run version-packages
          commit: 'chore: version packages'
          title: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 6. Critical Decisions & Rationale

### 6.1 Package Granularity

**Decision:** Individual packages per adapter/middleware (64 packages)

**Rationale:**
- Users can install only what they need (e.g., only `ai.matey.backend.openai`)
- Smaller bundle sizes for end applications
- Clear dependency boundaries
- Independent versioning per adapter
- Easier to deprecate/remove providers

**Trade-offs:**
- More packages to manage
- More complex dependency graph
- Mitigated by: Turborepo automation, clear naming convention

### 6.2 Namespace Convention

**Decision:** Use `ai.matey.*` prefix (NOT `@ai-matey/`)

**Rationale:**
- User explicitly requested this pattern
- Avoids npm scope setup requirements
- Consistent with user's existing preferences

### 6.3 TypeScript Configuration

**Decision:** Shared base config + per-package overrides

**Structure:**
```
tsconfig.base.json (root) - shared settings
  ↓ extends
packages/*/tsconfig.json - package-specific settings
  ↓ extends
packages/*/tsconfig.{esm,cjs,types}.json - build-specific
```

**Rationale:**
- DRY - don't repeat common settings
- Flexibility - packages can override if needed
- Clear hierarchy

### 6.4 CLI Binary Handling

**Decision:** CLI package includes bin/ directory with executable

**Implementation:**
```json
// packages/cli/package.json
{
  "bin": {
    "ai-matey": "./bin/ai-matey"
  }
}
```

**Rationale:**
- Keeps CLI self-contained
- Standard npm bin/ pattern
- No special setup required

### 6.5 Test Organization

**Decision:** Co-located tests (tests/ alongside src/ in each package)

**Rationale:**
- Tests stay with code they test
- Easier to maintain
- Clear ownership
- Standard practice

### 6.6 Dual ESM/CJS Output

**Decision:** Keep dual output per package

**Rationale:**
- Backward compatibility with CJS projects
- Modern ESM support
- Follows current convention
- Each package builds independently

### 6.7 Dependency Management

**Decision:** Workspace protocol (`workspace:*`) for internal dependencies

**Example:**
```json
{
  "dependencies": {
    "ai.matey.types": "workspace:*",
    "ai.matey.errors": "workspace:*"
  }
}
```

**Rationale:**
- Always uses latest local version during development
- Automatically resolves to real versions on publish
- Prevents version mismatches

### 6.8 PeerDependencies Strategy

**Decision:** Keep optional peerDependencies in relevant packages

**Examples:**
- `ai.matey.server.express` → peerDeps: `express`
- `ai.matey.middleware.opentelemetry` → peerDeps: OpenTelemetry packages
- `ai.matey.backend.native.apple` → peerDeps: `apple-foundation-models`

**Rationale:**
- Users only install what they need
- Avoids bloating package installations
- Clear optional dependency markers

---

## 7. Risk Mitigation

### 7.1 Potential Risks

1. **Import path breakage**
   - Risk: Existing code breaks when imports change
   - Mitigation: Create `ai.matey` meta package that re-exports everything for backward compatibility

2. **Circular dependencies**
   - Risk: Package A depends on B which depends on A
   - Mitigation: Clear dependency hierarchy (types → errors → utils → core → adapters)

3. **Build order issues**
   - Risk: Package builds fail due to missing dependencies
   - Mitigation: Turborepo's `dependsOn` ensures correct build order

4. **Test failures during migration**
   - Risk: Tests break when moving files
   - Mitigation: Phased approach - test after each phase

5. **Publish failures**
   - Risk: Package publishes fail due to misconfiguration
   - Mitigation: Test local installs before publishing

6. **Version drift**
   - Risk: Internal packages get out of sync
   - Mitigation: Changesets handles versioning automatically

7. **Documentation outdated**
   - Risk: Docs reference old import paths
   - Mitigation: Update docs in Phase 10, create migration guide

### 7.2 Validation Strategy

After each phase:

```bash
# 1. Clean build from scratch
rm -rf packages/*/dist packages/*/node_modules node_modules
npm install
npm run build

# 2. Type checking
npm run typecheck

# 3. Linting
npm run lint

# 4. Tests
npm test

# 5. Test local installation
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install /Users/johnhenry/Projects/ai.matey/packages/backend-openai
node -e "const {OpenAIBackendAdapter} = require('ai.matey.backend.openai'); console.log(OpenAIBackendAdapter)"
```

### 7.3 Rollback Strategy

If migration fails:

1. **During development:**
   ```bash
   git checkout main
   git branch -D feat/monorepo-migration
   git checkout -b feat/monorepo-migration-v2
   # Start over from specific phase
   ```

2. **If merged and broken:**
   ```bash
   git revert <merge-commit-sha>
   # Or restore from pre-monorepo-backup tag
   git checkout pre-monorepo-backup
   git checkout -b hotfix/restore-single-package
   ```

---

## 8. Testing Strategy

### Test Migration Approach

**Goal**: Preserve all existing test coverage while adapting tests to the new package structure.

### Current Test Structure
```
tests/
├── unit/                    # 7 test files - unit tests for specific modules
├── core/                    # 5 test files - core router & capability tests
├── integration/             # 3 test files - streaming, middleware, HTTP
├── contracts/               # 1 test file - provider contract tests
├── http/adapters/           # 5 test files - HTTP framework adapter tests
├── performance/             # 1 test file - performance benchmarks
├── manual/                  # 1 test file - real API tests (not run in CI)
└── structured-output.test.ts
```

**Total: 24 test files across 8 categories**

### Test Migration Strategy

#### 8.1 Co-locate Tests with Packages
Each package should have its own test directory:

```
packages/backend-openai/
├── src/
│   └── index.ts
└── tests/
    ├── unit/
    └── integration/
```

#### 8.2 Test Migration Per Phase

**During each extraction phase:**
1. Identify tests that cover the extracted code
2. Move tests to the new package's `tests/` directory
3. Update imports from relative paths to package names
4. Run tests to ensure they pass
5. **CRITICAL**: Only proceed to next package if tests pass

**Example for Phase 2 (Backend Adapters):**
```bash
# Extract backend-openai package
./scripts/extract-backend.sh openai

# Find and move related tests
grep -r "openai" tests/ --files-with-matches
# Move relevant test files to packages/backend-openai/tests/

# Update imports in tests
# Before: import { OpenAIAdapter } from '../../src/adapters/backend/openai'
# After:  import { OpenAIAdapter } from 'ai.matey.backend.openai'

# Run tests for this package
npm test --workspace=ai.matey.backend.openai

# ✓ Tests must pass before proceeding
```

#### 8.3 Integration Test Package

Create a dedicated integration test package:

```
packages/integration-tests/
├── package.json            # Private package, not published
├── tests/
│   ├── cross-package/
│   │   ├── router-with-adapters.test.ts
│   │   ├── middleware-stack.test.ts
│   │   └── end-to-end.test.ts
│   └── contracts/
│       └── provider-contracts.test.ts
└── vitest.config.ts
```

**Integration test dependencies:**
```json
{
  "name": "ai.matey.integration-tests",
  "version": "0.0.0",
  "private": true,
  "dependencies": {
    "ai.matey.core": "workspace:*",
    "ai.matey.backend.openai": "workspace:*",
    "ai.matey.backend.anthropic": "workspace:*",
    "ai.matey.middleware.caching": "workspace:*",
    "ai.matey.middleware.retry": "workspace:*",
    "ai.matey.server.express": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "express": "^5.0.0"
  }
}
```

#### 8.4 Test Categories by Package

**Foundation Packages (Tier 1):**
- `ai.matey.types`: Type validation tests
- `ai.matey.errors`: Error class tests
- `ai.matey.utils`: Utility function tests (parameter-normalizer.test.ts)
- `ai.matey.core`: Router, capability matcher, model translation tests
  - tests/core/router-translation.test.ts → packages/ai.matey.core/tests/
  - tests/core/capability-matcher.test.ts → packages/ai.matey.core/tests/
  - tests/unit/router.test.ts → packages/ai.matey.core/tests/
- `ai.matey.testing`: Fixture system tests
  - tests/unit/fixture-system.test.ts → packages/ai.matey.testing/tests/

**Backend Adapters (Tier 2):**
- Split tests/unit/backend-adapters.test.ts by provider
- Move contract tests from tests/contracts/provider-contracts.test.ts to integration-tests

**HTTP Servers (Tier 5):**
- tests/http/adapters/express.test.ts → packages/server-express/tests/
- tests/http/adapters/koa.test.ts → packages/server-koa/tests/
- tests/http/adapters/hono.test.ts → packages/server-hono/tests/
- tests/http/adapters/fastify.test.ts → packages/server-fastify/tests/
- tests/http/adapters/deno.test.ts → packages/server-deno/tests/
- tests/integration/http-listener.test.ts → packages/integration-tests/

**Middleware (Tier 6):**
- tests/unit/cost-tracking-middleware.test.ts → packages/middleware-cost-tracking/tests/
- tests/unit/validation-middleware.test.ts → packages/middleware-validation/tests/
- tests/integration/middleware.test.ts → packages/integration-tests/

**Wrappers (Tier 7):**
- Split tests/unit/sdk-wrappers.test.ts by wrapper type

**Structured Output:**
- tests/structured-output.test.ts → packages/structured/tests/
- tests/performance/structured-output-perf.test.ts → packages/structured/tests/performance/

**Integration Tests:**
- tests/integration/streaming.test.ts → packages/integration-tests/tests/
- tests/integration/middleware.test.ts → packages/integration-tests/tests/
- tests/integration/http-listener.test.ts → packages/integration-tests/tests/

#### 8.5 Backward Compatibility Tests

Create a test suite in the main `ai.matey` package to ensure backward compatibility:

```typescript
// packages/ai.matey/tests/backward-compatibility.test.ts
import { describe, it, expect } from 'vitest';

describe('Backward Compatibility', () => {
  it('should re-export all backend adapters', () => {
    const { OpenAIAdapter, AnthropicAdapter, GeminiAdapter } = require('ai.matey');
    expect(OpenAIAdapter).toBeDefined();
    expect(AnthropicAdapter).toBeDefined();
    expect(GeminiAdapter).toBeDefined();
  });

  it('should support old Router import', () => {
    const { Router } = require('ai.matey');
    const router = new Router();
    expect(router).toBeDefined();
  });

  it('should re-export middleware', () => {
    const { loggingMiddleware, cachingMiddleware } = require('ai.matey/middleware');
    expect(loggingMiddleware).toBeDefined();
    expect(cachingMiddleware).toBeDefined();
  });

  it('should re-export HTTP adapters', () => {
    const { createExpressMiddleware } = require('ai.matey/http/express');
    expect(createExpressMiddleware).toBeDefined();
  });

  // Test all major exports match old package.json exports structure
});
```

#### 8.6 Test Execution Strategy

**Local Development:**
```bash
# Test specific package
turbo run test --filter=ai.matey.backend.openai

# Test all packages
turbo run test

# Test only changed packages
turbo run test --filter=[HEAD^1]

# Run integration tests
npm test --workspace=ai.matey.integration-tests

# Generate coverage
turbo run test:coverage
```

**CI/CD Strategy:**
```yaml
# .github/workflows/ci.yml (updated)
test:
  name: Test (Node ${{ matrix.node-version }})
  runs-on: ubuntu-latest
  strategy:
    matrix:
      node-version: [18, 20, 22]
      test-suite: [unit, integration, contracts]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node-version }}

    - run: npm ci
    - run: npm run build

    # Unit tests - all packages except integration-tests
    - name: Run unit tests
      if: matrix.test-suite == 'unit'
      run: turbo run test --filter='./packages/*' --filter='!./packages/integration-tests'

    # Integration tests - cross-package functionality
    - name: Run integration tests
      if: matrix.test-suite == 'integration'
      run: npm test --workspace=ai.matey.integration-tests -- tests/cross-package

    # Contract tests - provider contracts
    - name: Run contract tests
      if: matrix.test-suite == 'contracts'
      run: npm test --workspace=ai.matey.integration-tests -- tests/contracts

    # Coverage only on Node 20 unit tests
    - name: Generate coverage
      if: matrix.node-version == 20 && matrix.test-suite == 'unit'
      run: turbo run test:coverage

    - name: Upload coverage
      if: matrix.node-version == 20 && matrix.test-suite == 'unit'
      uses: codecov/codecov-action@v4
      with:
        files: ./packages/*/coverage/lcov.info
```

#### 8.7 Test Coverage Requirements

**Per-Package Coverage:**
- Maintain existing coverage levels (don't lose any tests)
- Target: 80%+ coverage for all packages
- Critical packages (core, router): 90%+ coverage

**Coverage Validation:**
```bash
# Generate coverage for all packages
turbo run test:coverage

# View combined coverage report
npx vitest-coverage-report
```

**Coverage Config in vitest.workspace.ts:**
```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80
        }
      }
    }
  }
]);
```

#### 8.8 Handling Breaking Changes

Since breaking changes are acceptable:
1. Update tests to match new package structure
2. Remove tests for deprecated/removed functionality
3. Add new tests for modified behavior
4. Document all test changes in migration guide
5. Mark skipped manual/performance tests appropriately

**Manual Tests:**
- Keep tests/manual/ directory in integration-tests package
- Mark as `test.skip()` or exclude from CI
- Document how to run manually

#### 8.9 Phase-by-Phase Test Checklist

**After Each Phase:**
- [ ] All moved tests pass in their new packages
- [ ] No test files left orphaned in old `tests/` directory
- [ ] Integration tests still pass with new structure
- [ ] Coverage hasn't decreased
- [ ] `turbo run test` completes successfully
- [ ] No broken imports in test files

**Final Validation (Phase 13):**
- [ ] All 24 original test files accounted for and migrated
- [ ] All tests passing in new structure
- [ ] Integration tests verify cross-package functionality
- [ ] Backward compatibility tests pass (for `ai.matey` package)
- [ ] CI/CD pipeline green across all Node versions
- [ ] Test coverage reports generated per package
- [ ] Manual test documentation updated
- [ ] Performance tests documented

#### 8.10 Test Migration Automation

Add to extraction scripts:

```bash
# scripts/extract-backend.sh (enhancement)
# ... existing code ...

# Find and move related tests
echo "Looking for tests related to $PROVIDER..."
TEST_FILES=$(grep -r "$PROVIDER" tests/ --files-with-matches || true)

if [ -n "$TEST_FILES" ]; then
  mkdir -p "${PACKAGE_DIR}/tests"
  echo "Found tests to migrate:"
  echo "$TEST_FILES"
  echo "Please review and migrate these tests manually"
  echo "$TEST_FILES" > "${PACKAGE_DIR}/TESTS_TO_MIGRATE.txt"
fi
```

---

## 9. Success Criteria

The migration is successful when:

1. **All packages build independently:**
   ```bash
   turbo run build
   # All 68 packages build without errors
   ```

2. **All tests pass:**
   ```bash
   turbo run test
   # 100% of existing tests pass
   ```

3. **CI pipeline passes:**
   - Lint ✓
   - Type check ✓
   - Tests (Node 18, 20, 22) ✓
   - Build ✓

4. **Local installation works:**
   ```bash
   npm install ai.matey.backend.openai
   # Packages install without errors
   ```

5. **Examples run correctly:**
   - All examples updated and working

6. **Documentation complete:**
   - Migration guide published
   - README updated

---

## Appendices

### A. Quick Reference Commands

```bash
# Build all packages
turbo run build

# Build specific package
turbo run build --filter=ai.matey.backend.openai

# Test all packages
turbo run test

# Test specific package
turbo run test --filter=ai.matey.backend.openai

# Clean all build artifacts
turbo run clean

# Create changeset (for releases)
npx changeset

# Version packages
npm run version-packages

# Publish packages
npm run release
```

### B. Backend Extraction Script (scripts/extract-backend.sh)

```bash
#!/bin/bash
set -e

PROVIDER=$1
if [ -z "$PROVIDER" ]; then
  echo "Usage: $0 <provider>"
  echo "Example: $0 openai"
  exit 1
fi

PACKAGE_NAME="ai.matey.backend.${PROVIDER}"
PACKAGE_DIR="packages/backend-${PROVIDER}"
SOURCE_FILE="src/adapters/backend/${PROVIDER}.ts"

if [ ! -f "$SOURCE_FILE" ]; then
  echo "Error: Source file $SOURCE_FILE does not exist"
  exit 1
fi

echo "Extracting backend: $PROVIDER"
echo "Package name: $PACKAGE_NAME"
echo "Package dir: $PACKAGE_DIR"

# Create package structure
mkdir -p "${PACKAGE_DIR}/src"
mkdir -p "${PACKAGE_DIR}/tests"

# Copy source file
cp "$SOURCE_FILE" "${PACKAGE_DIR}/src/index.ts"

# Update imports in the file
sed -i '' "s|from '../../types/|from 'ai.matey.types'|g" "${PACKAGE_DIR}/src/index.ts"
sed -i '' "s|from '../../errors/|from 'ai.matey.errors'|g" "${PACKAGE_DIR}/src/index.ts"
sed -i '' "s|from '../../utils/|from 'ai.matey.utils'|g" "${PACKAGE_DIR}/src/index.ts"
sed -i '' "s|from '../../core/|from 'ai.matey.core'|g" "${PACKAGE_DIR}/src/index.ts"
sed -i '' "s|from '../../structured/|from 'ai.matey.structured'|g" "${PACKAGE_DIR}/src/index.ts"

# Create package.json
cat > "${PACKAGE_DIR}/package.json" <<EOF
{
  "name": "${PACKAGE_NAME}",
  "version": "1.0.0",
  "description": "${PROVIDER} backend adapter for AI Matey",
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/types/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/types/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    }
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "npm run build:esm && npm run build:cjs && npm run build:types",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "build:types": "tsc -p tsconfig.types.json",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts",
    "test": "vitest run"
  },
  "dependencies": {
    "ai.matey.types": "workspace:*",
    "ai.matey.errors": "workspace:*",
    "ai.matey.utils": "workspace:*",
    "ai.matey.core": "workspace:*"
  },
  "devDependencies": {
    "ai.matey.testing": "workspace:*"
  },
  "keywords": ["ai", "llm", "${PROVIDER}", "adapter"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/johnhenry/ai.matey.git",
    "directory": "packages/backend-${PROVIDER}"
  }
}
EOF

# Create tsconfig files
cat > "${PACKAGE_DIR}/tsconfig.json" <<'TSEOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
TSEOF

cat > "${PACKAGE_DIR}/tsconfig.esm.json" <<'TSEOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/esm",
    "declaration": false
  }
}
TSEOF

cat > "${PACKAGE_DIR}/tsconfig.cjs.json" <<'TSEOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist/cjs",
    "declaration": false
  }
}
TSEOF

cat > "${PACKAGE_DIR}/tsconfig.types.json" <<'TSEOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "outDir": "./dist/types",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true
  }
}
TSEOF

# Create README
cat > "${PACKAGE_DIR}/README.md" <<EOF
# ${PACKAGE_NAME}

${PROVIDER} backend adapter for AI Matey.

## Installation

\`\`\`bash
npm install ${PACKAGE_NAME}
\`\`\`

## Usage

\`\`\`typescript
import { adapter } from '${PACKAGE_NAME}';
\`\`\`

## License

MIT
EOF

echo "✓ Package created: $PACKAGE_DIR"
echo "Next steps:"
echo "1. Review imports in ${PACKAGE_DIR}/src/index.ts"
echo "2. Run: npm run build --workspace=${PACKAGE_NAME}"
echo "3. Run: npm test --workspace=${PACKAGE_NAME}"
```

---

## Summary

This comprehensive migration plan provides a complete roadmap for converting ai.matey from a monolithic package into a fine-grained monorepo with 68 packages. The phased approach minimizes risk, detailed configurations ensure consistency, and automation scripts reduce manual effort.

### Package Breakdown Summary

| Tier | Category | Count | Examples |
|------|----------|-------|----------|
| 1 | Foundation | 6 | types, errors, utils, core, testing, ai.matey |
| 2 | Backend Adapters | 26 | openai, anthropic, gemini, ollama, mistral, cohere, etc. |
| 3 | Frontend Adapters | 6 | openai, anthropic, gemini, ollama, mistral, chrome-ai |
| 4 | Native Backends | 3 | apple, llamacpp, runners |
| 5 | HTTP Servers | 6 | node, express, koa, hono, fastify, deno |
| 6 | Middleware | 10 | logging, caching, retry, telemetry, opentelemetry, etc. |
| 7 | Wrappers | 6 | openai-sdk, anthropic-sdk, chrome-ai, chrome-ai-legacy, anymethod, meta |
| 8 | React Hooks | 4 | use-chat, use-completion, use-object, meta |
| 9 | Utilities | 3 | structured, profiler, debug |
| 10 | CLI | 1 | cli |
| 11 | Meta | 1 | ai.matey.all (optional) |
| **Total** | | **68** | |

**Key Distinctions:**
- **ai.matey** (Tier 1): Main package that re-exports everything for backward compatibility
- **ai.matey.all** (Tier 11): Optional meta package with dependencies on all other packages (convenience installer)
- **Individual packages**: Fine-grained packages allowing users to install only what they need

**Next Steps:**
1. Review this plan
2. Start Phase 0 (Preparation)
3. Execute phases sequentially (Phases 0-13)
4. Validate thoroughly at each step

---

## 10. Roadmap Integration & Future-Proofing

### How Monorepo Enables Your Roadmap

The monorepo structure directly supports features from `ROADMAP.md`:

**Immediate Benefits:**
- **Independent versioning**: Release new adapters without bumping core
- **Selective installation**: Users only install what they need (e.g., just OpenAI adapter)
- **Faster iteration**: Work on Vue.js/SvelteKit without touching core
- **Better testing**: Isolated test suites per package
- **Clearer dependencies**: Explicit package boundaries prevent hidden coupling

**Enables Near-Term Features (Next 2-4 weeks):**
1. **Better Documentation** - Each package gets its own focused README
2. **Vue.js Composables** - New `ai.matey.vue` package (parallel to React)
3. **SvelteKit Integration** - New `ai.matey.svelte` package
4. **Semantic Caching** - New `ai.matey.middleware.semantic-cache` package
5. **Prometheus Metrics** - New `ai.matey.middleware.prometheus` package
6. **Request Deduplication** - New `ai.matey.middleware.deduplication` package

**Enables Mid-Term Features (1-2 months):**
7. **RAG Pipeline** - New `ai.matey.rag` package (separate from core)
8. **Agent Runtime** - New `ai.matey.agents` package
9. **Geographic Routing** - Enhancement to `ai.matey.core` without affecting adapters
10. **Multi-tenancy** - New `ai.matey.enterprise` package

**Package Strategy for Roadmap Features:**

| Roadmap Feature | Package Name | Depends On | Independent Release |
|----------------|--------------|------------|---------------------|
| Vue Composables | `ai.matey.vue` | core, types | ✓ Yes |
| SvelteKit | `ai.matey.svelte` | core, types | ✓ Yes |
| Semantic Cache | `ai.matey.middleware.semantic-cache` | core, utils | ✓ Yes |
| Prometheus | `ai.matey.middleware.prometheus` | core | ✓ Yes |
| RAG Pipeline | `ai.matey.rag` | core, types | ✓ Yes |
| Agent Runtime | `ai.matey.agents` | core, types | ✓ Yes |
| WebLLM Integration | `ai.matey.backend.webllm` | core, types | ✓ Yes |
| Interactive Playground | Separate repo | ai.matey (npm) | ✓ Yes |

### Migration Doesn't Block Roadmap Work

**Critical Insight**: You can continue roadmap development during/after migration:
- New features go into new packages
- Existing features continue working
- No development freeze needed
- Can even add new packages before migration completes

**Example Timeline:**
- **Week 1**: Migration Phases 0-3 (Foundation + Backends)
- **Week 2**: Migration Phases 4-7 (Servers + Middleware + Wrappers)
  - *Meanwhile*: Design `ai.matey.vue` package
- **Week 3**: Migration Phases 8-13 (Hooks + Utilities + CLI + Validation)
  - *Meanwhile*: Implement `ai.matey.vue` package
- **Week 4**: Migration complete, publish all packages
  - *Also*: Release `ai.matey.vue@1.0.0` alongside migration

### Post-Migration Publishing Strategy

**Week 1 After Migration:**
1. Publish all 68 packages to npm with synchronized versions (1.0.0)
2. Update main README with new package structure and installation instructions
3. Create comprehensive migration guide for existing users
4. Announce monorepo migration on GitHub, Twitter, npm

**Week 2-3 (Quick Wins from Roadmap):**
5. Add Vue.js composables as `ai.matey.vue@1.0.0`
6. Add SvelteKit integration as `ai.matey.svelte@1.0.0`
7. Add semantic caching as `ai.matey.middleware.semantic-cache@1.0.0`
8. Add Prometheus metrics as `ai.matey.middleware.prometheus@1.0.0`
9. Update documentation site with package-specific docs

**Month 2+ (Larger Features):**
10. Continue roadmap features as independent packages
11. Version independently based on changes
12. Use Changesets for coordinated releases
13. Build out package-specific documentation and examples

### Competitive Advantage Through Modularity

The monorepo structure positions ai.matey uniquely:

**vs. LangChain.js:**
- More focused packages (not monolithic)
- Tree-shakeable imports
- Faster install times for specific use cases

**vs. Vercel AI SDK:**
- Backend-focused (not UI-focused)
- More provider coverage
- Self-hosted solution

**vs. LiteLLM.js:**
- Production-ready from day 1
- Better TypeScript support per package
- More comprehensive middleware system

**vs. Portkey:**
- Self-hosted (not SaaS)
- Transparent pricing (open source)
- Greater control over data flow

### Package-First Development Model

Going forward, think "package-first":

1. **New feature idea** → "Should this be a new package or extend existing?"
2. **Breaking change** → Only bump affected packages, not entire monorepo
3. **Deprecation** → Remove package without affecting others
4. **Community contribution** → Can contribute to specific package
5. **Testing** → Test package in isolation

**Example: Adding WebLLM Support**
```bash
# Create new package
mkdir packages/backend-webllm
cd packages/backend-webllm

# Develop independently
npm test
npm run build

# Publish independently
npx changeset
npm run version-packages
npm run release

# Users install only if needed
npm install ai.matey.backend.webllm
```

---

## 11. Quick Start Checklist

### Pre-Migration Checklist

Before starting Phase 0:
- [ ] Review entire migration plan
- [ ] Ensure git working directory is clean
- [ ] Backup important branches
- [ ] Note current version (0.1.1)
- [ ] Verify all tests pass: `npm test`
- [ ] Verify build works: `npm run build`
- [ ] Check disk space (need ~2GB for packages/)

### Phase 0 Quick Start

```bash
# 1. Create feature branch
git checkout -b feat/monorepo-migration
git tag pre-monorepo-backup

# 2. Install tooling
npm install -D turbo@latest @changesets/cli@latest

# 3. Initialize
npx changeset init

# 4. Create structure
mkdir -p packages scripts

# 5. Review Phase 0 checklist in plan
```

### Daily Migration Workflow

**Morning:**
1. Review previous day's work: `git log --oneline -10`
2. Check current phase status
3. Identify today's phase/packages

**During Work:**
1. Extract package(s)
2. Run tests: `turbo run test --filter=<package>`
3. Verify builds: `turbo run build --filter=<package>`
4. Commit small: `git commit -m "Extract <package>"`

**End of Day:**
1. Run full test suite: `turbo run test`
2. Check coverage: `turbo run test:coverage`
3. Push to remote: `git push`
4. Update progress notes

### Emergency Rollback

If something goes wrong:
```bash
# Option 1: Rollback current phase
git reset --hard HEAD~1

# Option 2: Rollback entire migration
git checkout main
git branch -D feat/monorepo-migration
git checkout -b feat/monorepo-migration-v2

# Option 3: Restore from backup tag
git checkout pre-monorepo-backup
```

---

## 12. Final Recommendations

### Do's ✓
- ✓ Test after every package extraction
- ✓ Commit small and frequently
- ✓ Use automation scripts for repetitive work
- ✓ Keep CI green throughout migration
- ✓ Document any deviations from plan
- ✓ Ask for help if stuck (community, GitHub issues)

### Don'ts ✗
- ✗ Skip testing phases
- ✗ Rush through extraction
- ✗ Commit broken code
- ✗ Change too many things at once
- ✗ Ignore TypeScript errors
- ✗ Forget to update imports

### Success Indicators
- All 68 packages build independently ✓
- All tests pass in new structure ✓
- CI/CD pipeline green ✓
- No decrease in test coverage ✓
- Backward compatibility maintained ✓
- Documentation updated ✓

### Post-Migration Victory Lap
1. **Announce** on GitHub, npm, Twitter
2. **Write blog post** about monorepo benefits
3. **Update roadmap** with package-centric view
4. **Celebrate** 🎉 - This is a major architectural achievement!
5. **Plan next feature** using new package structure
