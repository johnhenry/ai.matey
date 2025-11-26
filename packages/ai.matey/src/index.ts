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
 * import { OpenAIBackendAdapter } from 'ai.matey.backend.openai';
 * import { AnthropicBackendAdapter } from 'ai.matey.backend.anthropic';
 * import type { IRChatRequest } from 'ai.matey.types';
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
//   ai.matey.backend.openai
//   ai.matey.backend.anthropic
//   ai.matey.backend.gemini
//   ai.matey.backend.groq
//   ai.matey.backend.mistral
//   ai.matey.backend.ollama
//   ... and more
//
// Frontend Adapters:
//   ai.matey.frontend.openai
//   ai.matey.frontend.anthropic
//   ... and more
//
// HTTP Integrations:
//   ai.matey.http.express
//   ai.matey.http.fastify
//   ai.matey.http.hono
//   ai.matey.http.koa
//   ai.matey.http.node
//
// Middleware:
//   ai.matey.middleware.logging
//   ai.matey.middleware.caching
//   ai.matey.middleware.retry
//   ai.matey.middleware.transform
//   ... and more
//
// SDK Wrappers:
//   ai.matey.wrapper.openai-sdk
//   ai.matey.wrapper.anthropic-sdk
//   ai.matey.wrapper.chrome-ai

export const VERSION = '1.0.0';
