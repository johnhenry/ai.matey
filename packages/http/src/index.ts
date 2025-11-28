/**
 * AI Matey HTTP Adapters
 *
 * Consolidated package containing HTTP framework adapters.
 * Each adapter provides integration with a specific HTTP framework.
 *
 * @module ai.matey.http
 */

// Express adapter
export * from './express/index.js';

// Fastify adapter
export * from './fastify/index.js';

// Hono adapter
export * from './hono/index.js';

// Koa adapter
export * from './koa/index.js';

// Node.js native HTTP adapter
export * from './node/index.js';

// Deno adapter
export * from './deno/index.js';
