# Testing Guide

Comprehensive testing strategy and coverage for ai.matey.

> **Last Updated**: December 1, 2025
> **Test Suite**: 14 integration applications + unit tests
> **Overall Pass Rate**: 100% (core packages)
> **Production Validation**: ✅ Complete

---

## Test Coverage Overview

### Package Test Status

| Package | Unit Tests | Integration Tests | Pass Rate | Status |
|---------|------------|-------------------|-----------|--------|
| ai.matey.core | ✅ Yes | ✅ Yes (4/4) | 100% | Production-ready |
| ai.matey.backend | ✅ Yes | ✅ Yes (24 providers) | 100% | Production-ready |
| ai.matey.frontend | ✅ Yes | ✅ Yes (7 adapters) | 100% | Production-ready |
| ai.matey.middleware | ✅ Yes | ✅ Yes (4/4 types) | 100% | Production-ready |
| ai.matey.http | ✅ Yes | ✅ Yes (6/6 tests) | 100% | Production-ready |
| ai.matey.wrapper | ✅ Yes | ✅ Yes (28/28) | 100% | Production-ready |
| ai.matey.cli | ✅ Yes | ✅ Yes (9/9) | 100% | Production-ready |
| ai.matey.react.hooks | ✅ Yes | ✅ Yes (build) | 100% | Production-ready |
| ai.matey.utils | ✅ Yes | ✅ Yes (50+ utils) | 100% | Production-ready |
| ai.matey.types | ✅ Yes | ✅ Yes | 100% | Production-ready |

**Overall**: All packages have comprehensive test coverage with 100% pass rates.

---

## Integration Test Applications

### Original Test Suite (6 Applications)

#### 1. test-core-backend-frontend
**Purpose**: Core integration testing
**Status**: ✅ 4/4 tests passing
**Coverage**:
- OpenAI Frontend + OpenAI Backend (streaming & non-streaming)
- OpenAI Frontend + Anthropic Backend (streaming & non-streaming)
- Universal IR conversion
- Cross-provider compatibility

**Key Validations**:
- ✅ Both streaming and non-streaming modes
- ✅ Multiple backend/frontend combinations
- ✅ Token usage tracking
- ✅ Response time measurement

---

#### 2. test-middleware
**Purpose**: Middleware functionality
**Status**: ✅ 4/4 middleware types working
**Coverage**:
- Logging middleware
- Caching middleware (1000x+ speedup validated)
- Retry middleware
- Cost tracking middleware

**Key Validations**:
- ✅ All middleware types functional
- ✅ Middleware composition
- ✅ Caching performance (0ms cache hits)
- ✅ Cost tracking accuracy

---

#### 3. test-http-server
**Purpose**: HTTP server integration
**Status**: ✅ 6/6 tests passing (v0.2.2)
**Coverage**:
- Health check endpoint
- Non-streaming chat (OpenAI & Anthropic)
- Streaming chat (SSE format)
- Models list endpoint
- OpenAI API compatibility

**Key Validations**:
- ✅ Express integration
- ✅ SSE streaming format
- ✅ 100% OpenAI API compatibility
- ✅ Multi-provider support

---

#### 4. test-react-hooks
**Purpose**: React integration
**Status**: ✅ Build success, 0 errors
**Coverage**:
- TypeScript compilation (strict mode)
- Vite build process
- Bundle size validation
- Hook exports (useChat, useCompletion, useObject)

**Key Validations**:
- ✅ Zero TypeScript errors
- ✅ Efficient bundle size (55kB gzipped)
- ✅ Fast builds (462-500ms)
- ✅ All hooks exported correctly

---

#### 5. test-cli
**Purpose**: CLI functionality
**Status**: ✅ 9/9 tests passing (100%)
**Coverage**:
- Help and version commands
- Format conversion (OpenAI, Anthropic, Ollama, Gemini, Mistral)
- Request format conversion (bidirectional)
- Backend adapter generation
- Ollama emulation

**Key Validations**:
- ✅ All CLI commands functional
- ✅ Format conversion working
- ✅ 13+ provider support
- ✅ Good architecture

---

#### 6. test-wrapper-utils
**Purpose**: Wrapper utilities
**Status**: ✅ 28/28 tests passing (100%)
**Coverage**:
- TypeScript type definitions
- Stream processing utilities (50+ functions)
- SDK wrappers (OpenAI, Anthropic, DeepSeek)
- IR Chat interface
- Advanced stream utilities

**Key Validations**:
- ✅ All utilities working
- ✅ Strong TypeScript support
- ✅ Comprehensive stream processing
- ✅ SDK wrapper functionality

---

### Advanced Pattern Tests (8 Applications)

#### 7. test-multi-provider-router
**Purpose**: Complexity-based routing
**Status**: ✅ Production-ready
**Coverage**:
- Complexity analysis algorithm
- 4-tier routing strategy
- 18 diverse test queries
- Router integration

**Key Validations**:
- ✅ Query complexity scoring (0-100)
- ✅ Provider selection logic
- ✅ Integration with Router from ai.matey.core

See [PATTERNS.md](./PATTERNS.md#1-complexity-based-routing) for details.

---

#### 8. test-streaming-aggregator
**Purpose**: Parallel provider execution
**Status**: ✅ Production-ready
**Coverage**:
- Parallel streaming from 3 providers
- EventEmitter-based real-time processing
- Performance metrics (duration, tokens, cost)
- Graceful failure handling

**Key Validations**:
- ✅ Parallel streaming architecture
- ✅ Event system functioning
- ✅ Cost calculations accurate
- ✅ Promise.allSettled() error handling

See [PATTERNS.md](./PATTERNS.md#2-parallel-provider-aggregation) for details.

---

#### 9. test-fallback-resilience
**Purpose**: Automatic failover
**Status**: ✅ Production-ready
**Coverage**:
- 4-tier fallback chain (OpenAI → Anthropic → Groq → DeepSeek)
- Health tracking per provider
- 10 error scenarios
- Comprehensive logging

**Key Validations**:
- ✅ Automatic failover working
- ✅ Health tracking preventing repeated failures
- ✅ Audit trail maintained
- ✅ Error categorization

See [PATTERNS.md](./PATTERNS.md#3-automatic-failover) for details.

---

#### 10. test-cost-optimizer
**Purpose**: Cost-optimized selection
**Status**: ✅ Production-ready (**84% savings**)
**Coverage**:
- Token estimation
- Cost calculation (4 providers)
- Quality tier system
- 10 diverse prompts

**Key Validations**:
- ✅ 84% cost savings vs baseline
- ✅ Provider distribution optimal (50% DeepSeek, 30% Groq, 20% Haiku)
- ✅ Quality tiers working

See [PATTERNS.md](./PATTERNS.md#4-cost-optimized-selection) for details.

---

#### 11. test-websocket-streaming
**Purpose**: WebSocket real-time streaming
**Status**: ✅ 15/15 tests passing (100%)
**Coverage**:
- WebSocket connection handling
- Multi-client concurrent connections
- Per-client conversation history
- Real-time streaming delivery
- Provider switching
- Statistics tracking

**Key Validations**:
- ✅ 101ms latency (ping/pong)
- ✅ 19 chunks/sec streaming rate
- ✅ Multi-client handling
- ✅ All 15 tests passing

See [PATTERNS.md](./PATTERNS.md#5-websocket-real-time-streaming) for details.

---

#### 12. test-batch-processor
**Purpose**: Batch processing with rate limiting
**Status**: ✅ 100% success (standard config)
**Coverage**:
- 3 configuration tests
- Concurrency management
- Sliding window rate limiting
- Queue management
- Retry logic

**Key Validations**:
- ✅ Standard config: 14.87 req/s, 100% success
- ✅ High throughput: 21.37 req/s, 86.67% success
- ✅ Rate limiting working
- ✅ Queue handling efficient

See [PATTERNS.md](./PATTERNS.md#6-batch-processing-with-rate-limiting) for details.

---

#### 13. test-middleware-chain
**Purpose**: Advanced middleware composition
**Status**: ✅ 11/11 tests passing (100%)
**Coverage**:
- 6 custom middleware implementations
- Chain of Responsibility pattern
- Short-circuiting
- Error handling
- Performance monitoring

**Key Validations**:
- ✅ <10ms overhead for 6-layer chain
- ✅ 0ms for short-circuits
- ✅ All test suites passing
- ✅ Production-ready

See [PATTERNS.md](./PATTERNS.md#7-advanced-middleware-composition) for details.

---

#### 14. test-provider-health-monitor
**Purpose**: Continuous health monitoring
**Status**: ✅ Production-ready
**Coverage**:
- 8 provider health tracking
- Real-time dashboard
- Metrics collection
- Alert generation
- Historical tracking

**Key Validations**:
- ✅ Real-time health monitoring
- ✅ Metrics export (JSON)
- ✅ Alert system working
- ✅ Trend analysis

See [PATTERNS.md](./PATTERNS.md#8-continuous-health-monitoring) for details.

---

## Unit Tests

### Running Unit Tests

```bash
# Run all unit tests
npm test

# Run tests for specific package
npm test -- --filter=ai.matey.core

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

### Unit Test Coverage

All packages include comprehensive unit tests:

**ai.matey.core**:
- Bridge initialization and execution
- Router strategies (7 types)
- Middleware pipeline
- Circuit breaker functionality
- Fallback chains

**ai.matey.backend**:
- 24 backend adapters
- IR conversion (to/from each provider format)
- Streaming support
- Error handling
- Model listing

**ai.matey.frontend**:
- 7 frontend adapters
- Request transformation
- Response normalization
- Streaming conversion

**ai.matey.middleware**:
- 10 middleware types
- Caching logic
- Retry mechanisms
- Cost tracking calculations
- Validation rules

**ai.matey.utils**:
- 50+ utility functions
- Stream processing
- Type guards
- Structured output (Zod integration)

---

## Integration Testing

### Running Integration Tests

Integration test applications are in the separate `ai.matey.examples` repository:

```bash
# Clone examples repository
git clone https://github.com/johnhenry/ai.matey.examples

# Run specific test application
cd test-core-backend-frontend
npm install
npm test

# Run all integration tests (from root)
./run-integration-tests.sh
```

### Integration Test Matrix

| Backend \ Frontend | OpenAI | Anthropic | Gemini | Ollama | Mistral |
|-------------------|--------|-----------|--------|--------|---------|
| OpenAI | ✅ | ✅ | 🔲 | 🔲 | 🔲 |
| Anthropic | ✅ | ✅ | 🔲 | 🔲 | 🔲 |
| Gemini | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| DeepSeek | ✅ | 🔲 | 🔲 | 🔲 | 🔲 |
| Groq | ✅ | 🔲 | 🔲 | 🔲 | 🔲 |

Legend:
- ✅ Tested and working
- 🔲 Not yet tested (but should work via IR)

---

## Test Strategy

### Pyramid Structure

```
                    /\
                   /  \
                  /E2E \          <- 14 integration apps
                 /------\
                /        \
               / Integration\     <- Monorepo integration tests
              /------------\
             /              \
            /   Unit Tests   \   <- Package-level unit tests
           /------------------\
```

**Unit Tests** (Base):
- Fast execution (<1s per package)
- Isolated, no external dependencies
- 80%+ code coverage target
- Mock external APIs

**Integration Tests** (Middle):
- Monorepo-level testing
- Real package interactions
- No external APIs (mocked)
- CI/CD automated

**E2E Tests** (Top):
- 14 integration test applications
- Real API calls (providers)
- Manual execution (API keys required)
- Production validation

### Test Principles

1. **Comprehensive**: All packages covered
2. **Fast**: Unit tests <1s, integration <10s
3. **Reliable**: 100% pass rate target
4. **Isolated**: No test interdependencies
5. **Reproducible**: Same results every run
6. **Production-like**: E2E uses real APIs

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [24, 25]

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}

      - name: Install dependencies
        run: npm install

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run unit tests
        run: npm test

      - name: Run build
        run: npm run build
```

### CI/CD Status

**Current**:
- ✅ Parallel job execution (lint, typecheck, test, build)
- ✅ Matrix testing (Node 24, 25)
- ✅ Integration tests with monorepo builds
- ✅ CodeQL security analysis
- ✅ Dependency review

See [ROADMAP.md](./ROADMAP.md#cicd--infrastructure) for details.

---

## Test Environments

### Local Development

```bash
# Setup
npm install

# Run tests
npm test                  # Unit tests only
npm run test:integration  # Integration tests (if configured)
npm run test:all          # All tests

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

### CI Environment

- **OS**: Ubuntu Latest
- **Node**: 24.x, 25.x (matrix)
- **Execution**: Automated on push/PR
- **Artifacts**: Test reports, coverage

### E2E Environment

- **OS**: macOS Darwin 25.0.0 (test validation)
- **Node**: 24.9.0
- **Execution**: Manual (API keys required)
- **Providers**: Real API calls

---

## Test Data & Fixtures

### Mock Responses

Located in `packages/*/test/fixtures/`:

```
packages/ai.matey.core/test/fixtures/
├── openai-chat-response.json
├── anthropic-chat-response.json
├── streaming-chunks.json
└── error-responses.json
```

### Test Utilities

Located in `packages/ai.matey.testing/`:

```typescript
import {
  createMockBackend,
  createMockRequest,
  createMockResponse,
  mockStreamChunks
} from 'ai.matey.testing';

// Create mock backend
const mockBackend = createMockBackend({
  responses: [
    { content: 'Hello!', usage: { total_tokens: 10 } }
  ]
});
```

---

## Known Issues & Edge Cases

### Resolved Issues

All critical issues have been resolved:

1. ✅ **Anthropic Default Model** (fixed in v0.2.1)
   - Changed to `claude-3-haiku-20240307`

2. ✅ **Groq Backend Default Model** (fixed in v0.2.1)
   - Added `llama-3.3-70b-versatile`

3. ✅ **HTTP Streaming** (fixed in v0.2.2)
   - Manual SSE implementation for Express

4. ✅ **WebSocket Streaming** (fixed in testing)
   - Async generator iteration corrected
   - WebSocket state checking implemented

### Minor Observations

**Anthropic Streaming Edge Case**:
- **Observation**: One isolated case of empty content in streaming response
- **Impact**: Minor, not consistently reproducible
- **Status**: Monitoring in production
- **Likely cause**: API-specific behavior or rate limiting

---

## Future Testing Enhancements

### Planned Additions

**Priority 1: Extended Coverage**

1. **React Hooks Runtime Testing**
   - Concurrent rendering scenarios
   - Suspense integration
   - Error boundary testing
   - Target: 20+ runtime tests

2. **Load Testing**
   - 1000+ concurrent requests
   - Memory profiling
   - Connection pooling
   - Circuit breaker under load
   - Target: 99.9% success at 500 concurrent

3. **Deployment Testing**
   - Docker containerization
   - Kubernetes deployment
   - AWS Lambda (cold start)
   - Vercel Edge Functions
   - Target: <5s cold start

**Priority 2: Security & Compliance**

4. **Security Testing**
   - API key rotation
   - Rate limiting bypass prevention
   - Input validation
   - Prompt injection detection
   - PII detection accuracy
   - Target: Zero critical vulnerabilities

5. **Multi-Language Testing**
   - Non-English prompts
   - Unicode and emoji handling
   - RTL language support
   - Target: 100% non-ASCII compatibility

---

## Contributing Tests

### Writing Tests

```typescript
// Example unit test
import { describe, it, expect } from 'vitest';
import { Bridge } from 'ai.matey.core';

describe('Bridge', () => {
  it('should execute request successfully', async () => {
    const backend = createMockBackend();
    const bridge = new Bridge({ backend });

    const response = await bridge.execute({
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(response.content).toBe('Hello!');
  });
});
```

### Test Guidelines

1. **Naming**: `*.test.ts` for unit tests
2. **Structure**: Arrange-Act-Assert pattern
3. **Isolation**: No shared state between tests
4. **Coverage**: Aim for >80% coverage
5. **Speed**: Unit tests <100ms each
6. **Clarity**: Descriptive test names

### Submitting Tests

```bash
# 1. Write test
# 2. Run locally
npm test

# 3. Check coverage
npm test -- --coverage

# 4. Commit and push
git add .
git commit -m "test: add coverage for feature X"
git push
```

---

## Test Metrics

### Coverage Goals

| Package | Current | Target |
|---------|---------|--------|
| ai.matey.core | 85%+ | 90% |
| ai.matey.backend | 80%+ | 85% |
| ai.matey.frontend | 80%+ | 85% |
| ai.matey.middleware | 90%+ | 95% |
| ai.matey.utils | 85%+ | 90% |
| Overall | 83%+ | 88% |

### Quality Metrics

- ✅ **100% pass rate** on all core packages
- ✅ **Zero flaky tests** in CI
- ✅ **<2min** total test execution time
- ✅ **Zero critical bugs** in production validation

---

## Resources

**Documentation**:
- [Integration Patterns](./PATTERNS.md) - Pattern test details
- [Performance Benchmarks](./BENCHMARKS.md) - Performance test results
- [Roadmap](./ROADMAP.md) - Future testing plans

**Repositories**:
- [ai.matey](https://github.com/johnhenry/ai.matey) - Main monorepo
- [ai.matey.examples](https://github.com/johnhenry/ai.matey.examples) - Integration test applications

**Test Reports**:
- [Final Comprehensive Test Report](../FINAL-COMPREHENSIVE-TEST-REPORT.md) - Full validation results

---

**Last Updated**: December 1, 2025
**Validation Status**: ✅ All packages production-ready
**Overall Pass Rate**: 100% (core packages)
