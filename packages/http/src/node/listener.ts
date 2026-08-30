/**
 * Node.js HTTP Listener
 *
 * HTTP request handler for Node.js http.Server that uses the core handler.
 *
 * @module
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Bridge } from '@johnhenry/aimatey-core';
import type { HTTPListenerOptions, HTTPRequestHandler } from '@johnhenry/aimatey-http-core';
import { CoreHTTPHandler, sendError } from '@johnhenry/aimatey-http-core';
import { NodeRequestAdapter, NodeResponseAdapter } from './adapter.js';

/**
 * Create Node.js HTTP request handler
 *
 * @param bridge - Bridge instance
 * @param options - HTTP listener options
 * @returns HTTP request handler function
 *
 * @example
 * ```typescript
 * import { createServer } from 'node:http';
 * import { NodeHTTPListener } from '@johnhenry/aimatey-http/node';
 *
 * const bridge = new Bridge(frontend, backend);
 *
 * const server = createServer(
 *   NodeHTTPListener(bridge, {
 *     cors: true,
 *     streaming: true,
 *   })
 * );
 *
 * server.listen(3000);
 * ```
 */
export function NodeHTTPListener(
  bridge: Bridge,
  options: HTTPListenerOptions = {}
): HTTPRequestHandler {
  // Create core handler with all business logic
  // Extract cors option to normalize it
  const { cors, ...restOptions } = options;

  const coreHandler = new CoreHTTPHandler({
    bridge,
    cors: cors === false || cors === undefined ? undefined : cors === true ? {} : cors,
    ...(restOptions as any), // HTTPListenerOptions types are compatible with CoreHandlerOptions at runtime
  });

  // Get max body size for adapter
  const maxBodySize = options.maxBodySize ?? 10 * 1024 * 1024;

  // Return Node.js request handler
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    // Set timeout if configured
    const timeout = options.timeout ?? 30000;
    req.setTimeout?.(timeout);
    res.setTimeout?.(timeout);

    try {
      // Create adapters
      const genericReq = new NodeRequestAdapter(req, maxBodySize);
      const genericRes = new NodeResponseAdapter(res);

      // Parse request body before passing to core handler
      await genericReq.parse();

      // Handle request through core handler
      await coreHandler.handle(genericReq, genericRes);
    } catch (error) {
      // A malformed request (e.g. parseRequest() throwing on bad input) must
      // not become an unhandled rejection -- that terminates the process on
      // Node >= 15. Mirror the error-response pattern already used by the
      // other framework adapters (deno/express/fastify/hono/koa).
      console.error('Node HTTP listener error:', error);

      if (!res.headersSent) {
        sendError(res, error instanceof Error ? error : new Error(String(error)), 500);
      } else if (res.writable) {
        res.end();
      }
    }
  };
}

/**
 * Create simple HTTP listener without advanced features
 */
export function createSimpleListener(bridge: Bridge): HTTPRequestHandler {
  return NodeHTTPListener(bridge, {
    cors: true,
    streaming: true,
    logging: false,
  });
}

/**
 * Create HTTP listener with logging enabled
 */
export function createLoggingListener(
  bridge: Bridge,
  log?: (message: string, ...args: any[]) => void
): HTTPRequestHandler {
  return NodeHTTPListener(bridge, {
    cors: true,
    streaming: true,
    logging: true,
    log,
  });
}

/**
 * Create HTTP listener with auth and rate limiting
 */
export function createSecureListener(
  bridge: Bridge,
  options: {
    validateAuth: NonNullable<HTTPListenerOptions['validateAuth']>;
    rateLimit?: HTTPListenerOptions['rateLimit'];
    cors?: HTTPListenerOptions['cors'];
  }
): HTTPRequestHandler {
  return NodeHTTPListener(bridge, {
    validateAuth: options.validateAuth,
    rateLimit: options.rateLimit,
    cors: options.cors ?? true,
    streaming: true,
  });
}
