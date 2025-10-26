# Feature Specification: Universal AI Adapter System

**Feature Branch**: `001-universal-ai-adapter`
**Created**: 2025-10-13
**Status**: Draft
**Input**: User description: "Universal AI Adapter System with hybrid architecture (Bridge + Router + Middleware) supporting OpenAI, Anthropic, Gemini, Ollama, Mistral, and Chrome AI APIs. Must handle system message placement differences, streaming protocol variations, and semantic drift. Implement adapters, routers, middleware, and utilities as discussed in chatgpt-conversation.md. Use latest TypeScript features."

## User Scenarios & Testing

### User Story 1 - Basic Cross-Provider Compatibility (Priority: P1)

A developer wants to write their application code once using an Anthropic-style interface, but have the flexibility to run it against OpenAI's API without changing their code.

**Why this priority**: Core value proposition - demonstrates the fundamental adapter pattern working. This is the MVP that proves the concept.

**Independent Test**: Create a simple chat completion request using Anthropic frontend interface, connect to OpenAI backend, verify response comes back correctly formatted for Anthropic expectations.

**Acceptance Scenarios**:

1. **Given** a developer has written code using Anthropic message format, **When** they connect Anthropic frontend to OpenAI backend, **Then** their code runs without modification and receives proper responses
2. **Given** a system message in Anthropic format (separate `system` parameter), **When** routed to OpenAI backend, **Then** system message is correctly placed in OpenAI's messages array
3. **Given** multiple AI providers are available, **When** developer switches backends via configuration, **Then** application behavior remains consistent

---

### User Story 2 - Streaming Response Handling (Priority: P1)

A developer needs real-time streaming responses from AI models regardless of which provider they're using, with consistent streaming behavior across different provider protocols.

**Why this priority**: Streaming is critical for user experience in chat applications. Different providers use incompatible streaming formats that must be normalized.

**Independent Test**: Initialize a streaming request through any frontend/backend combination, verify chunks arrive incrementally with consistent format and the stream can be properly consumed.

**Acceptance Scenarios**:

1. **Given** a streaming request through OpenAI frontend to Anthropic backend, **When** response streams back, **Then** chunks arrive in consistent format regardless of provider differences
2. **Given** a streaming response is in progress, **When** user cancels the request, **Then** stream terminates cleanly across all providers
3. **Given** different providers with varying chunk sizes, **When** streaming, **Then** application receives normalized chunks with sequence metadata

---

### User Story 3 - Dynamic Backend Routing (Priority: P2)

A developer wants to route requests to different AI providers based on runtime conditions (model availability, cost, performance) without changing application code.

**Why this priority**: Enables production use cases like failover, load balancing, and cost optimization. Requires router infrastructure.

**Independent Test**: Configure router with multiple backends, send requests with different routing policies, verify correct backend receives each request and responses route back properly.

**Acceptance Scenarios**:

1. **Given** multiple backends registered in router, **When** developer specifies backend preference in request, **Then** request routes to specified backend
2. **Given** primary backend is unavailable, **When** request fails, **Then** router automatically tries fallback backend
3. **Given** model name is specified, **When** router knows which backends support that model, **Then** request routes to appropriate backend automatically

---

### User Story 4 - Middleware for Cross-Cutting Concerns (Priority: P2)

A developer needs to add logging, prompt transformation, caching, or telemetry without modifying adapter code or application logic.

**Why this priority**: Production systems need observability and policy enforcement. Middleware keeps these concerns separate from core translation logic.

**Independent Test**: Add middleware to a bridge, send requests through it, verify middleware executes and can inspect/transform requests and responses without breaking the adapter chain.

**Acceptance Scenarios**:

1. **Given** logging middleware is added to bridge, **When** requests flow through, **Then** all requests and responses are logged with request IDs
2. **Given** prompt rewriting middleware, **When** request contains specific patterns, **Then** middleware transforms prompt before reaching backend
3. **Given** multiple middleware in stack, **When** request processes, **Then** middleware executes in deterministic order
4. **Given** middleware encounters error, **When** error handling middleware exists, **Then** error is caught and handled without breaking the chain

---

### User Story 5 - Semantic Drift Warnings (Priority: P3)

A developer wants to understand when API translations might alter behavior due to semantic differences between providers (temperature ranges, token limits, parameter interpretations).

**Why this priority**: Trust and transparency - developers need to know when translations are lossy or might produce unexpected results.

**Independent Test**: Send request with parameters that have different semantics across providers, verify system emits warnings or metadata about potential semantic drift.

**Acceptance Scenarios**:

1. **Given** temperature value appropriate for Anthropic (0-1), **When** routing to OpenAI (0-2), **Then** system documents the scaling transformation
2. **Given** feature not supported by target backend, **When** request includes that feature, **Then** clear warning indicates unsupported capability
3. **Given** system message constraints differ between providers, **When** multiple system messages provided, **Then** adapter warns about merging or constraints

---

### User Story 6 - Multi-Provider Parallel Queries (Priority: P3)

A developer wants to send the same prompt to multiple providers simultaneously and compare responses or use the first available result.

**Why this priority**: Enables advanced use cases like consensus, A/B testing, and latency optimization. Demonstrates router's orchestration capabilities.

**Independent Test**: Configure bridge for fan-out mode, send single request, verify it reaches multiple backends in parallel and responses can be collected and compared.

**Acceptance Scenarios**:

1. **Given** fan-out configuration with multiple backends, **When** single request is sent, **Then** all backends receive request simultaneously
2. **Given** multiple responses arriving, **When** developer needs fastest response, **Then** first complete response is returned while others are cancelled
3. **Given** responses from different providers, **When** aggregation is needed, **Then** responses are normalized and comparable

---

### Edge Cases

- What happens when a provider returns an error code that doesn't map to standard error categories?
- How does the system handle provider-specific features (like OpenAI's function calling) when routing to providers that don't support them?
- What occurs when streaming is interrupted mid-response due to network failure?
- How are extremely large context windows (200k+ tokens) handled when routing to providers with smaller limits?
- What happens when system message constraints conflict (e.g., Anthropic's single system parameter vs OpenAI's multiple system messages)?
- How does the system behave when a backend takes significantly longer than expected to respond?
- What happens when middleware modifies a request in a way that makes it invalid for the target backend?

## Requirements

### Functional Requirements

#### Core Adapter Requirements

- **FR-001**: System MUST provide a universal Intermediate Representation (IR) that can represent chat completion requests and responses from any supported provider
- **FR-002**: System MUST support bidirectional translation between provider-specific formats and the universal IR
- **FR-003**: Frontend adapters MUST normalize provider-specific request formats into universal IR
- **FR-004**: Backend adapters MUST transform universal IR into provider-specific API calls
- **FR-005**: System MUST support at minimum: OpenAI, Anthropic, Google Gemini, Ollama, Mistral, and Chrome AI (6 providers)

#### System Message Handling

- **FR-006**: System MUST correctly handle system message placement differences across providers (OpenAI: in messages array, Anthropic: separate parameter, Gemini: systemInstruction field, Chrome AI: initialPrompts array)
- **FR-007**: When multiple system messages are provided but target backend supports only one, system MUST merge them with clear documentation of the transformation
- **FR-008**: System MUST preserve system message intent across all provider translations

#### Streaming Support

- **FR-009**: System MUST support streaming responses through async iterators (AsyncGenerator pattern)
- **FR-010**: System MUST normalize different provider streaming protocols (OpenAI SSE, Anthropic SSE events, Ollama JSONL, Gemini streaming, Chrome AI async) into consistent IR chunks
- **FR-011**: Streaming chunks MUST include sequence metadata and completion state indicators
- **FR-012**: System MUST support stream cancellation via AbortController across all providers
- **FR-013**: System MUST handle partial response assembly for providers that stream at different granularities

#### Bridge Architecture

- **FR-014**: System MUST provide primary API: `new Bridge(frontend, backend)` or `frontend.connect(backend)` for simple use cases
- **FR-015**: Bridge MUST support both non-streaming (`chat()`) and streaming (`chatStream()`) methods
- **FR-016**: Bridge MUST embed router for dynamic backend selection
- **FR-017**: Bridge MUST support middleware stack for request/response transformation

#### Router Capabilities

- **FR-018**: Router MUST maintain registry of available backends with capability metadata
- **FR-019**: Router MUST support dynamic backend selection at request time
- **FR-020**: Router MUST support fallback strategies when primary backend fails
- **FR-021**: Router MUST support parallel dispatch (fan-out) to multiple backends simultaneously
- **FR-022**: Router MUST provide model-aware routing (match model names to appropriate backends)

#### Middleware System

- **FR-023**: System MUST support composable middleware that operates on universal IR
- **FR-024**: Middleware execution order MUST be deterministic and configurable
- **FR-025**: Middleware MUST support async operations with proper error propagation
- **FR-026**: System MUST provide common middleware: logging, telemetry, prompt transformation, caching
- **FR-027**: Middleware MUST be able to inspect and modify requests before backend, responses before frontend

#### Error Handling

- **FR-028**: System MUST normalize provider-specific errors into universal error format
- **FR-029**: Errors MUST include adapter provenance (which adapter failed, IR state at failure)
- **FR-030**: System MUST provide actionable error messages for common failure modes (auth, rate limits, token limits, unsupported features)
- **FR-031**: Validation errors MUST surface immediately with clear indication of what violated constraints

#### Type Safety & Developer Experience

- **FR-032**: System MUST use TypeScript 5.0+ with strict mode enabled
- **FR-033**: All adapter interfaces MUST be strongly typed with explicit input/output types
- **FR-034**: System MUST use discriminated unions for message types to ensure type safety
- **FR-035**: System MUST use template literal types for compile-time string validation where applicable
- **FR-036**: System MUST use const type parameters to preserve literal types through transformations

#### Semantic Drift Handling

- **FR-037**: Adapters MUST declare semantic fidelity level in metadata
- **FR-038**: System MUST provide warnings when parameter conversions are lossy or may alter behavior
- **FR-039**: System MUST document all known semantic drift points (temperature ranges, token counting, parameter interpretations)
- **FR-040**: IR transformations MUST include semantic version markers for debugging

#### Observability

- **FR-041**: All adapters MUST emit structured logs at configurable levels
- **FR-042**: IR transformations MUST be traceable with unique request IDs
- **FR-043**: System MUST support telemetry hooks for latency tracking
- **FR-044**: System MUST provide debug mode showing full transformation pipeline

### Key Entities

- **Universal IR (Intermediate Representation)**: Technology-agnostic schema representing AI chat interactions. Contains normalized messages, parameters, and metadata. Serves as translation contract.

- **Frontend Adapter**: Accepts provider-specific request format, translates to universal IR. Represents how callers want to interact (Anthropic-style, OpenAI-style, etc.).

- **Backend Adapter**: Accepts universal IR, makes actual API call to provider, translates response back to IR. Handles provider-specific networking and auth.

- **Bridge**: Primary developer-facing API. Connects frontend to backend, embeds router and middleware stack. Provides `chat()` and `chatStream()` methods.

- **Router**: Manages backend registry, handles dynamic selection, fallback, and parallel dispatch. Provides orchestration capabilities.

- **Middleware**: Composable transformation layer. Operates on IR to provide logging, caching, prompt rewriting, telemetry without modifying adapters.

- **Message**: Individual conversation turn with role (system/user/assistant) and content. May be multi-part (text + images). Normalized across providers in IR.

- **Stream Chunk**: Fragment of streaming response. Includes delta content, sequence number, completion state. Normalized across provider streaming protocols.

- **Capability Metadata**: Declares what features each adapter supports. Used for routing decisions and compatibility warnings.

- **Semantic Transform**: Documentation of parameter conversions that may alter behavior. Tracks temperature scaling, token limit differences, etc.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Developer can write application using one provider's interface and switch to any other supported provider by changing only the backend configuration (< 5 lines of code)
- **SC-002**: Streaming responses from any provider arrive incrementally with consistent behavior regardless of underlying protocol differences
- **SC-003**: Adapter translation overhead adds less than 5 milliseconds per request (p95 latency)
- **SC-004**: System correctly handles and documents 100% of known system message placement scenarios across all 6 supported providers
- **SC-005**: Middleware can be added or removed without modifying any adapter code or application logic
- **SC-006**: Error messages include enough context that developers can diagnose issues without inspecting adapter internals
- **SC-007**: Type system catches incompatible adapter combinations at compile time, before runtime
- **SC-008**: Router can successfully fail over to backup provider within one retry when primary is unavailable
- **SC-009**: Parallel queries to multiple providers complete and return normalized comparable results
- **SC-010**: System emits warnings for 100% of documented semantic drift scenarios where parameter meanings differ between providers

### Quality Outcomes

- **SC-011**: Developers can understand the full request transformation pipeline in debug mode
- **SC-012**: Adding support for a new AI provider requires implementing only the adapter interfaces without modifying core system
- **SC-013**: Application code using the system requires no provider-specific knowledge or conditional logic
- **SC-014**: All streaming operations can be cancelled cleanly without resource leaks
- **SC-015**: Semantic incompatibilities between providers are explicitly documented and surfaced to developers

## Assumptions

- AI provider APIs are accessible via HTTP/HTTPS and follow REST-like patterns
- Developers using this system have basic familiarity with async/await patterns in TypeScript
- Provider authentication (API keys) is handled external to the adapter system (environment variables or configuration)
- Network connectivity is reliable enough for retries to be effective (not offline-first scenario)
- All supported providers offer chat/completion style interactions (not optimizing for embedding or fine-tuning APIs initially)
- Providers maintain backward compatibility in their API versions or changes can be absorbed by adapter updates
- TypeScript compilation is available in the development environment
- JSON is sufficient as the serialization format for IR (no binary protocol needed initially)
- Streaming capabilities are provided by the JavaScript environment (ReadableStream or AsyncGenerator support)
- Provider rate limits are handled by the providers themselves or external rate limiting layers
- Multi-turn conversations maintain history on the client side (system doesn't persist conversation state)

## Dependencies

- TypeScript 5.0+ compiler and runtime environment (Node.js or modern browser)
- HTTP client library for making provider API calls (fetch API or equivalent)
- Access to AI provider APIs (API keys, network connectivity to provider endpoints)
- Understanding of chatgpt-conversation.md design discussions (hybrid architecture, IR design principles)

## Out of Scope

- Provider API key management or authentication flows
- Conversation state persistence or database storage
- Provider-specific advanced features not representable in universal IR (e.g., OpenAI's GPT-4 vision beyond basic image support)
- Cost tracking or billing aggregation across providers
- Real-time provider health monitoring or uptime dashboards
- Automatic provider API discovery or schema generation
- Support for non-chat AI capabilities (embeddings, fine-tuning, DALL-E, etc.)
- Client-side UI components or chat interfaces
- Provider signup or account creation workflows
- Compliance or legal reviews of provider terms of service
- Multi-tenant isolation or provider access controls beyond API keys
- Automatic prompt optimization or A/B testing frameworks
