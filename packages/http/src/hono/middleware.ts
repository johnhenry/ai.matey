/**
 * Hono Middleware
 *
 * HTTP request middleware for Hono that uses the core handler.
 *
 * @module
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { Bridge } from 'ai.matey.core';
import type { HTTPListenerOptions } from 'ai.matey.http.core';
import { CoreHTTPHandler } from 'ai.matey.http.core';
import { HonoRequestAdapter, HonoResponseAdapter } from './adapter.js';

/**
 * Create Hono middleware for handling AI chat requests
 *
 * @param bridge - Bridge instance
 * @param options - HTTP listener options
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { HonoMiddleware } from 'ai.matey.http.hono';
 *
 * const app = new Hono();
 * const bridge = new Bridge(frontend, backend);
 *
 * // Add AI chat middleware
 * app.post('/v1/messages', HonoMiddleware(bridge, {
 *   cors: true,
 *   streaming: true,
 * }));
 *
 * export default app;
 * ```
 */
export function HonoMiddleware(
  bridge: Bridge,
  options: HTTPListenerOptions = {}
): MiddlewareHandler {
  // Create core handler with all business logic
  const { cors, ...restOptions } = options;

  const coreHandler = new CoreHTTPHandler({
    bridge,
    cors: cors === false || cors === undefined ? undefined : cors === true ? {} : cors,
    ...(restOptions as any), // HTTPListenerOptions types are compatible with CoreHandlerOptions at runtime
  });

  // Return Hono middleware
  return async (c: Context): Promise<Response> => {
    try {
      // Parse JSON body if present (but not for OPTIONS requests)
      const contentType = c.req.header('content-type') || '';
      const method = c.req.method;

      if (method !== 'OPTIONS' && contentType.includes('application/json')) {
        try {
          (c as any).body = await c.req.json();
        } catch {
          // If JSON parsing fails, leave body as null
          (c as any).body = null;
        }
      }

      // Create adapters
      const genericReq = new HonoRequestAdapter(c);
      const genericRes = new HonoResponseAdapter(c);

      // Handle request through core handler
      await coreHandler.handle(genericReq, genericRes);

      // Return the response set by the adapter
      return c.res || new Response('Internal Server Error', { status: 500 });
    } catch (error) {
      // Return error response
      console.error('Hono middleware error:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  };
}
