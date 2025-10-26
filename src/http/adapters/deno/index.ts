/**
 * Deno HTTP Adapter
 *
 * Deno handler for the Universal AI Adapter System.
 *
 * @example
 * ```typescript
 * import { DenoHandler } from '@agentic/ai-matey/http/deno';
 * import { Bridge } from '@agentic/ai-matey';
 * import { AnthropicFrontendAdapter } from '@agentic/ai-matey/adapters/frontend/anthropic';
 * import { OpenAIBackendAdapter } from '@agentic/ai-matey/adapters/backend/openai';
 *
 * const frontend = new AnthropicFrontendAdapter();
 * const backend = new OpenAIBackendAdapter({ apiKey: Deno.env.get('OPENAI_API_KEY') });
 * const bridge = new Bridge(frontend, backend);
 *
 * const handler = DenoHandler(bridge, {
 *   cors: true,
 *   streaming: true,
 * });
 *
 * Deno.serve({ port: 3000 }, handler);
 * ```
 *
 * @module
 */

export { DenoHandler } from './handler.js';
export { DenoRequestAdapter, DenoResponseAdapter } from './adapter.js';
