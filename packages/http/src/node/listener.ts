/**
 * Node.js HTTP Listener
 *
 * HTTP request handler for Node.js http.Server that uses the core handler.
 *
 * @module
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Bridge } from 'ai.matey.core';
import type { HTTPListenerOptions, HTTPRequestHandler } from 'ai.matey.http.core';
import { CoreHTTPHandler } from 'ai.matey.http.core';
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
 * import { createServer } from 'http';
 * import { NodeHTTPListener } from 'ai.matey.http/node';
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

    // Create adapters
    const genericReq = new NodeRequestAdapter(req, maxBodySize);
    const genericRes = new NodeResponseAdapter(res);

    // Parse request body before passing to core handler
    await genericReq.parse();

    // Handle request through core handler
    await coreHandler.handle(genericReq, genericRes);
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
