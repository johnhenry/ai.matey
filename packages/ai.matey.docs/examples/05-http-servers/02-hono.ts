/**
 * Hono HTTP Server - Ultra-Fast Edge Runtime API
 *
 * Demonstrates:
 * - Creating lightweight HTTP APIs with Hono
 * - Edge runtime compatibility (Cloudflare Workers, Deno, Bun)
 * - Minimal overhead and maximum performance
 * - TypeScript-first development
 * - Modern routing patterns
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in web.env.local.mjs
 * - Hono and ai.matey.http packages installed
 *
 * Run:
 *   npx tsx examples/05-http-servers/02-hono.ts
 *   # Or with Bun: bun run examples/05-http-servers/02-hono.ts
 *
 * Test:
 *   curl -X POST http://localhost:3000/v1/chat/completions \
 *     -H "Content-Type: application/json" \
 *     -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'
 *
 * Expected Output:
 *   Lightweight HTTP server with minimal memory footprint,
 *   ideal for serverless and edge deployments.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createHonoMiddleware } from 'ai.matey.http';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Hono HTTP Server',
    'Ultra-fast edge-compatible AI API with Hono',
    [
      'ANTHROPIC_API_KEY in web.env.local.mjs',
      'npm install hono ai.matey.http'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Create Hono app
    const app = new Hono();

    // Add built-in middleware
    app.use('*', logger()); // Request logging
    app.use('*', cors());   // CORS support

    // Create bridge
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    // Health check
    app.get('/health', (c) => {
      return c.json({
        status: 'ok',
        service: 'ai.matey',
        backend: 'anthropic',
        runtime: 'hono',
        timestamp: new Date().toISOString(),
      });
    });

    // Models endpoint
    app.get('/v1/models', (c) => {
      return c.json({
        object: 'list',
        data: [
          { id: 'gpt-4', object: 'model', created: Date.now() },
          { id: 'gpt-3.5-turbo', object: 'model', created: Date.now() },
        ],
      });
    });

    // Chat completions endpoint
    app.post(
      '/v1/chat/completions',
      createHonoMiddleware(bridge, {
        streaming: true,
        timeout: 60000,
      })
    );

    // 404 handler
    app.notFound((c) => {
      return c.json(
        {
          error: {
            message: 'Not found',
            type: 'not_found',
          },
        },
        404
      );
    });

    // Error handler
    app.onError((err, c) => {
      console.error('Server error:', err);
      return c.json(
        {
          error: {
            message: err.message || 'Internal server error',
            type: 'internal_error',
          },
        },
        500
      );
    });

    const PORT = Number(process.env.PORT) || 3000;

    console.log('\n═'.repeat(60));
    console.log(`✓ Hono server running on http://localhost:${PORT}`);
    console.log('═'.repeat(60) + '\n');

    console.log('📌 Available Endpoints:\n');
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`   GET  http://localhost:${PORT}/v1/models`);
    console.log(`   POST http://localhost:${PORT}/v1/chat/completions\n`);

    console.log('💡 Hono Benefits:');
    console.log('   ✓ Ultra-fast routing (40x faster than Express)');
    console.log('   ✓ Edge runtime compatible (Workers, Deno, Bun)');
    console.log('   ✓ Tiny bundle size (~12KB)');
    console.log('   ✓ TypeScript-first with great DX');
    console.log('   ✓ Built-in middleware (CORS, logger, etc.)');
    console.log('   ✓ Zero dependencies core\n');

    console.log('🚀 Deployment Options:');
    console.log('   • Cloudflare Workers (serverless edge)');
    console.log('   • Deno Deploy (edge runtime)');
    console.log('   • Bun (fast local development)');
    console.log('   • Node.js (traditional server)');
    console.log('   • Vercel Edge Functions');
    console.log('   • AWS Lambda@Edge\n');

    console.log('Press Ctrl+C to stop the server\n');

    // Serve (different for various runtimes)
    if (typeof Bun !== 'undefined') {
      // Bun runtime
      Bun.serve({
        port: PORT,
        fetch: app.fetch,
      });
    } else {
      // Node.js runtime
      const { serve } = await import('@hono/node-server');
      serve({
        fetch: app.fetch,
        port: PORT,
      });
    }

  } catch (error) {
    displayError(error, 'Hono server example');
    process.exit(1);
  }
}

main();
