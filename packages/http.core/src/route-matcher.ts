/**
 * Route Matcher
 *
 * Matches incoming HTTP requests to configured routes.
 *
 * @module
 */

import type { IncomingMessage } from 'http';
import type { RouteConfig, MatchedRoute } from './types.js';

/**
 * Route matcher class
 */
export class RouteMatcher {
  private routes: RouteConfig[];

  constructor(routes: RouteConfig[]) {
    this.routes = routes;
  }

  /**
   * Match request to a route
   */
  match(req: IncomingMessage): MatchedRoute | null {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method?.toUpperCase() || 'GET';

    for (const route of this.routes) {
      // Check if method matches
      const routeMethods = route.methods || ['POST'];
      if (!routeMethods.includes(method)) {
        continue;
      }

      // Check if path matches
      const match = matchPath(path, route.path);
      if (match) {
        return {
          config: route,
          params: match.params,
        };
      }
    }

    return null;
  }

  /**
   * Add a route
   */
  addRoute(route: RouteConfig): void {
    this.routes.push(route);
  }

  /**
   * Remove a route
   */
  removeRoute(path: string): boolean {
    const index = this.routes.findIndex((r) => r.path === path);
    if (index >= 0) {
      this.routes.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all routes
   */
  getRoutes(): readonly RouteConfig[] {
    return this.routes;
  }
}

/**
 * Match path against pattern
 */
interface PathMatch {
  params: Record<string, string>;
}

function matchPath(path: string, pattern: string): PathMatch | null {
  // Exact match
  if (path === pattern) {
    return { params: {} };
  }

  // Wildcard match (supports simple * wildcards)
  if (pattern.includes('*')) {
    const regex = patternToRegex(pattern);
    if (regex.test(path)) {
      return { params: {} };
    }
    return null;
  }

  // Parameter match (supports :param syntax)
  if (pattern.includes(':')) {
    const match = matchParameterizedPath(path, pattern);
    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * Convert path pattern to regex
 */
function patternToRegex(pattern: string): RegExp {
  // Escape special regex characters except *
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // Convert * to regex wildcard
  const regexPattern = escaped.replace(/\*/g, '.*');

  return new RegExp(`^${regexPattern}$`);
}

/**
 * Match parameterized path (e.g., /users/:id)
 */
function matchParameterizedPath(path: string, pattern: string): PathMatch | null {
  const pathParts = path.split('/').filter(Boolean);
  const patternParts = pattern.split('/').filter(Boolean);

  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (!patternPart || !pathPart) {
      return null;
    }

    if (patternPart.startsWith(':')) {
      // Parameter
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      // Mismatch
      return null;
    }
  }

  return { params };
}

/**
 * Create default routes for common provider endpoints
 */
export function createDefaultRoutes(frontendAdapters: Map<string, any>): RouteConfig[] {
  const routes: RouteConfig[] = [];

  // OpenAI endpoint
  if (frontendAdapters.has('openai')) {
    routes.push({
      path: '/v1/chat/completions',
      methods: ['POST'],
      frontend: frontendAdapters.get('openai'),
    });
  }

  // Anthropic endpoint
  if (frontendAdapters.has('anthropic')) {
    routes.push({
      path: '/v1/messages',
      methods: ['POST'],
      frontend: frontendAdapters.get('anthropic'),
    });
  }

  return routes;
}

/**
 * Normalize path by removing trailing slashes and adding leading slash
 */
export function normalizePath(path: string): string {
  // Add leading slash if missing
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Remove trailing slash (except for root)
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  return path;
}

/**
 * Apply path prefix to route paths
 */
export function applyPathPrefix(routes: RouteConfig[], prefix: string): RouteConfig[] {
  const normalizedPrefix = normalizePath(prefix);

  return routes.map((route) => ({
    ...route,
    path: normalizedPrefix + normalizePath(route.path),
  }));
}
