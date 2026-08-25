/**
 * Real-time streaming over WebSocket.
 *
 * Run: npm install ws && npx tsx examples/http/websocket-server.ts
 * (requires OPENAI_API_KEY)
 *
 * Client protocol (JSON text frames):
 *   → { "type": "chat", "id": "1", "request": { "model": "gpt-5-mini", "messages": [...], "stream": true } }
 *   ← { "type": "start" | "chunk" | "done" | "error", "id": "1", ... }
 *   → { "type": "cancel", "id": "1" }   // aborts an in-flight stream
 */

import { WebSocketServer } from 'ws';
import { createWebSocketHandler } from '@johnhenry/aimatey-http/websocket';
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend';
import { OpenAIBackendAdapter } from '@johnhenry/aimatey-backend';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! })
);

const server = new WebSocketServer({ port: 8080 });
server.on('connection', createWebSocketHandler(bridge, { maxConcurrentStreams: 5 }));

console.log('WebSocket chat server listening on ws://localhost:8080');
