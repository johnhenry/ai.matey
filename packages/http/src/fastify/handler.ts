/**
 * Fastify Handler
 *
 * HTTP request handler for Fastify that uses the core handler.
 *
 * @module
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Bridge } from 'ai.matey.core';
import type { HTTPListenerOptions } from 'ai.matey.http-core';
import { CoreHTTPHandler } from 'ai.matey.http-core';
import { FastifyRequestAdapter, FastifyResponseAdapter } from './adapter.js';

/**
 * Create Fastify route handler for handling AI chat requests
 *
 * @param bridge - Bridge instance
 * @param options - HTTP listener options
 * @returns Fastify route handler function
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { FastifyHandler } from 'ai.matey.http.fastify';
 *
 * const fastify = Fastify();
 * const bridge = new Bridge(frontend, backend);
 *
 * // Add AI chat route
 * fastify.post('/v1/messages', FastifyHandler(bridge, {
 *   cors: true,
 *   streaming: true,
 * }));
 *
 * fastify.listen({ port: 3000 });
 * ```
 */
export function FastifyHandler(
  bridge: Bridge,
  options: HTTPListenerOptions = {}
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  // Create core handler with all business logic
  const { cors, ...restOptions } = options;

  const coreHandler = new CoreHTTPHandler({
    bridge,
    cors: cors === false || cors === undefined ? undefined : cors === true ? {} : cors,
    ...(restOptions as any), // HTTPListenerOptions types are compatible with CoreHandlerOptions at runtime
  });

  // Return Fastify route handler
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Create adapters
    const genericReq = new FastifyRequestAdapter(request);
    const genericRes = new FastifyResponseAdapter(reply);

    // Handle request through core handler
    await coreHandler.handle(genericReq, genericRes);
  };
}
