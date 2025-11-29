# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING**: Renamed package `ai.matey.http-core` to `ai.matey.http.core` for naming consistency with other multi-word packages
- Removed deprecated root-level `src/` directory (all code now in `packages/`)
- Added explicit `implements BackendAdapter` interface declarations to Groq, DeepSeek, LMStudio, and NVIDIA backend adapters for consistency

### Improved
- Enhanced documentation for streaming utilities:
  - `streaming-modes.ts`: Clarified purpose for delta/accumulated mode conversion
  - `streaming.ts`: Clarified purpose for general stream operations
  - Added usage examples to both modules showing when to use each

### Migration Guide

#### Package Rename: ai.matey.http-core → ai.matey.http.core

Update your imports:

```typescript
// Before:
import { CoreHTTPHandler } from 'ai.matey.http-core';

// After:
import { CoreHTTPHandler } from 'ai.matey.http.core';
```

If you have this package in your `package.json`, update the dependency name:

```json
{
  "dependencies": {
    "ai.matey.http.core": "*"
  }
}
```

This change aligns with the naming convention used by other multi-word packages:
- `ai.matey.react.core`
- `ai.matey.react.hooks`
- `ai.matey.native.model-runner`
- etc.

### Internal Changes
- All backend adapters now explicitly declare interface implementation for better IDE support and type checking
- Consolidated package structure cleanup complete

## [1.0.0] - 2025-11-29

### Added
- Initial release of consolidated monorepo with 21 packages
- 24 backend provider adapters (OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, Ollama, and more)
- 7 frontend request adapters
- 10 middleware types (logging, caching, retry, telemetry, etc.)
- 6 HTTP framework integrations (Express, Fastify, Hono, Koa, Node.js, Deno)
- React hooks and components for chat interfaces
- SDK wrappers for OpenAI and Anthropic compatibility
- CLI tools for proxying and format conversion
- Universal IR (Intermediate Representation) format for provider-agnostic AI interactions

[Unreleased]: https://github.com/johnhenry/ai.matey/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/johnhenry/ai.matey/releases/tag/v1.0.0
