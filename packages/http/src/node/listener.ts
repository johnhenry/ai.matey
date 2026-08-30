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
import {
  CoreHTTPHandler,
  sendError,
  getHTTPStatusCode,
  detectProviderFormat,
} from '@johnhenry/aimatey-http-core';
import { NodeRequestAdapter, NodeResponseAdapter } from './adapter.js';

/**
 * Node error codes that mean "the client went away".
 *
 * There is nobody left to send a status line to, so these are logged and
 * dropped rather than run through the error responder -- attempting to write
 * would only produce a second, more confusing failure.
 */
const CLIENT_DISCONNECT_CODES = new Set(['ECONNRESET', 'ECONNABORTED', 'EPIPE']);

function isClientDisconnect(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code && CLIENT_DISCONNECT_CODES.has(code)) {
    return true;
  }
  // Node raises a plain `Error: aborted` when the peer vanishes mid-body.
  return (error as Error | undefined)?.message === 'aborted';
}

/**
 * Whether a status line and body can still reach the client.
 *
 * Note this deliberately does not consult `req.destroyed`: Node auto-destroys
 * the request stream after a perfectly normal `end`, so it is true for most
 * successfully-read requests and says nothing about the connection.
 */
function canStillRespond(res: ServerResponse): boolean {
  return res.writable && !res.writableEnded && !res.headersSent;
}

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

  // Report an error the way the rest of the stack does: through the caller's
  // `log` hook when they configured logging, and only otherwise to the console.
  // Server-side reporting keeps the full error; the client never sees it.
  const report = (message: string, error: unknown): void => {
    if (options.logging && options.log) {
      options.log(message, error);
      return;
    }
    console.error(message, error);
  };

  // Return Node.js request handler
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      // Set timeout if configured. Inside the try: a bad `timeout` value throws,
      // and out here that throw would reject the handler promise that
      // http.Server never awaits -- an unhandled rejection, which is fatal on
      // Node >= 15.
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
    } catch (error) {
      // A malformed request (e.g. parseRequest() throwing on bad input) must
      // not become an unhandled rejection -- that terminates the process on
      // Node >= 15. Mirror the error-response pattern already used by the
      // other framework adapters (deno/express/fastify/hono/koa).
      const err = error instanceof Error ? error : new Error(String(error));

      // The responder must not be able to fail the request a second time.
      try {
        if (isClientDisconnect(err)) {
          // Nobody to answer. Log it and let Node reclaim the socket.
          report('Node HTTP listener: client disconnected mid-request:', err);
          if (res.writable && !res.writableEnded) {
            res.end();
          }
          return;
        }

        report('Node HTTP listener error:', err);

        if (canStillRespond(res)) {
          // Status comes from the shared error taxonomy rather than a
          // hardcoded 500, so a bad payload reads as 400/413 instead of
          // blaming the server for what the client sent. sendError() strips
          // internals from the message before it goes on the wire.
          sendError(res, err, getHTTPStatusCode(err), detectProviderFormat(req.url || ''));
        } else if (res.writable && !res.writableEnded) {
          // Headers are already out; the status can no longer be changed, so
          // just close the response cleanly instead of hanging the client.
          res.end();
        }
      } catch (responderError) {
        report('Node HTTP listener: failed to send error response:', responderError);
        try {
          if (res.writable && !res.writableEnded) {
            res.end();
          }
        } catch {
          // Socket is already gone; nothing further to do.
        }
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
