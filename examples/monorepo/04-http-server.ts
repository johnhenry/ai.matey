/**
 * HTTP Server Example - Cross-Framework Integration
 *
 * Shows how to use HTTP framework integration packages:
 * - Express middleware
 * - Core HTTP utilities
 *
 * Each framework adapter is in its own package for minimal dependencies.
 */

import express from 'express';

// Core imports
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

// HTTP framework integration - only install what you need
import { ExpressMiddleware } from 'ai.matey.http/express';

// Middleware
import { createLoggingMiddleware } from 'ai.matey.middleware';

async function main() {
  const app = express();

  // Create bridge
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add logging
  bridge.use(
    createLoggingMiddleware({
      level: 'info',
      logRequests: true,
      logResponses: true,
    })
  );

  // JSON body parser
  app.use(express.json());

  // AI chat endpoint using Express middleware
  app.post(
    '/v1/chat/completions',
    ExpressMiddleware(bridge, {
      cors: true,
      streaming: true,
    })
  );

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ai.matey',
      packages: [
        'ai.matey.core',
        'ai.matey.frontend/openai',
        'ai.matey.backend/anthropic',
        'ai.matey.http/express',
        'ai.matey.http.core',
        'ai.matey.middleware',
      ],
    });
  });

  // List available models
  app.get('/v1/models', async (_req, res) => {
    try {
      const models = await bridge.listModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: 'Failed to list models' });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`
Endpoints:
  POST http://localhost:${PORT}/v1/chat/completions - Chat completions
  GET  http://localhost:${PORT}/v1/models - List models
  GET  http://localhost:${PORT}/health - Health check

Example request:
curl -X POST http://localhost:${PORT}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer your-api-key" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
    `);
  });
}

main().catch(console.error);
