/**
 * Hono HTTP Adapter
 *
 * Hono middleware for the Universal AI Adapter System.
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { HonoMiddleware } from '@agentic/ai-matey/http/hono';
 * import { Bridge } from '@agentic/ai-matey';
 * import { AnthropicFrontendAdapter } from '@agentic/ai-matey/adapters/frontend/anthropic';
 * import { OpenAIBackendAdapter } from '@agentic/ai-matey/adapters/backend/openai';
 *
 * const app = new Hono();
 *
 * const frontend = new AnthropicFrontendAdapter();
 * const backend = new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY });
 * const bridge = new Bridge(frontend, backend);
 *
 * app.post('/v1/messages', HonoMiddleware(bridge, {
 *   cors: true,
 *   streaming: true,
 * }));
 *
 * export default app;
 * ```
 *
 * @module
 */

export { HonoMiddleware } from './middleware.js';
export { HonoRequestAdapter, HonoResponseAdapter } from './adapter.js';
