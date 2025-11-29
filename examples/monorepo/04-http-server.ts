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
import { createExpressHandler } from 'ai.matey.http/express';
import { createCorsMiddleware, validateApiKey } from 'ai.matey.http.core';

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

  // CORS middleware from http-core package
  app.use(
    createCorsMiddleware({
      allowedOrigins: ['http://localhost:3000', 'https://your-app.com'],
      allowedMethods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // API key validation middleware
  app.use('/v1/*', (req, res, next) => {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    if (!validateApiKey(apiKey, { required: true })) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
    next();
  });

  // AI chat endpoint using Express handler
  app.post('/v1/chat/completions', createExpressHandler(bridge, {
    streaming: true,
    timeout: 30000,
  }));

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
