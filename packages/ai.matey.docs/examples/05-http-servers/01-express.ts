/**
 * Express HTTP Server - RESTful AI API
 *
 * Demonstrates:
 * - Creating OpenAI-compatible HTTP endpoints with Express
 * - Handling both streaming and non-streaming responses
 * - CORS configuration for web clients
 * - Request validation and error handling
 * - Production-ready Express middleware
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in web.env.local.mjs
 * - Express and ai.matey.http packages installed
 *
 * Run:
 *   npx tsx examples/05-http-servers/01-express.ts
 *
 * Test:
 *   curl -X POST http://localhost:3000/v1/chat/completions \
 *     -H "Content-Type: application/json" \
 *     -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello!"}]}'
 *
 * Expected Output:
 *   HTTP server running on port 3000, accepting OpenAI-format requests
 *   and routing them through ai.matey to configured backend.
 */

import express from 'express';
import { createExpressMiddleware } from 'ai.matey.http';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { createLoggingMiddleware } from 'ai.matey.middleware';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayExampleInfo, displayError } from '../_shared/helpers.js';

async function main() {
  displayExampleInfo(
    'Express HTTP Server',
    'Create OpenAI-compatible API endpoints with Express',
    [
      'ANTHROPIC_API_KEY in web.env.local.mjs',
      'npm install express ai.matey.http'
    ]
  );

  try {
    const anthropicKey = requireAPIKey('anthropic');

    // Create Express app
    const app = express();

    // Create bridge with logging
    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey: anthropicKey })
    );

    // Add logging middleware
    bridge.use(
      createLoggingMiddleware({
        level: 'info',
        logRequests: true,
        logResponses: true,
      })
    );

    // Express middleware
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        service: 'ai.matey',
        backend: 'anthropic',
        timestamp: new Date().toISOString(),
      });
    });

    // OpenAI-compatible chat endpoint
    app.use(
      '/v1/chat/completions',
      createExpressMiddleware(bridge, {
        cors: true,          // Enable CORS for web clients
        streaming: true,     // Support streaming responses
        timeout: 60000,      // 60 second timeout
      })
    );

    // Models endpoint (optional)
    app.get('/v1/models', (_req, res) => {
      res.json({
        object: 'list',
        data: [
          { id: 'gpt-4', object: 'model', created: Date.now() },
          { id: 'gpt-3.5-turbo', object: 'model', created: Date.now() },
        ],
      });
    });

    // Error handler
    app.use((err: any, _req: any, res: any, _next: any) => {
      console.error('Server error:', err);
      res.status(500).json({
        error: {
          message: err.message || 'Internal server error',
          type: 'internal_error',
        },
      });
    });

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log('\n═'.repeat(60));
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log('═'.repeat(60) + '\n');

      console.log('📌 Available Endpoints:\n');
      console.log(`   GET  http://localhost:${PORT}/health`);
      console.log(`   GET  http://localhost:${PORT}/v1/models`);
      console.log(`   POST http://localhost:${PORT}/v1/chat/completions\n`);

      console.log('📝 Example Requests:\n');

      console.log('Standard request:');
      console.log(`curl -X POST http://localhost:${PORT}/v1/chat/completions \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{`);
      console.log(`    "model": "gpt-4",`);
      console.log(`    "messages": [{"role": "user", "content": "Hello!"}]`);
      console.log(`  }'\n`);

      console.log('Streaming request:');
      console.log(`curl -X POST http://localhost:${PORT}/v1/chat/completions \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -d '{`);
      console.log(`    "model": "gpt-4",`);
      console.log(`    "messages": [{"role": "user", "content": "Count to 5"}],`);
      console.log(`    "stream": true`);
      console.log(`  }'\n`);

      console.log('From JavaScript:');
      console.log(`fetch('http://localhost:${PORT}/v1/chat/completions', {`);
      console.log(`  method: 'POST',`);
      console.log(`  headers: { 'Content-Type': 'application/json' },`);
      console.log(`  body: JSON.stringify({`);
      console.log(`    model: 'gpt-4',`);
      console.log(`    messages: [{ role: 'user', content: 'Hello!' }]`);
      console.log(`  })`);
      console.log(`})\n`);

      console.log('💡 Server Features:');
      console.log('   ✓ OpenAI-compatible API format');
      console.log('   ✓ Streaming and non-streaming responses');
      console.log('   ✓ CORS enabled for web clients');
      console.log('   ✓ Request/response logging');
      console.log('   ✓ Health check endpoint');
      console.log('   ✓ Error handling\n');

      console.log('Press Ctrl+C to stop the server\n');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('\n\nShutting down gracefully...');
      process.exit(0);
    });

  } catch (error) {
    displayError(error, 'Express server example');
    process.exit(1);
  }
}

main();
