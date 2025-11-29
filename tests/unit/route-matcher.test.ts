/**
 * Tests for route-matcher.ts
 *
 * Tests for RouteMatcher class and path utilities.
 */

import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'http';
import {
  RouteMatcher,
  normalizePath,
  applyPathPrefix,
  createDefaultRoutes,
} from 'ai.matey.http.core';
import type { RouteConfig } from 'ai.matey.http.core';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRequest(url: string, method = 'POST'): IncomingMessage {
  return {
    url,
    method,
    headers: { host: 'localhost' },
  } as IncomingMessage;
}

function createTestRoute(path: string, methods: string[] = ['POST']): RouteConfig {
  return {
    path,
    methods,
    frontend: { metadata: { name: 'test' } },
  } as unknown as RouteConfig;
}

// ============================================================================
// RouteMatcher Tests
// ============================================================================

describe('RouteMatcher', () => {
  describe('constructor', () => {
    it('should create matcher with routes', () => {
      const routes = [createTestRoute('/api/chat')];
      const matcher = new RouteMatcher(routes);

      expect(matcher.getRoutes()).toHaveLength(1);
    });

    it('should create matcher with empty routes', () => {
      const matcher = new RouteMatcher([]);
      expect(matcher.getRoutes()).toHaveLength(0);
    });
  });

  describe('match() - exact paths', () => {
    it('should match exact path', () => {
      const routes = [createTestRoute('/v1/chat/completions')];
      const matcher = new RouteMatcher(routes);

      const req = createMockRequest('/v1/chat/completions');
      const result = matcher.match(req);

      expect(result).not.toBeNull();
      expect(result?.config.path).toBe('/v1/chat/completions');
    });

    it('should return null for non-matching path', () => {
      const routes = [createTestRoute('/v1/chat/completions')];
      const matcher = new RouteMatcher(routes);

      const req = createMockRequest('/v1/other/endpoint');
      const result = matcher.match(req);

      expect(result).toBeNull();
    });

    it('should be case-sensitive for paths', () => {
      const routes = [createTestRoute('/api/Chat')];
      const matcher = new RouteMatcher(routes);

      expect(matcher.match(createMockRequest('/api/Chat'))).not.toBeNull();
      expect(matcher.match(createMockRequest('/api/chat'))).toBeNull();
    });
  });

  describe('match() - methods', () => {
    it('should match when method is in allowed list', () => {
      const routes = [createTestRoute('/api/chat', ['POST', 'PUT'])];
      const matcher = new RouteMatcher(routes);

      expect(matcher.match(createMockRequest('/api/chat', 'POST'))).not.toBeNull();
      expect(matcher.match(createMockRequest('/api/chat', 'PUT'))).not.toBeNull();
    });

    it('should not match when method is not allowed', () => {
      const routes = [createTestRoute('/api/chat', ['POST'])];
      const matcher = new RouteMatcher(routes);

      expect(matcher.match(createMockRequest('/api/chat', 'GET'))).toBeNull();
      expect(matcher.match(createMockRequest('/api/chat', 'DELETE'))).toBeNull();
    });

    it('should default to POST method', () => {
      const route: RouteConfig = {
        path: '/api/chat',
        frontend: {} as any,
        // methods not specified - should default to POST
      };
      const matcher = new RouteMatcher([route]);

      expect(matcher.match(createMockRequest('/api/chat', 'POST'))).not.toBeNull();
      expect(matcher.match(createMockRequest('/api/chat', 'GET'))).toBeNull();
    });

    it('should handle case-insensitive method matching', () => {
      const routes = [createTestRoute('/api/chat', ['POST'])];
      const matcher = new RouteMatcher(routes);

      const req = createMockRequest('/api/chat', 'post');
      const result = matcher.match(req);

      // Method is uppercase in the match check
      expect(result).not.toBeNull();
    });
  });

  describe('match() - wildcard patterns', () => {
    it('should match wildcard at end', () => {
      const routes = [createTestRoute('/api/*')];
      const matcher = new RouteMatcher(routes);

      expect(matcher.match(createMockRequest('/api/anything'))).not.toBeNull();
      expect(matcher.match(createMockRequest('/api/deep/path'))).not.toBeNull();
      expect(matcher.match(createMockRequest('/other/path'))).toBeNull();
    });

    it('should match wildcard in middle', () => {
      const routes = [createTestRoute('/api/*/chat')];
      const matcher = new RouteMatcher(routes);

      expect(matcher.match(createMockRequest('/api/v1/chat'))).not.toBeNull();
      expect(matcher.match(createMockRequest('/api/v2/chat'))).not.toBeNull();
      expect(matcher.match(createMockRequest('/api/v1/other'))).toBeNull();
    });

    it('should match multiple wildcards', () => {
      const routes = [createTestRoute('/*/api/*')];
      const matcher = new RouteMatcher(routes);

      expect(matcher.match(createMockRequest('/v1/api/chat'))).not.toBeNull();
      expect(matcher.match(createMockRequest('/v2/api/models'))).not.toBeNull();
    });
  });

  describe('match() - parameterized paths', () => {
    it('should match parameterized path and extract params', () => {
      const routes = [createTestRoute('/users/:id')];
      const matcher = new RouteMatcher(routes);

      const result = matcher.match(createMockRequest('/users/123'));

      expect(result).not.toBeNull();
      expect(result?.params.id).toBe('123');
    });

    it('should match multiple parameters', () => {
      const routes = [createTestRoute('/orgs/:orgId/users/:userId')];
      const matcher = new RouteMatcher(routes);

      const result = matcher.match(createMockRequest('/orgs/acme/users/456'));

      expect(result).not.toBeNull();
      expect(result?.params.orgId).toBe('acme');
      expect(result?.params.userId).toBe('456');
    });

    it('should not match if segment count differs', () => {
      const routes = [createTestRoute('/users/:id')];
      const matcher = new RouteMatcher(routes);

      expect(matcher.match(createMockRequest('/users'))).toBeNull();
      expect(matcher.match(createMockRequest('/users/123/extra'))).toBeNull();
    });

    it('should match mixed static and parameterized segments', () => {
      const routes = [createTestRoute('/api/users/:id/profile')];
      const matcher = new RouteMatcher(routes);

      const result = matcher.match(createMockRequest('/api/users/42/profile'));

      expect(result).not.toBeNull();
      expect(result?.params.id).toBe('42');
    });
  });

  describe('match() - priority', () => {
    it('should match first matching route', () => {
      const routes = [
        createTestRoute('/api/specific'),
        createTestRoute('/api/*'),
      ];
      const matcher = new RouteMatcher(routes);

      const result = matcher.match(createMockRequest('/api/specific'));

      expect(result?.config.path).toBe('/api/specific');
    });

    it('should fallback to wildcard when no exact match', () => {
      const routes = [
        createTestRoute('/api/specific'),
        createTestRoute('/api/*'),
      ];
      const matcher = new RouteMatcher(routes);

      const result = matcher.match(createMockRequest('/api/other'));

      expect(result?.config.path).toBe('/api/*');
    });
  });

  describe('addRoute()', () => {
    it('should add route to matcher', () => {
      const matcher = new RouteMatcher([]);

      matcher.addRoute(createTestRoute('/new/route'));

      expect(matcher.getRoutes()).toHaveLength(1);
      expect(matcher.match(createMockRequest('/new/route'))).not.toBeNull();
    });
  });

  describe('removeRoute()', () => {
    it('should remove route by path', () => {
      const matcher = new RouteMatcher([
        createTestRoute('/api/keep'),
        createTestRoute('/api/remove'),
      ]);

      const removed = matcher.removeRoute('/api/remove');

      expect(removed).toBe(true);
      expect(matcher.getRoutes()).toHaveLength(1);
      expect(matcher.match(createMockRequest('/api/remove'))).toBeNull();
    });

    it('should return false for non-existent route', () => {
      const matcher = new RouteMatcher([createTestRoute('/api/chat')]);

      const removed = matcher.removeRoute('/non/existent');

      expect(removed).toBe(false);
      expect(matcher.getRoutes()).toHaveLength(1);
    });
  });

  describe('getRoutes()', () => {
    it('should return all routes', () => {
      const routes = [
        createTestRoute('/api/a'),
        createTestRoute('/api/b'),
        createTestRoute('/api/c'),
      ];
      const matcher = new RouteMatcher(routes);

      expect(matcher.getRoutes()).toHaveLength(3);
    });
  });
});

// ============================================================================
// normalizePath Tests
// ============================================================================

describe('normalizePath', () => {
  it('should add leading slash if missing', () => {
    expect(normalizePath('api/chat')).toBe('/api/chat');
    expect(normalizePath('path')).toBe('/path');
  });

  it('should remove trailing slash', () => {
    expect(normalizePath('/api/chat/')).toBe('/api/chat');
    expect(normalizePath('/path/')).toBe('/path');
  });

  it('should keep root path as is', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('should handle path with both issues', () => {
    expect(normalizePath('api/chat/')).toBe('/api/chat');
  });

  it('should not modify already normalized paths', () => {
    expect(normalizePath('/api/chat')).toBe('/api/chat');
    expect(normalizePath('/v1/models')).toBe('/v1/models');
  });
});

// ============================================================================
// applyPathPrefix Tests
// ============================================================================

describe('applyPathPrefix', () => {
  it('should prepend prefix to all routes', () => {
    const routes = [
      createTestRoute('/chat'),
      createTestRoute('/models'),
    ];

    const prefixed = applyPathPrefix(routes, '/v1');

    expect(prefixed[0].path).toBe('/v1/chat');
    expect(prefixed[1].path).toBe('/v1/models');
  });

  it('should normalize prefix', () => {
    const routes = [createTestRoute('/chat')];

    const prefixed = applyPathPrefix(routes, 'api/');

    expect(prefixed[0].path).toBe('/api/chat');
  });

  it('should normalize route paths', () => {
    const routes = [createTestRoute('chat/')];

    const prefixed = applyPathPrefix(routes, '/api');

    expect(prefixed[0].path).toBe('/api/chat');
  });

  it('should preserve other route properties', () => {
    const route: RouteConfig = {
      path: '/chat',
      methods: ['POST', 'GET'],
      frontend: { metadata: { name: 'test' } } as any,
    };

    const prefixed = applyPathPrefix([route], '/v1');

    expect(prefixed[0].methods).toEqual(['POST', 'GET']);
    expect(prefixed[0].frontend).toBeDefined();
  });

  it('should handle empty prefix', () => {
    const routes = [createTestRoute('/chat')];

    const prefixed = applyPathPrefix(routes, '/');

    expect(prefixed[0].path).toBe('//chat');
  });
});

// ============================================================================
// createDefaultRoutes Tests
// ============================================================================

describe('createDefaultRoutes', () => {
  it('should create OpenAI route when adapter is present', () => {
    const adapters = new Map();
    adapters.set('openai', { metadata: { name: 'openai' } });

    const routes = createDefaultRoutes(adapters);

    expect(routes.some(r => r.path === '/v1/chat/completions')).toBe(true);
  });

  it('should create Anthropic route when adapter is present', () => {
    const adapters = new Map();
    adapters.set('anthropic', { metadata: { name: 'anthropic' } });

    const routes = createDefaultRoutes(adapters);

    expect(routes.some(r => r.path === '/v1/messages')).toBe(true);
  });

  it('should create routes for all adapters', () => {
    const adapters = new Map();
    adapters.set('openai', { metadata: { name: 'openai' } });
    adapters.set('anthropic', { metadata: { name: 'anthropic' } });

    const routes = createDefaultRoutes(adapters);

    expect(routes).toHaveLength(2);
  });

  it('should return empty array when no adapters', () => {
    const adapters = new Map();

    const routes = createDefaultRoutes(adapters);

    expect(routes).toHaveLength(0);
  });

  it('should set POST method for routes', () => {
    const adapters = new Map();
    adapters.set('openai', { metadata: { name: 'openai' } });

    const routes = createDefaultRoutes(adapters);

    expect(routes[0].methods).toContain('POST');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Route Matcher Edge Cases', () => {
  it('should handle URL with query string', () => {
    const routes = [createTestRoute('/api/chat')];
    const matcher = new RouteMatcher(routes);

    const req = createMockRequest('/api/chat?model=gpt-4');
    const result = matcher.match(req);

    expect(result).not.toBeNull();
  });

  it('should handle URL with hash', () => {
    const routes = [createTestRoute('/api/chat')];
    const matcher = new RouteMatcher(routes);

    const req = createMockRequest('/api/chat#section');
    const result = matcher.match(req);

    expect(result).not.toBeNull();
  });

  it('should handle empty URL', () => {
    const routes = [createTestRoute('/')];
    const matcher = new RouteMatcher(routes);

    const req = createMockRequest('/');
    const result = matcher.match(req);

    expect(result).not.toBeNull();
  });

  it('should handle missing URL', () => {
    const routes = [createTestRoute('/')];
    const matcher = new RouteMatcher(routes);

    const req = { method: 'POST', headers: { host: 'localhost' } } as IncomingMessage;
    const result = matcher.match(req);

    expect(result).not.toBeNull();
  });

  it('should handle missing method', () => {
    const routes = [createTestRoute('/api/chat', ['GET'])];
    const matcher = new RouteMatcher(routes);

    const req = { url: '/api/chat', headers: { host: 'localhost' } } as IncomingMessage;
    const result = matcher.match(req);

    expect(result).not.toBeNull(); // Defaults to GET
  });

  it('should handle special regex characters in path', () => {
    const routes = [createTestRoute('/api/chat.json')];
    const matcher = new RouteMatcher(routes);

    const result = matcher.match(createMockRequest('/api/chat.json'));

    expect(result).not.toBeNull();
  });

  it('should escape regex characters in wildcard patterns', () => {
    const routes = [createTestRoute('/api/*.json')];
    const matcher = new RouteMatcher(routes);

    expect(matcher.match(createMockRequest('/api/data.json'))).not.toBeNull();
    expect(matcher.match(createMockRequest('/api/dataXjson'))).toBeNull(); // . should be literal
  });
});
