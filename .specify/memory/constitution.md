<!--
  Sync Impact Report:
  Version change: (initial) → 1.0.0
  Constitution created from scratch for Universal AI Adapter System
  Based on: Hybrid approach with Router + Middleware (chatgpt-conversation.md)
  Templates requiring updates: All templates are compatible with this initial constitution
  Follow-up TODOs: None - all placeholders filled
-->

# Universal AI Adapter System Constitution

## Core Principles

### I. Semantic Preservation

The system MUST preserve semantic intent across API translations while explicitly documenting known incompatibilities and lossy conversions. Every adapter MUST declare its semantic fidelity level and provide warnings when conversions are lossy.

**Rationale**: Different AI APIs have subtle semantic differences (e.g., temperature ranges 0-1 vs 0-2, system message placement constraints). The IR cannot magically reconcile these, but it can make the translations transparent and predictable.

**Requirements**:
- Document all known semantic drift points in adapter metadata
- Provide capability negotiation for features that don't map 1:1
- Include semantic version markers in IR transformations
- Warn users when conversions may alter behavior

### II. Intermediate Representation (IR) First

All communication between frontends and backends MUST flow through a universal IR schema. The IR serves as the single source of truth for adapter behavior and MUST be versioned independently.

**Rationale**: Like LLVM IR for compilers or ODBC for databases, a stable IR enables swappable adapters while maintaining predictable behavior.

**Requirements**:
- IR schema is technology-agnostic and provider-neutral
- All adapters translate to/from IR, never directly between providers
- IR includes metadata for provenance tracking and debugging
- IR supports streaming, multimodal content, and tool calling as first-class capabilities

### III. Adapter Independence

Frontends and backends MUST be independently swappable without knowledge of each other's implementation. Adapters communicate only through the IR contract.

**Rationale**: Enables the core value proposition: any frontend can connect to any backend. Also enables testing, mocking, and ecosystem growth.

**Requirements**:
- Adapters implement standard `FrontendAdapter` or `BackendAdapter` interfaces
- No direct dependencies between specific frontend/backend pairs
- Each adapter is self-contained with its own error handling
- Adapters declare their capabilities through metadata

### IV. Hybrid Architecture (Bridge + Router + Middleware)

The system MUST provide simple ergonomics (`frontend.connect(backend)`) while embedding sophisticated routing and middleware capabilities underneath.

**Rationale**: Balances developer experience with extensibility. The hybrid approach from chatgpt-conversation.md solves most engineering problems while leaving room for advanced features.

**Requirements**:
- Primary API: `new Bridge(frontend, backend)` or `frontend.connect(backend)`
- Embedded router for dynamic backend selection and orchestration
- Middleware stack for logging, transforms, policy enforcement
- Support for parallel dispatch and fan-out queries

### V. Middleware Composability

All cross-cutting concerns (logging, caching, prompt rewriting, security, telemetry) MUST be implemented as composable middleware that operates on the IR.

**Rationale**: Keeps adapters focused on translation. Middleware provides the extensibility needed for production use cases without polluting adapter logic.

**Requirements**:
- Middleware operates on UniversalRequest/UniversalResponse types
- Middleware can be added/removed without modifying adapters
- Middleware execution order is deterministic and configurable
- Support for async middleware with proper error propagation

### VI. Explicit Over Implicit

All type conversions, semantic transformations, and capability mismatches MUST be explicit and visible to developers. No silent failures or unexpected behavior changes.

**Rationale**: Trust is critical. Developers need to understand exactly what happens when a request crosses adapter boundaries.

**Requirements**:
- Type-safe TypeScript with strict mode enabled
- Adapter methods have clear contracts with typed inputs/outputs
- Validation errors surface immediately with actionable messages
- Debug mode shows full transformation pipeline

### VII. Latest TypeScript Features

The implementation MUST use modern TypeScript features (5.0+) including template literal types, const type parameters, satisfies operator, and advanced generics to ensure type safety and developer experience.

**Rationale**: Strong typing prevents runtime errors in adapter chains and provides excellent IDE support.

**Requirements**:
- Use TypeScript 5.0+ features for maximum type safety
- Leverage discriminated unions for message types
- Use template literal types for model name validation where applicable
- Employ const type parameters to preserve literal types

## API Compatibility Constraints

### System Message Handling

Different providers handle system messages differently:
- **OpenAI**: System messages can appear anywhere in message array
- **Anthropic**: System is a separate `system` parameter, not in messages array
- **Chrome AI**: Uses `initialPrompts` array with system role
- **Gemini**: Uses systemInstruction field separate from contents
- **Ollama**: System message typically first in messages array

**Adapter Requirements**:
- Frontends MUST normalize system messages into IR format
- Backends MUST transform system messages to provider-specific format
- Adapters MUST document system message placement constraints
- Multi-system-message scenarios MUST be handled gracefully (merge or error)

### Streaming Protocol Differences

Providers use different streaming approaches:
- **OpenAI**: Server-Sent Events (SSE) with delta objects
- **Anthropic**: SSE with event types (message_start, content_block_delta, etc.)
- **Ollama**: JSON lines (JSONL) with metadata
- **Gemini**: Streaming via generateContentStream
- **Chrome AI**: Native async iterators via promptStreaming

**Adapter Requirements**:
- IR MUST support AsyncGenerator<UniversalChunk> for streaming
- Backends normalize provider streams into IR chunks
- Chunk metadata includes sequence numbers and completion state
- Support for stream cancellation via AbortController

### Token Limits and Context Windows

Different models have different token limits and counting methods:
- Token limits vary by model (4k, 8k, 32k, 128k, 200k+)
- Some APIs count tokens in requests, others don't
- System message tokens counted differently

**Adapter Requirements**:
- IR includes optional token usage metadata
- Adapters document known token limit constraints
- Provide utility functions for approximate token counting
- Surface token limit errors with actionable guidance

## Development Workflow

### Type-First Development

All interfaces, types, and IR schemas MUST be defined before implementation begins. The IR schema serves as the contract between all components.

**Process**:
1. Define IR types in `src/types/ir.ts`
2. Define adapter interfaces in `src/types/adapters.ts`
3. Implement adapters to satisfy interfaces
4. Use `satisfies` operator to verify implementations

### Adapter Development Process

New adapters MUST follow this process:

1. **Research**: Document provider API thoroughly (request/response formats, constraints, quirks)
2. **Capability Declaration**: Define adapter capabilities metadata
3. **Transform Functions**: Implement `toUniversal` and `fromUniversal` with full type safety
4. **Error Handling**: Map provider errors to UniversalError format
5. **Testing**: Create test suite with real API fixtures (mocked responses)
6. **Documentation**: Document semantic drift, limitations, and usage examples

### Testing Strategy

- **Unit Tests**: Test individual adapter transform functions with fixtures
- **Integration Tests**: Test full request/response cycles with mocked providers
- **Contract Tests**: Verify IR schema compliance for all adapters
- **Compatibility Matrix**: Test common scenarios across all frontend/backend pairs

## Performance and Observability

### Performance Targets

- Adapter overhead: < 5ms per transform (p95)
- Streaming latency: < 50ms additional delay (p95)
- Memory: Minimal allocations, no memory leaks in long-running bridges

### Observability Requirements

- All adapters MUST emit structured logs at configurable levels
- Middleware MUST support telemetry hooks for latency tracking
- IR transformations MUST be traceable with unique request IDs
- Error messages MUST include adapter provenance and IR state

## Governance

This constitution governs all development on the Universal AI Adapter System. All code, documentation, and design decisions MUST align with these principles.

### Amendment Process

Constitution amendments require:
1. Written proposal with rationale and impact analysis
2. Demonstration that existing principles cannot solve the problem
3. Update to all affected templates and documentation
4. Version bump according to semantic versioning rules

### Compliance Verification

- All PRs MUST be checked against these principles
- Architecture decisions MUST cite relevant principles or justify deviations
- Complex additions MUST complete the "Complexity Tracking" section in plan.md
- Regular audits to ensure adherence

### Semantic Versioning

**Constitution Version** follows semantic versioning:
- **MAJOR**: Breaking changes to principles, removal of principles
- **MINOR**: New principles added, material expansions
- **PATCH**: Clarifications, typo fixes, non-semantic changes

**Version**: 1.0.0 | **Ratified**: 2025-10-13 | **Last Amended**: 2025-10-13
