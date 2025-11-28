/**
 * Express Middleware
 *
 * HTTP request middleware for Express that uses the core handler.
 *
 * @module
 */

import type { Request, Response, NextFunction } from 'express';
import type { Bridge } from 'ai.matey.core';
import type { HTTPListenerOptions } from 'ai.matey.http-core';
import { CoreHTTPHandler } from 'ai.matey.http-core';
import { ExpressRequestAdapter, ExpressResponseAdapter } from './adapter.js';

/**
 * Create Express middleware for handling AI chat requests
 *
 * @param bridge - Bridge instance
 * @param options - HTTP listener options
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { ExpressMiddleware } from 'ai.matey.http.express';
 *
 * const app = express();
 * const bridge = new Bridge(frontend, backend);
 *
 * // Use body parser middleware first
 * app.use(express.json());
 *
 * // Add AI chat middleware
 * app.use('/v1/messages', ExpressMiddleware(bridge, {
 *   cors: true,
 *   streaming: true,
 * }));
 *
 * app.listen(3000);
 * ```
 */
export function ExpressMiddleware(
  bridge: Bridge,
  options: HTTPListenerOptions = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  // Create core handler with all business logic
  const { cors, ...restOptions } = options;

  const coreHandler = new CoreHTTPHandler({
    bridge,
    cors: cors === false || cors === undefined ? undefined : cors === true ? {} : cors,
    ...(restOptions as any), // HTTPListenerOptions types are compatible with CoreHandlerOptions at runtime
  });

  // Return Express middleware
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Create adapters
      const genericReq = new ExpressRequestAdapter(req);
      const genericRes = new ExpressResponseAdapter(res);

      // Handle request through core handler
      await coreHandler.handle(genericReq, genericRes);
    } catch (error) {
      // Pass error to Express error handling middleware
      next(error);
    }
  };
}
