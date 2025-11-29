/**
 * Hono Server Example
 *
 * Create a lightweight HTTP server using Hono and ai.matey.
 */

import { Hono } from 'hono';
import { HonoMiddleware } from 'ai.matey.http/hono';
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';

const app = new Hono();

// Create bridge
const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new AnthropicBackendAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'ai.matey' });
});

// AI chat endpoint
app.post(
  '/v1/chat/completions',
  HonoMiddleware(bridge, {
    cors: true,
    streaming: true,
  })
);

const PORT = Number(process.env.PORT) || 3000;

console.log(`Server running on http://localhost:${PORT}`);
console.log(`Try: POST http://localhost:${PORT}/v1/chat/completions`);

export default {
  port: PORT,
  fetch: app.fetch,
};
