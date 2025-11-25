/**
 * Authentication Handler
 *
 * Handles authentication validation for HTTP requests.
 *
 * @module
 */

import type { IncomingMessage } from 'http';
import type { AuthValidator } from './types.js';
import { extractBearerToken } from './request-parser.js';

/**
 * Default auth validator (always allows)
 */
export const defaultAuthValidator: AuthValidator = () => true;

/**
 * Create bearer token validator
 */
export function createBearerTokenValidator(
  validTokens: string[] | Set<string> | ((token: string) => boolean | Promise<boolean>)
): AuthValidator {
  return async (req: IncomingMessage): Promise<boolean> => {
    const token = extractBearerToken(req);

    if (!token) {
      return false;
    }

    if (typeof validTokens === 'function') {
      return await validTokens(token);
    }

    if (validTokens instanceof Set) {
      return validTokens.has(token);
    }

    return validTokens.includes(token);
  };
}

/**
 * Create API key validator (checks x-api-key header)
 */
export function createAPIKeyValidator(
  validKeys: string[] | Set<string> | ((key: string) => boolean | Promise<boolean>)
): AuthValidator {
  return async (req: IncomingMessage): Promise<boolean> => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return false;
    }

    if (typeof validKeys === 'function') {
      return await validKeys(apiKey);
    }

    if (validKeys instanceof Set) {
      return validKeys.has(apiKey);
    }

    return validKeys.includes(apiKey);
  };
}

/**
 * Create basic auth validator
 */
export function createBasicAuthValidator(
  credentials: Map<string, string> | ((username: string, password: string) => boolean | Promise<boolean>)
): AuthValidator {
  return async (req: IncomingMessage): Promise<boolean> => {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Basic ')) {
      return false;
    }

    try {
      const encoded = auth.slice(6);
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const [username, password] = decoded.split(':');

      if (!username || !password) {
        return false;
      }

      if (typeof credentials === 'function') {
        return await credentials(username, password);
      }

      return credentials.get(username) === password;
    } catch {
      return false;
    }
  };
}

/**
 * Combine multiple auth validators (OR logic)
 */
export function combineAuthValidators(...validators: AuthValidator[]): AuthValidator {
  return async (req: IncomingMessage): Promise<boolean> => {
    for (const validator of validators) {
      if (await validator(req)) {
        return true;
      }
    }
    return false;
  };
}

/**
 * Require all auth validators to pass (AND logic)
 */
export function requireAllAuth(...validators: AuthValidator[]): AuthValidator {
  return async (req: IncomingMessage): Promise<boolean> => {
    for (const validator of validators) {
      if (!(await validator(req))) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Skip auth for certain paths
 */
export function skipAuthForPaths(
  validator: AuthValidator,
  paths: string[] | ((path: string) => boolean)
): AuthValidator {
  return async (req: IncomingMessage): Promise<boolean> => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;

    if (typeof paths === 'function') {
      if (paths(path)) {
        return true;
      }
    } else if (paths.includes(path)) {
      return true;
    }

    return await validator(req);
  };
}
