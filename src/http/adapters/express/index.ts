/**
 * Express HTTP Adapter
 *
 * Express middleware for the Universal AI Adapter System.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { ExpressMiddleware } from '@agentic/ai-matey/http/express';
 * import { Bridge } from '@agentic/ai-matey';
 * import { AnthropicFrontendAdapter } from '@agentic/ai-matey/adapters/frontend/anthropic';
 * import { OpenAIBackendAdapter } from '@agentic/ai-matey/adapters/backend/openai';
 *
 * const app = express();
 * app.use(express.json());
 *
 * const frontend = new AnthropicFrontendAdapter();
 * const backend = new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY });
 * const bridge = new Bridge(frontend, backend);
 *
 * app.use('/v1/messages', ExpressMiddleware(bridge, {
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

export { ExpressMiddleware } from './middleware.js';
export { ExpressRequestAdapter, ExpressResponseAdapter } from './adapter.js';
