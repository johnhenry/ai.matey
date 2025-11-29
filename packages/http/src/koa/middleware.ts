/**
 * Koa Middleware
 *
 * HTTP request middleware for Koa that uses the core handler.
 *
 * @module
 */

import type { Context, Next } from 'koa';
import type { Bridge } from 'ai.matey.core';
import type { HTTPListenerOptions } from 'ai.matey.http.core';
import { CoreHTTPHandler } from 'ai.matey.http.core';
import { KoaRequestAdapter, KoaResponseAdapter } from './adapter.js';

/**
 * Create Koa middleware for handling AI chat requests
 *
 * @param bridge - Bridge instance
 * @param options - HTTP listener options
 * @returns Koa middleware function
 *
 * @example
 * ```typescript
 * import Koa from 'koa';
 * import bodyParser from 'koa-bodyparser';
 * import { KoaMiddleware } from 'ai.matey.http/koa';
 *
 * const app = new Koa();
 * const bridge = new Bridge(frontend, backend);
 *
 * // Use body parser middleware first
 * app.use(bodyParser());
 *
 * // Add AI chat middleware
 * app.use(KoaMiddleware(bridge, {
 *   cors: true,
 *   streaming: true,
 * }));
 *
 * app.listen(3000);
 * ```
 */
export function KoaMiddleware(
  bridge: Bridge,
  options: HTTPListenerOptions = {}
): (ctx: Context, next: Next) => Promise<void> {
  // Create core handler with all business logic
  const { cors, ...restOptions } = options;

  const coreHandler = new CoreHTTPHandler({
    bridge,
    cors: cors === false || cors === undefined ? undefined : cors === true ? {} : cors,
    ...(restOptions as any), // HTTPListenerOptions types are compatible with CoreHandlerOptions at runtime
  });

  // Return Koa middleware
  return async (ctx: Context, _next: Next): Promise<void> => {
    // Create adapters
    const genericReq = new KoaRequestAdapter(ctx);
    const genericRes = new KoaResponseAdapter(ctx);

    // Handle request through core handler
    await coreHandler.handle(genericReq, genericRes);
  };
}
