/**
 * Node HTTP Listener - Convenience Functions
 *
 * Convenience functions for creating HTTP listeners with common configurations.
 * The main NodeHTTPListener is now exported from adapters/node/listener.ts
 *
 * @module
 */

import type { Bridge } from '../core/bridge.js';
import type { HTTPListenerOptions, HTTPRequestHandler } from './types.js';
import { NodeHTTPListener as NodeHTTPListenerImpl } from './adapters/node/listener.js';

// Re-export NodeHTTPListener for backward compatibility
export { NodeHTTPListener } from './adapters/node/listener.js';

/**
 * Create simple HTTP listener without advanced features
 */
export function createSimpleListener(bridge: Bridge): HTTPRequestHandler {
  return NodeHTTPListenerImpl(bridge, {
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
  return NodeHTTPListenerImpl(bridge, {
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
  return NodeHTTPListenerImpl(bridge, {
    validateAuth: options.validateAuth,
    rateLimit: options.rateLimit,
    cors: options.cors ?? true,
    streaming: true,
  });
}
