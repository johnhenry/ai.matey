/**
 * Koa HTTP Adapter
 *
 * Koa middleware for the Universal AI Adapter System.
 *
 * @example
 * ```typescript
 * import Koa from 'koa';
 * import bodyParser from 'koa-bodyparser';
 * import { KoaMiddleware } from '@agentic/ai-matey/http/koa';
 * import { Bridge } from '@agentic/ai-matey';
 * import { AnthropicFrontendAdapter } from '@agentic/ai-matey/adapters/frontend/anthropic';
 * import { OpenAIBackendAdapter } from '@agentic/ai-matey/adapters/backend/openai';
 *
 * const app = new Koa();
 * app.use(bodyParser());
 *
 * const frontend = new AnthropicFrontendAdapter();
 * const backend = new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY });
 * const bridge = new Bridge(frontend, backend);
 *
 * app.use(KoaMiddleware(bridge, {
 *   cors: true,
 *   streaming: true,
 * }));
 *
 * app.listen(3000, () => {
 *   console.log('Server running on http://localhost:3000');
 * });
 * ```
 *
 * @module
 */

export { KoaMiddleware } from './middleware.js';
export { KoaRequestAdapter, KoaResponseAdapter } from './adapter.js';
