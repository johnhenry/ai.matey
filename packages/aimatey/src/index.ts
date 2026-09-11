/**
 * Aimatey - Universal AI Adapter System
 *
 * This is the umbrella package for aimatey. In the monorepo structure,
 * you should import directly from specific packages for better tree-shaking:
 *
 * @example
 * ```typescript
 * // Import from specific packages (recommended)
 * import { Bridge, Router } from '@johnhenry/aimatey-core';
 * import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend';
 * import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend';
 * import type { IRChatRequest } from '@johnhenry/aimatey-types';
 *
 * // Or import specific providers with subpath exports
 * import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend/openai';
 * ```
 *
 * @module
 */

// This package is intentionally minimal.
// Import from specific packages instead:
//
// Core:
//   aimatey-core      - Bridge, Router, MiddlewareStack
//   aimatey-types     - TypeScript type definitions
//   aimatey-errors    - Error classes
//   aimatey-utils     - Utility functions
//
// Backend Adapters:
//   aimatey-backend   - All backend provider adapters
//   aimatey-backend/openai     - OpenAI adapter
//   aimatey-backend/anthropic  - Anthropic adapter
//   aimatey-backend/gemini     - Google Gemini adapter
//   ... and more
//
// Frontend Adapters:
//   aimatey-frontend  - All frontend adapters
//   aimatey-frontend/openai    - OpenAI frontend
//   aimatey-frontend/anthropic - Anthropic frontend
//   ... and more
//
// HTTP Integrations:
//   aimatey-http      - All HTTP framework adapters
//   aimatey-http/express  - Express.js adapter
//   aimatey-http/fastify  - Fastify adapter
//   aimatey-http/hono     - Hono adapter
//   aimatey-http/koa      - Koa adapter
//   aimatey-http/node     - Node.js HTTP adapter
//   aimatey-http.core     - Framework-agnostic HTTP utilities
//
// Middleware:
//   aimatey-middleware - All middleware components
//   aimatey-middleware/retry    - Retry middleware
//   aimatey-middleware/caching  - Caching middleware
//   aimatey-middleware/logging  - Logging middleware
//   ... and more
//
// SDK Wrappers:
//   aimatey-wrapper   - SDK compatibility wrappers
//   aimatey-wrapper/openai    - OpenAI SDK compatibility
//   aimatey-wrapper/anthropic - Anthropic SDK compatibility

export const VERSION = '0.2.0';
