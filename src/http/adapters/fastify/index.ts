/**
 * Fastify HTTP Adapter
 *
 * Fastify handler for the Universal AI Adapter System.
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { FastifyHandler } from '@agentic/ai-matey/http/fastify';
 * import { Bridge } from '@agentic/ai-matey';
 * import { AnthropicFrontendAdapter } from '@agentic/ai-matey/adapters/frontend/anthropic';
 * import { OpenAIBackendAdapter } from '@agentic/ai-matey/adapters/backend/openai';
 *
 * const fastify = Fastify({
 *   logger: true
 * });
 *
 * const frontend = new AnthropicFrontendAdapter();
 * const backend = new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY });
 * const bridge = new Bridge(frontend, backend);
 *
 * fastify.post('/v1/messages', FastifyHandler(bridge, {
 *   cors: true,
 *   streaming: true,
 * }));
 *
 * fastify.listen({ port: 3000 }, (err, address) => {
 *   if (err) throw err;
 *   console.log(`Server running at ${address}`);
 * });
 * ```
 *
 * @module
 */

export { FastifyHandler } from './handler.js';
export { FastifyRequestAdapter, FastifyResponseAdapter } from './adapter.js';
