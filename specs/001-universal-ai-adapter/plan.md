# Implementation Plan: Universal AI Adapter System

**Branch**: `001-universal-ai-adapter` | **Date**: 2025-10-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-universal-ai-adapter/spec.md`

## Summary

The Universal AI Adapter System is a TypeScript library implementing the hybrid architecture (Bridge + Router + Middleware) pattern to enable seamless interoperability between AI provider APIs. The system provides a universal Intermediate Representation (IR) that allows developers to write code once using any provider's interface style and run it against any supported backend (OpenAI, Anthropic, Google Gemini, Ollama, Mistral, Chrome AI) without modification.

**Core Value Proposition**: Write once, run anywhere - swap AI providers by changing configuration, not code.

**Technical Approach**:
- Universal IR schema normalizes all provider differences
- Frontend adapters translate provider-specific requests → IR
- Backend adapters translate IR → provider-specific API calls
- Bridge class provides simple ergonomics (`frontend.connect(backend)`)
- Router enables dynamic backend selection, fallback, and parallel dispatch
- Middleware stack handles logging, caching, telemetry, transforms

## Technical Context

**Language/Version**: TypeScript 5.0+ (targeting ES2020+ for async generator support)
**Primary Dependencies**:
- No runtime dependencies (zero-dependency library goal)
- Dev dependencies: TypeScript 5.0+, Node.js test runner, @types/node
- Peer dependencies: Node.js 18+ or modern browser with fetch API

**Storage**: N/A (stateless library, conversation state managed by consumers)

**Testing**:
- Node.js built-in test runner (`node:test`)
- Node.js assert module (`node:assert`)
- No external test frameworks (jest, mocha, etc.) - keeping it lightweight
- Test types: unit tests, integration tests (mocked providers), contract tests (IR schema validation)

**Target Platform**:
- Primary: Node.js 18+ (LTS)
- Secondary: Modern browsers (Chrome, Firefox, Safari, Edge) via bundlers
- Both ESM and CommonJS builds via `exports` field in package.json

**Project Type**: Single TypeScript library package (npm publishable)

**Performance Goals**:
- Adapter overhead: <5ms per request (p95)
- Streaming latency: <50ms additional delay (p95)
- Memory: Minimal allocations, no leaks in long-running scenarios
- Bundle size: <50KB minified for browser builds

**Constraints**:
- Zero runtime dependencies (maximizes compatibility)
- Type-safe: Full TypeScript strict mode
- Tree-shakeable: ESM modules with side-effect-free code
- Browser compatible: No Node.js-specific APIs in core (fetch-based HTTP)
- Semantic versioning: Follow semver strictly for published package

**Scale/Scope**:
- 6 AI providers supported initially (OpenAI, Anthropic, Gemini, Ollama, Mistral, Chrome AI)
- ~20-30 adapters total (6 frontend + 6 backend + utilities)
- ~5000-7000 lines of source code
- Full TypeScript type coverage (no `any` types except for escape hatches)
- Comprehensive test coverage (>80% line coverage target)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. Semantic Preservation
- **Status**: PASS
- **Evidence**: Research.md documents all known semantic drift points. Adapters declare semantic fidelity level. System provides warnings for lossy conversions (temperature scaling, token limits).
- **Compliance**: IR includes metadata for semantic transforms. Capability metadata tracks incompatibilities.

### ✅ II. Intermediate Representation (IR) First
- **Status**: PASS
- **Evidence**: All communication flows through universal IR (IRChatRequest/IRChatResponse). IR is versioned independently. No direct frontend-to-backend translations.
- **Compliance**: See contracts/ir.ts for complete IR schema. IR supports streaming, multimodal, tool calling as first-class.

### ✅ III. Adapter Independence
- **Status**: PASS
- **Evidence**: Adapters implement standard FrontendAdapter/BackendAdapter interfaces. No dependencies between specific adapter pairs. Each adapter is self-contained.
- **Compliance**: See contracts/adapters.ts. Adapters declare capabilities through metadata.

### ✅ IV. Hybrid Architecture (Bridge + Router + Middleware)
- **Status**: PASS
- **Evidence**: Bridge class provides `frontend.connect(backend)` ergonomics. Router embedded for dynamic selection. Middleware stack composable.
- **Compliance**: See contracts/bridge.ts and contracts/router.ts. Supports parallel dispatch and fan-out.

### ✅ V. Middleware Composability
- **Status**: PASS
- **Evidence**: All cross-cutting concerns (logging, caching, transforms, telemetry) implemented as middleware operating on IR.
- **Compliance**: See contracts/middleware.ts. Middleware async-aware with proper error propagation. Deterministic execution order.

### ✅ VI. Explicit Over Implicit
- **Status**: PASS
- **Evidence**: All type conversions explicit and visible. TypeScript strict mode enabled. Validation errors surface immediately with actionable messages.
- **Compliance**: Debug mode shows full transformation pipeline. No silent failures.

### ✅ VII. Latest TypeScript Features
- **Status**: PASS
- **Evidence**: Uses TS 5.0+ features: template literal types, const type parameters, satisfies operator, advanced generics, discriminated unions.
- **Compliance**: All IR types use discriminated unions. See contracts/ for type implementations.

### ✅ API Compatibility Constraints
- **System Message Handling**: PASS - Documented in research.md. Adapters normalize system message placement. Merge strategy for multi-system scenarios.
- **Streaming Protocol Differences**: PASS - AsyncGenerator<IRStreamChunk> normalizes all protocols. See data-model.md for chunk types.
- **Token Limits and Context Windows**: PASS - IR includes token usage metadata. Adapters document limits. Utility functions for estimation.

### 📋 Additional Considerations

**NPM Package Requirements** (from user input):
- Package name: `aimatey-adapter` (or similar, check npm availability)
- Exports: ESM + CommonJS via `exports` field
- Type definitions: Bundled .d.ts files
- Test scripts: `npm test` using Node.js test runner
- Publish-ready: package.json configured with proper metadata

**No Constitution Violations**: All gates pass. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```
specs/001-universal-ai-adapter/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: IR design research ✅
├── data-model.md        # Phase 1: Entity definitions ✅
├── quickstart.md        # Phase 1: Developer guide ✅
├── contracts/           # Phase 1: TypeScript interfaces ✅
│   ├── README.md
│   ├── QUICK_REFERENCE.md
│   ├── index.ts
│   ├── ir.ts
│   ├── errors.ts
│   ├── adapters.ts
│   ├── bridge.ts
│   ├── router.ts
│   └── middleware.ts
├── checklists/
│   └── requirements.md  # Spec validation checklist ✅
└── tasks.md             # Phase 2 (to be created by /speckit.tasks)
```

### Source Code (repository root)

```
aimatey-universal/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .gitignore
├── .npmignore
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                    # Main export barrel
│   │
│   ├── types/
│   │   ├── index.ts                # Type exports
│   │   ├── ir.ts                   # IR types (from contracts)
│   │   ├── adapters.ts             # Adapter interfaces (from contracts)
│   │   ├── bridge.ts               # Bridge types (from contracts)
│   │   ├── router.ts               # Router types (from contracts)
│   │   ├── middleware.ts           # Middleware types (from contracts)
│   │   └── errors.ts               # Error types (from contracts)
│   │
│   ├── core/
│   │   ├── bridge.ts               # Bridge implementation
│   │   ├── router.ts               # Router implementation
│   │   └── middleware-stack.ts     # Middleware composition
│   │
│   ├── adapters/
│   │   ├── frontend/
│   │   │   ├── index.ts
│   │   │   ├── anthropic.ts        # Anthropic frontend adapter
│   │   │   ├── openai.ts           # OpenAI frontend adapter
│   │   │   ├── gemini.ts           # Gemini frontend adapter
│   │   │   ├── ollama.ts           # Ollama frontend adapter
│   │   │   ├── mistral.ts          # Mistral frontend adapter
│   │   │   └── chrome-ai.ts        # Chrome AI frontend adapter
│   │   │
│   │   └── backend/
│   │       ├── index.ts
│   │       ├── anthropic.ts        # Anthropic backend adapter
│   │       ├── openai.ts           # OpenAI backend adapter
│   │       ├── gemini.ts           # Gemini backend adapter
│   │       ├── ollama.ts           # Ollama backend adapter
│   │       ├── mistral.ts          # Mistral backend adapter
│   │       └── chrome-ai.ts        # Chrome AI backend adapter
│   │
│   ├── middleware/
│   │   ├── index.ts
│   │   ├── logging.ts              # Logging middleware
│   │   ├── telemetry.ts            # Telemetry middleware
│   │   ├── caching.ts              # Caching middleware
│   │   ├── retry.ts                # Retry middleware
│   │   └── transform.ts            # Prompt transform middleware
│   │
│   ├── utils/
│   │   ├── index.ts
│   │   ├── system-message.ts       # System message normalization
│   │   ├── parameter-normalizer.ts # Parameter scaling utilities
│   │   ├── streaming.ts            # Streaming utilities
│   │   ├── validation.ts           # IR validation
│   │   └── errors.ts               # Error utilities
│   │
│   └── errors/
│       └── index.ts                # Error classes implementation
│
├── tests/
│   ├── unit/
│   │   ├── adapters/
│   │   │   ├── frontend/
│   │   │   │   ├── anthropic.test.ts
│   │   │   │   ├── openai.test.ts
│   │   │   │   ├── gemini.test.ts
│   │   │   │   ├── ollama.test.ts
│   │   │   │   ├── mistral.test.ts
│   │   │   │   └── chrome-ai.test.ts
│   │   │   │
│   │   │   └── backend/
│   │   │       ├── anthropic.test.ts
│   │   │       ├── openai.test.ts
│   │   │       ├── gemini.test.ts
│   │   │       ├── ollama.test.ts
│   │   │       ├── mistral.test.ts
│   │   │       └── chrome-ai.test.ts
│   │   │
│   │   ├── core/
│   │   │   ├── bridge.test.ts
│   │   │   ├── router.test.ts
│   │   │   └── middleware-stack.test.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── logging.test.ts
│   │   │   ├── telemetry.test.ts
│   │   │   ├── caching.test.ts
│   │   │   ├── retry.test.ts
│   │   │   └── transform.test.ts
│   │   │
│   │   └── utils/
│   │       ├── system-message.test.ts
│   │       ├── parameter-normalizer.test.ts
│   │       ├── streaming.test.ts
│   │       └── validation.test.ts
│   │
│   ├── integration/
│   │   ├── cross-provider.test.ts      # Frontend X → Backend Y combinations
│   │   ├── streaming.test.ts           # End-to-end streaming
│   │   ├── router-fallback.test.ts     # Router failover scenarios
│   │   ├── middleware-stack.test.ts    # Middleware composition
│   │   └── error-handling.test.ts      # Error propagation
│   │
│   ├── contract/
│   │   ├── ir-schema.test.ts           # IR schema validation
│   │   ├── adapter-interface.test.ts    # Adapter contract compliance
│   │   └── type-safety.test.ts         # Compile-time type tests
│   │
│   ├── fixtures/
│   │   ├── anthropic/
│   │   │   ├── request.json
│   │   │   └── response.json
│   │   ├── openai/
│   │   │   ├── request.json
│   │   │   └── response.json
│   │   └── ...                         # Fixtures for each provider
│   │
│   └── helpers/
│       ├── mock-adapters.ts            # Mock adapter implementations
│       └── test-utils.ts               # Test utilities
│
└── dist/                                # Build output (gitignored)
    ├── esm/                            # ESM build
    ├── cjs/                            # CommonJS build
    └── types/                          # TypeScript declarations
```

**Structure Decision**: Single TypeScript library package using standard Node.js conventions. Source in `src/`, tests in `tests/`, built output in `dist/`. Organized by feature area (adapters, middleware, utils) rather than technical layer. This structure:
- Makes it easy to find related code (all OpenAI code together)
- Supports tree-shaking (consumers import only what they need)
- Scales well (easy to add new providers)
- Follows npm package best practices

## Build & Package Configuration

### package.json (key fields)

```json
{
  "name": "aimatey-adapter",
  "version": "0.1.0",
  "description": "Universal adapter system for AI provider APIs with hybrid architecture",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    },
    "./adapters/frontend/*": {
      "types": "./dist/types/adapters/frontend/*.d.ts",
      "import": "./dist/esm/adapters/frontend/*.js",
      "require": "./dist/cjs/adapters/frontend/*.js"
    },
    "./adapters/backend/*": {
      "types": "./dist/types/adapters/backend/*.d.ts",
      "import": "./dist/esm/adapters/backend/*.js",
      "require": "./dist/cjs/adapters/backend/*.js"
    },
    "./middleware/*": {
      "types": "./dist/types/middleware/*.d.ts",
      "import": "./dist/esm/middleware/*.js",
      "require": "./dist/cjs/middleware/*.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json && tsc -p tsconfig.build.json --module commonjs --outDir dist/cjs",
    "test": "node --test tests/**/*.test.ts",
    "test:watch": "node --test --watch tests/**/*.test.ts",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit && echo 'Linting passed'",
    "prepublishOnly": "npm run typecheck && npm test && npm run build"
  },
  "keywords": ["ai", "adapter", "openai", "anthropic", "gemini", "ollama", "universal", "llm"],
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist/esm",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Implementation Phases

### Phase 0: Research & Design ✅ COMPLETE
- ✅ IR schema design (research.md)
- ✅ Message normalization strategy
- ✅ Streaming representation
- ✅ Parameter normalization approach
- ✅ TypeScript type design

### Phase 1: Design Artifacts ✅ COMPLETE
- ✅ Data model (data-model.md)
- ✅ API contracts (contracts/*.ts)
- ✅ Quickstart guide (quickstart.md)

### Phase 2: Tasks Generation
- 🔄 NEXT: Run `/speckit.tasks` to generate implementation task list
- Task list will break down implementation by user story (P1 → P2 → P3)
- Each user story independently testable

### Phase 3: Implementation (via /speckit.implement)
- Core IR types
- Frontend adapters (6 providers)
- Backend adapters (6 providers)
- Bridge implementation
- Router implementation
- Middleware system
- Utility functions
- Error handling
- Comprehensive tests

### Phase 4: Publishing
- Build ESM + CommonJS + types
- Verify package exports
- Test in Node.js and browser environments
- Publish to npm

## Complexity Tracking

*No constitution violations - this section intentionally left empty.*

## Next Steps

1. ✅ Constitution established (constitution.md)
2. ✅ Specification complete (spec.md)
3. ✅ Research complete (research.md)
4. ✅ Design artifacts complete (data-model.md, contracts/, quickstart.md)
5. 🔄 **CURRENT**: Ready for `/speckit.tasks` to generate implementation task list
6. ⏳ Run `/speckit.implement` to execute tasks
7. ⏳ Test and validate
8. ⏳ Publish to npm

**Status**: Plan complete. Ready to proceed to task generation phase.
