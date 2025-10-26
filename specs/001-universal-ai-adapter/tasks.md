# Tasks: Universal AI Adapter System

**Input**: Design documents from `/specs/001-universal-ai-adapter/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Tests are NOT explicitly requested in the specification, so test tasks are EXCLUDED from this list.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure per plan.md

- [ ] T001 Create directory structure: `src/{types,core,adapters/{frontend,backend},middleware,utils,errors}`, `dist/{esm,cjs,types}`
- [ ] T002 Create `package.json` with name `ai.matey-adapter`, type: "module", exports field for ESM+CJS, scripts for build/test/typecheck
- [ ] T003 [P] Create `tsconfig.json` with strict mode, ES2020 target, ESNext modules, declaration: true
- [ ] T004 [P] Create `tsconfig.build.json` extending base tsconfig for production builds
- [ ] T005 [P] Create `.gitignore` with node_modules, dist, *.log, .env patterns
- [ ] T006 [P] Create `.npmignore` for published package (exclude tests, specs, etc.)
- [ ] T007 [P] Create `README.md` with project overview, installation, quick start based on quickstart.md
- [ ] T008 [P] Create `LICENSE` file (MIT or as specified)

**Checkpoint**: Project structure ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core IR types and base interfaces that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Core Type System

- [ ] T009 [P] Create `src/types/ir.ts` - Copy IR types from contracts/ir.ts: `UniversalMessage`, `MessageRole`, `MessageContent`, `MessagePart`, `ImageSource`, `UniversalTool`, `ToolChoice`
- [ ] T010 [P] Add to `src/types/ir.ts` - `UniversalChatRequest` with all fields (model, messages, temperature, maxTokens, topP, stopSequences, stream, tools, toolChoice, metadata, providerHints)
- [ ] T011 [P] Add to `src/types/ir.ts` - `UniversalChatResponse` with all fields (id, model, message, finishReason, usage, created, metadata, raw)
- [ ] T012 [P] Add to `src/types/ir.ts` - `UniversalStreamChunk` with discriminated union types (ChunkType, ContentDelta, ToolCallDelta, StreamError)
- [ ] T013 [P] Add to `src/types/ir.ts` - `UniversalStreamResponse` type alias for AsyncGenerator<UniversalStreamChunk>
- [ ] T014 [P] Add to `src/types/ir.ts` - Metadata types: `RequestMetadata`, `ResponseMetadata`, `SemanticWarning`, `TokenUsage`, `LatencyMetrics`
- [ ] T015 [P] Add to `src/types/ir.ts` - `ProviderHints` interface with optional fields for each provider
- [ ] T016 [P] Add to `src/types/ir.ts` - Branded types: `RequestId`, `ResponseId` using unique symbol pattern

### Base Adapter Interfaces

- [ ] T017 [P] Create `src/types/adapters.ts` - Copy from contracts/adapters.ts: `ProviderName` type, `AdapterName` template literal type, `AdapterType` type
- [ ] T018 [P] Add to `src/types/adapters.ts` - `FrontendAdapter<TRequest, TResponse>` interface with name, version, provider, toUniversal(), fromUniversal(), fromUniversalStream()
- [ ] T019 [P] Add to `src/types/adapters.ts` - `BackendAdapter<TRequest, TResponse>` interface with name, version, provider, capabilities, config, toProvider(), fromProvider(), chat(), chatStream(), healthCheck(), estimateTokens()
- [ ] T020 [P] Add to `src/types/adapters.ts` - `ChatOptions` interface (signal, timeout, debug)
- [ ] T021 [P] Add to `src/types/adapters.ts` - `BackendAdapterConfig` interface (endpoint, apiKey, timeout, maxRetries, headers, providerOptions)
- [ ] T022 [P] Add to `src/types/adapters.ts` - `AdapterCapabilities` interface with all capability flags and system message handling

### Error System

- [ ] T023 [P] Create `src/types/errors.ts` - Copy from contracts/errors.ts: `ErrorCategory` type, `UniversalErrorParams` interface, `UniversalErrorJSON` interface
- [ ] T024 [P] Create `src/errors/index.ts` - Implement `UniversalError` base class extending Error with all fields (category, statusCode, providerCode, adapter, irState, originalError, retryable, retryAfter, timestamp)
- [ ] T025 [P] Add to `src/errors/index.ts` - Implement specific error classes: `AuthenticationError`, `AuthorizationError`, `RateLimitError`, `InvalidRequestError`, `ModelError`, `NetworkError`, `ServerError`, `AdapterError`, `ValidationError`, `BridgeError`, `RouterError`
- [ ] T026 [P] Add to `src/errors/index.ts` - Implement `UniversalError.fromProviderError()` static factory method
- [ ] T027 [P] Add to `src/errors/index.ts` - Implement `UniversalError.toJSON()` serialization method

### Bridge & Router Types

- [ ] T028 [P] Create `src/types/bridge.ts` - Copy from contracts/bridge.ts: `BridgeConfig`, `BridgeHealthStatus` interfaces
- [ ] T029 [P] Create `src/types/router.ts` - Copy from contracts/router.ts: `RouterConfig`, `RoutingOptions`, `FanOutOptions`, `FallbackStrategy`, `LoadBalancingStrategy`, `CircuitBreakerConfig` types/interfaces

### Middleware Types

- [ ] T030 [P] Create `src/types/middleware.ts` - Copy from contracts/middleware.ts: `Middleware` type, `MiddlewareContext`, `MiddlewarePhase`, `MiddlewareNext`, config interfaces for logging, telemetry, caching, retry, rate limiting

### Utilities & Validation

- [ ] T031 [P] Create `src/utils/validation.ts` - Implement IR validation functions: `validateUniversalChatRequest()`, `validateUniversalMessage()`, `validateUniversalChatResponse()`, `validateUniversalStreamChunk()` (throw ValidationError on failure)
- [ ] T032 [P] Create `src/utils/system-message.ts` - Implement `SystemMessageNormalizer` class with `extractAndMerge()` static method for handling system message placement differences across providers
- [ ] T033 [P] Create `src/utils/parameter-normalizer.ts` - Implement `ParameterNormalizer` class with `normalizeTemperature()`, `denormalizeTemperature()`, `checkTemperature()` static methods for parameter scaling with semantic warnings
- [ ] T034 [P] Create `src/utils/streaming.ts` - Implement streaming utilities: chunk sequence validation, delta assembly helpers, stream error handling
- [ ] T035 [P] Add to `src/utils/validation.ts` - Implement `CapabilityChecks` namespace with `checkCompatibility()`, `checkTemperature()`, `checkTokenLimit()`, `checkContentTypes()` functions

### Index Files

- [ ] T036 [P] Create `src/types/index.ts` - Export all types from ir, adapters, errors, bridge, router, middleware
- [ ] T037 [P] Create `src/utils/index.ts` - Export all utilities

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic Cross-Provider Compatibility (Priority: P1) 🎯 MVP

**Goal**: Demonstrate fundamental adapter pattern working with Anthropic frontend → OpenAI backend

**Independent Test**: Create a simple chat completion request using Anthropic frontend interface, connect to OpenAI backend, verify response comes back correctly formatted for Anthropic expectations.

### Core Bridge Implementation

- [ ] T038 [US1] Create `src/core/bridge.ts` - Implement `Bridge<TFrontend, TBackend>` class constructor with frontend, backend/router, middleware array, config validation
- [ ] T039 [US1] Add to `src/core/bridge.ts` - Implement `Bridge.use(middleware)` method for adding middleware to stack (check not locked)
- [ ] T040 [US1] Add to `src/core/bridge.ts` - Implement `Bridge.chat()` method: frontend.toUniversal() → middleware request phase → backend.chat() → middleware response phase → frontend.fromUniversal()
- [ ] T041 [US1] Add to `src/core/bridge.ts` - Implement `Bridge.chatStream()` method with middleware support for streaming
- [ ] T042 [US1] Add to `src/core/bridge.ts` - Implement `Bridge.getBackend()`, `Bridge.getMiddleware()` accessor methods
- [ ] T043 [US1] Add to `src/core/bridge.ts` - Implement `Bridge.healthCheck()` method returning `BridgeHealthStatus`

### Anthropic Frontend Adapter

- [ ] T044 [P] [US1] Create `src/adapters/frontend/anthropic.ts` - Define Anthropic request/response TypeScript interfaces matching Anthropic API spec
- [ ] T045 [US1] Add to `src/adapters/frontend/anthropic.ts` - Implement `AnthropicFrontendAdapter` class implementing `FrontendAdapter<AnthropicRequest, AnthropicResponse>`
- [ ] T046 [US1] Add to `src/adapters/frontend/anthropic.ts` - Implement `toUniversal()` method: extract system parameter into messages array, normalize message format, populate metadata.frontendAdapter
- [ ] T047 [US1] Add to `src/adapters/frontend/anthropic.ts` - Implement `fromUniversal()` method: convert IR response to Anthropic format, include semantic warnings in response metadata
- [ ] T048 [US1] Add to `src/adapters/frontend/anthropic.ts` - Implement `fromUniversalStream()` method for streaming chunks (optional, map chunk types to Anthropic SSE events)

### OpenAI Backend Adapter

- [ ] T049 [P] [US1] Create `src/adapters/backend/openai.ts` - Define OpenAI request/response TypeScript interfaces matching OpenAI API spec
- [ ] T050 [US1] Add to `src/adapters/backend/openai.ts` - Implement `OpenAIBackendAdapter` class implementing `BackendAdapter<OpenAIRequest, OpenAIResponse>`
- [ ] T051 [US1] Add to `src/adapters/backend/openai.ts` - Define `capabilities` property: supportsStreaming=true, supportsTools=true, temperatureRange={min:0, max:2}, maxContextTokens=128000
- [ ] T052 [US1] Add to `src/adapters/backend/openai.ts` - Implement `toProvider()` method: convert IR to OpenAI format, scale temperature 0-1 → 0-2 with warning, handle system messages placement
- [ ] T053 [US1] Add to `src/adapters/backend/openai.ts` - Implement `fromProvider()` method: convert OpenAI response to IR, normalize finish_reason, populate metadata.backendAdapter
- [ ] T054 [US1] Add to `src/adapters/backend/openai.ts` - Implement `chat()` method: make HTTP POST to OpenAI endpoint with auth, handle errors (convert to UniversalError), track latency
- [ ] T055 [US1] Add to `src/adapters/backend/openai.ts` - Implement `healthCheck()` method with simple API ping
- [ ] T056 [US1] Add to `src/adapters/backend/openai.ts` - Implement `estimateTokens()` method with rough estimation (4 chars per token heuristic)

### Index and Exports

- [ ] T057 [P] [US1] Create `src/adapters/frontend/index.ts` - Export `AnthropicFrontendAdapter`
- [ ] T058 [P] [US1] Create `src/adapters/backend/index.ts` - Export `OpenAIBackendAdapter`
- [ ] T059 [P] [US1] Create `src/core/index.ts` - Export `Bridge`
- [ ] T060 [US1] Create `src/index.ts` - Main barrel export: export all types, Bridge, adapters, errors, utils

**Checkpoint**: User Story 1 (MVP) complete - Anthropic frontend can successfully talk to OpenAI backend through Bridge

---

## Phase 4: User Story 2 - Streaming Response Handling (Priority: P1)

**Goal**: Consistent streaming across providers with proper chunk normalization

**Independent Test**: Initialize a streaming request through any frontend/backend combination, verify chunks arrive incrementally with consistent format and the stream can be properly consumed.

### OpenAI Streaming Implementation

- [ ] T061 [US2] Add to `src/adapters/backend/openai.ts` - Implement `chatStream()` async generator method: make streaming POST to OpenAI, parse SSE format with TextDecoder
- [ ] T062 [US2] Add to `src/adapters/backend/openai.ts` - In `chatStream()`: yield `message_start` chunk first with sequence=0
- [ ] T063 [US2] Add to `src/adapters/backend/openai.ts` - In `chatStream()`: parse `data:` lines, extract delta.content, yield `content_delta` chunks with incrementing sequence
- [ ] T064 [US2] Add to `src/adapters/backend/openai.ts` - In `chatStream()`: handle tool_calls deltas, yield `tool_call_delta` chunks
- [ ] T065 [US2] Add to `src/adapters/backend/openai.ts` - In `chatStream()`: detect finish_reason, yield `message_end` chunk with finishReason and usage
- [ ] T066 [US2] Add to `src/adapters/backend/openai.ts` - In `chatStream()`: handle errors with try/catch, yield `error` chunk type, support AbortSignal for cancellation
- [ ] T067 [US2] Add to `src/adapters/backend/openai.ts` - In `chatStream()`: proper cleanup in finally block (reader.releaseLock())

### Anthropic Streaming Implementation

- [ ] T068 [P] [US2] Add to `src/adapters/backend/anthropic.ts` - Create Anthropic backend adapter file if not exists, define Anthropic types
- [ ] T069 [US2] Add to `src/adapters/backend/anthropic.ts` - Implement `AnthropicBackendAdapter` class with capabilities (supportsStreaming=true, temperatureRange={min:0, max:1}, maxContextTokens=200000)
- [ ] T070 [US2] Add to `src/adapters/backend/anthropic.ts` - Implement `toProvider()`: use SystemMessageNormalizer to extract/merge system messages, emit warning if multiple system messages
- [ ] T071 [US2] Add to `src/adapters/backend/anthropic.ts` - Implement `fromProvider()`: convert Anthropic response to IR format
- [ ] T072 [US2] Add to `src/adapters/backend/anthropic.ts` - Implement `chat()` method with Anthropic API endpoint, auth headers
- [ ] T073 [US2] Add to `src/adapters/backend/anthropic.ts` - Implement `chatStream()` async generator: parse Anthropic SSE events (message_start, content_block_delta, message_delta, message_stop)
- [ ] T074 [US2] Add to `src/adapters/backend/anthropic.ts` - In `chatStream()`: map Anthropic event types to UniversalStreamChunk types, normalize stop_reason to finishReason
- [ ] T075 [US2] Add to `src/adapters/backend/anthropic.ts` - In `chatStream()`: handle Anthropic-specific error events, support AbortSignal

### Streaming Utilities

- [ ] T076 [P] [US2] Add to `src/utils/streaming.ts` - Implement `assembleStreamChunks()` function to collect chunks into complete message
- [ ] T077 [P] [US2] Add to `src/utils/streaming.ts` - Implement `validateChunkSequence()` function to detect gaps or out-of-order chunks
- [ ] T078 [P] [US2] Add to `src/utils/streaming.ts` - Implement `createStreamError()` helper for creating error chunks

### Update Exports

- [ ] T079 [P] [US2] Update `src/adapters/backend/index.ts` - Export `AnthropicBackendAdapter`

**Checkpoint**: Streaming works consistently across OpenAI and Anthropic backends with proper chunk normalization

---

## Phase 5: User Story 3 - Dynamic Backend Routing (Priority: P2)

**Goal**: Runtime backend selection with fallback support

**Independent Test**: Configure router with multiple backends, send requests with different routing policies, verify correct backend receives each request and responses route back properly.

### Router Core Implementation

- [ ] T080 [US3] Create `src/core/router.ts` - Implement `Router` class with private `backends` Map, `modelMap` Map, `config` field
- [ ] T081 [US3] Add to `src/core/router.ts` - Implement `Router.register(backend)` method: add backend to map, validate uniqueness
- [ ] T082 [US3] Add to `src/core/router.ts` - Implement `Router.registerAll(backends[])` method
- [ ] T083 [US3] Add to `src/core/router.ts` - Implement `Router.unregister(name)` method with validation (not default, not last)
- [ ] T084 [US3] Add to `src/core/router.ts` - Implement `Router.get(name)`, `Router.list()` accessor methods
- [ ] T085 [US3] Add to `src/core/router.ts` - Implement `Router.select(ir, options)` method: routing algorithm (hints → model mapping → capability matching → load balancing → default)
- [ ] T086 [US3] Add to `src/core/router.ts` - Implement `Router.chat(ir, options)` method: select backend, call backend.chat(), handle fallback on failure (sequential strategy)
- [ ] T087 [US3] Add to `src/core/router.ts` - In `Router.chat()`: track failed backends, implement circuit breaker state transitions, retry logic with maxRetries from config
- [ ] T088 [US3] Add to `src/core/router.ts` - Implement `Router.chatStream(ir, options)` method with fallback support for streaming
- [ ] T089 [US3] Add to `src/core/router.ts` - Implement `Router.mapModel(model, backends[])` method to register model-to-backend mappings
- [ ] T090 [US3] Add to `src/core/router.ts` - Implement `Router.healthCheckAll()` method: check all registered backends in parallel, return Map<name, healthy>

### Circuit Breaker Implementation

- [ ] T091 [P] [US3] Add to `src/core/router.ts` - Implement circuit breaker state machine: Closed → Open (on failure threshold) → Half-Open (on timeout) → Closed (on success)
- [ ] T092 [P] [US3] Add to `src/core/router.ts` - Track failure counts per backend, implement `shouldOpen()`, `shouldRetry()` logic based on CircuitBreakerConfig
- [ ] T093 [P] [US3] Add to `src/core/router.ts` - Implement background health check interval if `config.healthChecks` enabled

### Bridge Integration

- [ ] T094 [US3] Update `src/core/bridge.ts` - Modify constructor to accept `Router` in place of single backend
- [ ] T095 [US3] Update `src/core/bridge.ts` - Update `chat()` and `chatStream()` to detect if backend is Router, delegate routing accordingly

### Update Exports

- [ ] T096 [P] [US3] Update `src/core/index.ts` - Export `Router`

**Checkpoint**: Dynamic routing works with multiple backends, fallback on failure, circuit breaker prevents cascading failures

---

## Phase 6: User Story 4 - Middleware for Cross-Cutting Concerns (Priority: P2)

**Goal**: Composable middleware system for logging, caching, telemetry without modifying adapters

**Independent Test**: Add middleware to a bridge, send requests through it, verify middleware executes and can inspect/transform requests and responses without breaking the adapter chain.

### Middleware Stack Implementation

- [ ] T097 [US4] Create `src/core/middleware-stack.ts` - Implement `MiddlewareStack` class with middleware array, locked state
- [ ] T098 [US4] Add to `src/core/middleware-stack.ts` - Implement `MiddlewareStack.use(middleware)` method: push to array, throw if locked
- [ ] T099 [US4] Add to `src/core/middleware-stack.ts` - Implement `MiddlewareStack.execute(context, finalHandler)` method: compose middleware chain, call in order with next() callbacks
- [ ] T100 [US4] Add to `src/core/middleware-stack.ts` - Implement `MiddlewareStack.lock()` method to prevent further modifications after first request
- [ ] T101 [US4] Add to `src/core/middleware-stack.ts` - Implement context building: create `MiddlewareContext` with request, phase, state Map, metadata, signal, config

### Logging Middleware

- [ ] T102 [P] [US4] Create `src/middleware/logging.ts` - Implement `createLoggingMiddleware(config: LoggingConfig)` factory function
- [ ] T103 [P] [US4] Add to `src/middleware/logging.ts` - In logging middleware: log request phase with requestId, frontendAdapter, model
- [ ] T104 [P] [US4] Add to `src/middleware/logging.ts` - In logging middleware: log response phase with statusCode equivalent, finishReason, latency
- [ ] T105 [P] [US4] Add to `src/middleware/logging.ts` - Respect `includeRequests`, `includeResponses` config flags for privacy
- [ ] T106 [P] [US4] Add to `src/middleware/logging.ts` - Support custom logger interface (console default)

### Telemetry Middleware

- [ ] T107 [P] [US4] Create `src/middleware/telemetry.ts` - Implement `createTelemetryMiddleware(config: TelemetryConfig)` factory function
- [ ] T108 [P] [US4] Add to `src/middleware/telemetry.ts` - Track metrics: request count, success rate, latency (p50, p95, p99)
- [ ] T109 [P] [US4] Add to `src/middleware/telemetry.ts` - Call `config.sink.track()` with event name and properties
- [ ] T110 [P] [US4] Add to `src/middleware/telemetry.ts` - Implement sampling based on `config.sampleRate`

### Caching Middleware

- [ ] T111 [P] [US4] Create `src/middleware/caching.ts` - Implement `createCachingMiddleware(config: CachingConfig)` factory function
- [ ] T112 [P] [US4] Add to `src/middleware/caching.ts` - Generate cache key from request (default: hash of model+messages+temperature, exclude metadata/providerHints)
- [ ] T113 [P] [US4] Add to `src/middleware/caching.ts` - Check cache before calling next(), return cached response if hit
- [ ] T114 [P] [US4] Add to `src/middleware/caching.ts` - Store response in cache after next() call with TTL from config
- [ ] T115 [P] [US4] Add to `src/middleware/caching.ts` - Use config.cache interface (get, set, delete, clear)

### Retry Middleware

- [ ] T116 [P] [US4] Create `src/middleware/retry.ts` - Implement `createRetryMiddleware(config: RetryConfig)` factory function
- [ ] T117 [P] [US4] Add to `src/middleware/retry.ts` - Wrap next() call in try/catch, check if error is retryable
- [ ] T118 [P] [US4] Add to `src/middleware/retry.ts` - Implement exponential backoff: delay = retryDelayMs * (backoffMultiplier ** attempt)
- [ ] T119 [P] [US4] Add to `src/middleware/retry.ts` - Respect maxAttempts, call custom shouldRetry() function if provided

### Transform Middleware

- [ ] T120 [P] [US4] Create `src/middleware/transform.ts` - Implement `createPromptTransformMiddleware(transformer)` factory function
- [ ] T121 [P] [US4] Add to `src/middleware/transform.ts` - Call transformer function on context.request, replace context.request with result before calling next()

### Update Bridge Integration

- [ ] T122 [US4] Update `src/core/bridge.ts` - Replace inline middleware handling with `MiddlewareStack` class
- [ ] T123 [US4] Update `src/core/bridge.ts` - In `chat()`: build context, execute middleware stack with backend.chat as final handler
- [ ] T124 [US4] Update `src/core/bridge.ts` - In `chatStream()`: execute middleware stack for request phase (response middleware skipped for streaming, or applied per chunk if middleware supports it)

### Index and Exports

- [ ] T125 [P] [US4] Create `src/middleware/index.ts` - Export all middleware factory functions
- [ ] T126 [P] [US4] Update `src/core/index.ts` - Export `MiddlewareStack` (if needed publicly)

**Checkpoint**: Middleware system works, logging/telemetry/caching/retry middleware can be composed without modifying adapters

---

## Phase 7: User Story 5 - Semantic Drift Warnings (Priority: P3)

**Goal**: Transparency about lossy conversions through metadata warnings

**Independent Test**: Send request with parameters that have different semantics across providers, verify system emits warnings or metadata about potential semantic drift.

### Enhanced Warning System

- [ ] T127 [P] [US5] Add to `src/utils/parameter-normalizer.ts` - Implement `StopSequenceNormalizer.toProvider()` function: check provider max stop sequences (Anthropic: 4), truncate with warning
- [ ] T128 [P] [US5] Add to `src/utils/parameter-normalizer.ts` - Add warning for unsupported stop sequences (Chrome AI)
- [ ] T129 [P] [US5] Add to `src/utils/validation.ts` - Enhance `CapabilityChecks.checkCompatibility()` to return comprehensive warnings array for all unsupported features

### Backend Adapter Warning Integration

- [ ] T130 [US5] Update `src/adapters/backend/openai.ts` - In `toProvider()`: call CapabilityChecks.checkCompatibility(), collect warnings, attach to metadata
- [ ] T131 [US5] Update `src/adapters/backend/anthropic.ts` - In `toProvider()`: call CapabilityChecks.checkCompatibility(), check stop sequences limit (max 4), collect warnings
- [ ] T132 [US5] Update `src/adapters/backend/openai.ts` - In `toProvider()`: use ParameterNormalizer.denormalizeTemperature() to scale and collect temperature warnings
- [ ] T133 [US5] Update `src/adapters/backend/anthropic.ts` - In `toProvider()`: check temperature in 0-1 range, emit warning if out of range
- [ ] T134 [US5] Update `src/adapters/backend/openai.ts` - In `toProvider()`: estimate token count, call checkTokenLimit(), collect warnings if exceeds 128k
- [ ] T135 [US5] Update `src/adapters/backend/anthropic.ts` - In `toProvider()`: estimate token count, call checkTokenLimit(), collect warnings if exceeds 200k

### Metadata Propagation

- [ ] T136 [US5] Update `src/core/bridge.ts` - In `chat()`: collect warnings from frontend.toUniversal(), backend operations, merge into response.metadata.warnings
- [ ] T137 [US5] Update `src/core/bridge.ts` - If `config.strictMode` is enabled, throw error instead of warning when semantic drift detected

### Documentation in Code

- [ ] T138 [P] [US5] Add to `src/types/ir.ts` - Add JSDoc comments to SemanticWarning documenting each warning type with examples
- [ ] T139 [P] [US5] Create `src/utils/warnings.ts` - Implement helper functions: `formatWarnings()`, `groupWarningsByType()`, `hasWarningType()` for developers

**Checkpoint**: All semantic drift points documented and surfaced through warnings, developers can inspect metadata.warnings to understand transformations

---

## Phase 8: User Story 6 - Multi-Provider Parallel Queries (Priority: P3)

**Goal**: Fan-out to multiple providers simultaneously for A/B testing, consensus, or latency optimization

**Independent Test**: Configure bridge for fan-out mode, send single request, verify it reaches multiple backends in parallel and responses can be collected and compared.

### Fan-Out Implementation

- [ ] T140 [US6] Add to `src/core/router.ts` - Implement `Router.fanOut(ir, options: FanOutOptions)` method
- [ ] T141 [US6] Add to `src/core/router.ts` - In `fanOut()`: filter backends based on options.backends array (or use all if empty)
- [ ] T142 [US6] Add to `src/core/router.ts` - In `fanOut()` with mode='all': use Promise.all() to execute chat() on all backends in parallel
- [ ] T143 [US6] Add to `src/core/router.ts` - In `fanOut()` with mode='race': use Promise.race() to return first successful response, cancel others via AbortController
- [ ] T144 [US6] Add to `src/core/router.ts` - In `fanOut()` with mode='fastest-n': use Promise.allSettled(), return first N fulfilled promises
- [ ] T145 [US6] Add to `src/core/router.ts` - In `fanOut()`: implement timeout via AbortController, cancel all pending requests on timeout
- [ ] T146 [US6] Add to `src/core/router.ts` - In `fanOut()`: collect all responses, normalize, return array with metadata indicating which backend provided each response

### Response Aggregation

- [ ] T147 [P] [US6] Create `src/utils/aggregation.ts` - Implement `compareResponses()` function: take array of UniversalChatResponse, return similarity metrics
- [ ] T148 [P] [US6] Add to `src/utils/aggregation.ts` - Implement `selectBestResponse()` function with selection strategy (fastest, longest, consensus)
- [ ] T149 [P] [US6] Add to `src/utils/aggregation.ts` - Implement `aggregateUsage()` function to sum token usage across multiple responses

### Bridge Integration

- [ ] T150 [US6] Add to `src/core/bridge.ts` - Add `Bridge.fanOut(request, options)` method that delegates to router.fanOut()
- [ ] T151 [US6] Add to `src/core/bridge.ts` - In `fanOut()`: apply frontend.toUniversal() to request, call router.fanOut(), map responses with frontend.fromUniversal()

### Update Exports

- [ ] T152 [P] [US6] Update `src/utils/index.ts` - Export aggregation utilities

**Checkpoint**: Fan-out queries work across multiple providers, responses can be aggregated/compared, first-response mode cancels slower backends

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Complete remaining adapters, polish features, documentation

### Remaining Backend Adapters

- [ ] T153 [P] Create `src/adapters/backend/gemini.ts` - Implement Gemini backend adapter with types, capabilities (supportsStreaming=true, maxContextTokens=2000000), toProvider(), fromProvider(), chat(), chatStream()
- [ ] T154 [P] Add to `src/adapters/backend/gemini.ts` - Handle systemInstruction field for system messages, normalize finishReason, parse streaming response
- [ ] T155 [P] Create `src/adapters/backend/ollama.ts` - Implement Ollama backend adapter with types, capabilities (supportsStreaming=true, context window varies by model), toProvider(), fromProvider(), chat(), chatStream()
- [ ] T156 [P] Add to `src/adapters/backend/ollama.ts` - Handle JSONL streaming format, parse `done: true` completion signal
- [ ] T157 [P] Create `src/adapters/backend/mistral.ts` - Implement Mistral backend adapter (similar to OpenAI format), capabilities, all methods
- [ ] T158 [P] Create `src/adapters/backend/chrome-ai.ts` - Implement Chrome AI backend adapter with window.ai detection, AsyncIterator streaming, capabilities (always streams, no model selection)
- [ ] T159 [P] Add to `src/adapters/backend/chrome-ai.ts` - Handle initialPrompts for system messages, convert AsyncIterator to UniversalStreamResponse format

### Remaining Frontend Adapters

- [ ] T160 [P] Create `src/adapters/frontend/openai.ts` - Implement OpenAI frontend adapter (mirrors OpenAI format, minimal transformation), toUniversal(), fromUniversal()
- [ ] T161 [P] Create `src/adapters/frontend/gemini.ts` - Implement Gemini frontend adapter, handle contents[] and systemInstruction field normalization
- [ ] T162 [P] Create `src/adapters/frontend/ollama.ts` - Implement Ollama frontend adapter, handle prompt string conversion to messages
- [ ] T163 [P] Create `src/adapters/frontend/mistral.ts` - Implement Mistral frontend adapter (similar to OpenAI)
- [ ] T164 [P] Create `src/adapters/frontend/chrome-ai.ts` - Implement Chrome AI frontend adapter, handle initialPrompts mapping

### Additional Middleware

- [ ] T165 [P] Create `src/middleware/rate-limit.ts` - Implement rate limiting middleware with token bucket or sliding window algorithm, config: maxRequests, windowMs, keyGenerator
- [ ] T166 [P] Create `src/middleware/error-handler.ts` - Implement error handling middleware: catch errors, transform with custom handler function, emit structured error response

### Utility Enhancements

- [ ] T167 [P] Add to `src/utils/streaming.ts` - Implement `streamToArray()` helper: collect all chunks from AsyncGenerator into array
- [ ] T168 [P] Add to `src/utils/validation.ts` - Implement JSON schema validation for UniversalTool.function.parameters
- [ ] T169 [P] Add to `src/errors/index.ts` - Implement `ErrorUtils` namespace: `isRetryable()`, `getRetryDelay()`, `statusToCategory()`, `formatError()` utility functions

### Configuration & Validation

- [ ] T170 [P] Create `src/utils/config.ts` - Implement `ConfigValidation` namespace: `validateBridgeConfig()`, `validateRouterConfig()`, `validateBackendAdapterConfig()` with defaults
- [ ] T171 [P] Add to `src/utils/config.ts` - Implement `applyDefaults<T>()` generic function for merging partial configs with defaults

### Update All Exports

- [ ] T172 Update `src/adapters/frontend/index.ts` - Export all frontend adapters (OpenAI, Anthropic, Gemini, Ollama, Mistral, Chrome AI)
- [ ] T173 Update `src/adapters/backend/index.ts` - Export all backend adapters (OpenAI, Anthropic, Gemini, Ollama, Mistral, Chrome AI)
- [ ] T174 Update `src/middleware/index.ts` - Export rate limiting and error handler middleware
- [ ] T175 Update `src/utils/index.ts` - Export config validation utilities
- [ ] T176 Update `src/index.ts` - Ensure all public APIs are exported in main barrel file

### Build & Package

- [ ] T177 Create build script in `package.json` - Compile to ESM (dist/esm/), CommonJS (dist/cjs/), type declarations (dist/types/)
- [ ] T178 [P] Configure package.json exports field - Map ".", "./adapters/frontend/*", "./adapters/backend/*", "./middleware/*" to correct build outputs
- [ ] T179 Test ESM import - Create test file importing package as ESM module, verify it works
- [ ] T180 Test CommonJS require - Create test file requiring package as CommonJS, verify it works
- [ ] T181 Verify type declarations - Run `tsc --noEmit` on consuming project using the built package

### Documentation

- [ ] T182 [P] Create `examples/basic-usage.ts` - Simple example: Anthropic frontend + OpenAI backend with Bridge
- [ ] T183 [P] Create `examples/streaming.ts` - Example showing streaming with chunk handling
- [ ] T184 [P] Create `examples/routing.ts` - Example showing router with multiple backends and fallback
- [ ] T185 [P] Create `examples/middleware.ts` - Example showing logging and caching middleware
- [ ] T186 [P] Update `README.md` - Add installation, quick start, examples, API overview, link to full docs
- [ ] T187 [P] Create `docs/API.md` - Full API reference generated from TSDoc comments
- [ ] T188 [P] Create `docs/MIGRATION.md` - Migration guide for developers using provider SDKs directly
- [ ] T189 [P] Create `CHANGELOG.md` - Document v1.0.0 initial release

### Pre-publish Validation

- [ ] T190 Run `npm run typecheck` - Ensure no TypeScript errors
- [ ] T191 Run `npm run build` - Ensure builds succeed for ESM, CJS, and types
- [ ] T192 Check bundle size - Verify dist output is under 50KB minified (per plan.md performance goal)
- [ ] T193 Validate package.json metadata - name, version, description, keywords, license, repository, bugs, homepage
- [ ] T194 Test dry-run publish - Run `npm publish --dry-run` to preview package contents

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - User Story 1 (P1) - MVP: Independent, can start after Phase 2
  - User Story 2 (P1) - Streaming: Depends on US1 (needs backend adapters from US1)
  - User Story 3 (P2) - Router: Depends on US1 (needs backends), can run parallel with US2 after US1
  - User Story 4 (P2) - Middleware: Depends on US1 (needs Bridge), can run parallel with US2/US3
  - User Story 5 (P3) - Warnings: Depends on US1 (enhances existing adapters)
  - User Story 6 (P3) - Fan-out: Depends on US3 (needs Router)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### Critical Path

1. Setup (Phase 1) → ~1 hour
2. Foundational (Phase 2) → ~6-8 hours (core types, base interfaces, validation)
3. User Story 1 (Phase 3) → ~8-10 hours (MVP: Bridge + 2 adapters)
4. User Story 2 (Phase 4) → ~4-6 hours (streaming)
5. User Story 3 (Phase 5) → ~6-8 hours (router with circuit breaker)
6. User Story 4 (Phase 6) → ~6-8 hours (middleware system)
7. User Story 5 (Phase 7) → ~2-4 hours (enhanced warnings)
8. User Story 6 (Phase 8) → ~3-4 hours (fan-out)
9. Polish (Phase 9) → ~8-12 hours (4 more adapters, docs, packaging)

**Total Estimated Time**: ~44-63 hours for complete implementation

### Parallel Opportunities

- **Within Phase 1 (Setup)**: T003, T004, T005, T006, T007, T008 can all run in parallel
- **Within Phase 2 (Foundational)**: Types can be created in parallel (T009-T016, T017-T022, T023, T028, T029, T030 all parallel), utils in parallel (T031-T035)
- **Phase 3 (US1)**: T044 (Anthropic types) and T049 (OpenAI types) can run in parallel
- **Phase 4 (US2)**: T068 (Anthropic backend creation) can run parallel with OpenAI streaming work
- **Phase 4 (US4) Middleware**: All middleware implementations (T102-T121) can be built in parallel once MiddlewareStack exists
- **Phase 9 (Polish)**: All remaining adapters (T153-T164) can be built in parallel, all examples (T182-T185) in parallel, all docs (T186-T189) in parallel

### Recommended Implementation Order

**Week 1 - MVP (US1 + US2)**:
1. Phase 1: Setup (T001-T008)
2. Phase 2: Foundational (T009-T037) - Critical blocking work
3. Phase 3: User Story 1 (T038-T060) - First working demo
4. Phase 4: User Story 2 (T061-T079) - Streaming support

**Week 2 - Production Features (US3 + US4)**:
5. Phase 5: User Story 3 (T080-T096) - Router and fallback
6. Phase 6: User Story 4 (T097-T126) - Middleware system

**Week 3 - Advanced & Polish (US5 + US6 + Polish)**:
7. Phase 7: User Story 5 (T127-T139) - Warning system
8. Phase 8: User Story 6 (T140-T152) - Fan-out queries
9. Phase 9: Polish (T153-T194) - Complete remaining adapters, documentation, publish

---

## Notes

- [P] prefix = Tasks that can run in parallel (work on different files or have no dependencies)
- [US#] prefix = User story tag for traceability (US1=User Story 1, etc.)
- File paths are absolute from repository root: `/Users/johnhenry/Projects/ai.matey.universal/`
- Each user story is independently testable and deliverable
- Stop at any checkpoint to validate story independently before proceeding
- Streaming (US2) depends on basic adapters from US1, so implement US1 fully first
- Router (US3) needs multiple backends to be meaningful, so US1 backends are prerequisite
- Middleware (US4) operates on Bridge, so Bridge from US1 must exist first
- All numeric task estimates assume single experienced developer
- Zero-dependency constraint: No external runtime dependencies allowed (only dev dependencies for TypeScript, testing)
- Constitution compliance: All principles from research.md validated - no violations detected
