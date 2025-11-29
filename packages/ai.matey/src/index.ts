/**
 * AI Matey - Universal AI Adapter System
 *
 * This is the umbrella package for ai.matey. In the monorepo structure,
 * you should import directly from specific packages for better tree-shaking:
 *
 * @example
 * ```typescript
 * // Import from specific packages (recommended)
 * import { Bridge, Router } from 'ai.matey.core';
 * import { OpenAIBackendAdapter } from 'ai.matey.backend';
 * import { AnthropicBackendAdapter } from 'ai.matey.backend';
 * import type { IRChatRequest } from 'ai.matey.types';
 *
 * // Or import specific providers with subpath exports
 * import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
 * ```
 *
 * @module
 */

// This package is intentionally minimal.
// Import from specific packages instead:
//
// Core:
//   ai.matey.core      - Bridge, Router, MiddlewareStack
//   ai.matey.types     - TypeScript type definitions
//   ai.matey.errors    - Error classes
//   ai.matey.utils     - Utility functions
//
// Backend Adapters:
//   ai.matey.backend   - All backend provider adapters
//   ai.matey.backend/openai     - OpenAI adapter
//   ai.matey.backend/anthropic  - Anthropic adapter
//   ai.matey.backend/gemini     - Google Gemini adapter
//   ... and more
//
// Frontend Adapters:
//   ai.matey.frontend  - All frontend adapters
//   ai.matey.frontend/openai    - OpenAI frontend
//   ai.matey.frontend/anthropic - Anthropic frontend
//   ... and more
//
// HTTP Integrations:
//   ai.matey.http      - All HTTP framework adapters
//   ai.matey.http/express  - Express.js adapter
//   ai.matey.http/fastify  - Fastify adapter
//   ai.matey.http/hono     - Hono adapter
//   ai.matey.http/koa      - Koa adapter
//   ai.matey.http/node     - Node.js HTTP adapter
//   ai.matey.http.core     - Framework-agnostic HTTP utilities
//
// Middleware:
//   ai.matey.middleware - All middleware components
//   ai.matey.middleware/retry    - Retry middleware
//   ai.matey.middleware/caching  - Caching middleware
//   ai.matey.middleware/logging  - Logging middleware
//   ... and more
//
// SDK Wrappers:
//   ai.matey.wrapper   - SDK compatibility wrappers
//   ai.matey.wrapper/openai    - OpenAI SDK compatibility
//   ai.matey.wrapper/anthropic - Anthropic SDK compatibility

export const VERSION = '1.0.0';
