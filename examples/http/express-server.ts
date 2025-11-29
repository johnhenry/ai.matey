/**
 * Express Server Example
 *
 * Create an HTTP server using Express and ai.matey.
 */

import express from 'express';
import { ExpressMiddleware } from 'ai.matey.http/express';
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

async function main() {
  const app = express();

  // Create bridge
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add JSON body parser
  app.use(express.json());

  // Add ai.matey middleware
  app.use(
    '/v1/chat/completions',
    ExpressMiddleware(bridge, {
      cors: true,
      streaming: true,
    })
  );

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ai.matey' });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Try: POST http://localhost:${PORT}/v1/chat/completions`);
    console.log(`
Example request:
curl -X POST http://localhost:${PORT}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
    `);
  });
}

main().catch(console.error);
