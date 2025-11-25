/**
 * Streaming Handler
 *
 * Handles Server-Sent Events (SSE) streaming for HTTP responses.
 *
 * @module
 */

import type { ServerResponse } from 'http';
import type { Bridge } from 'ai.matey.core';
import { sendSSEHeaders, sendSSEChunk, sendSSEDone, sendSSEError, sendSSEEvent } from './response-formatter.js';

/**
 * Handle streaming request
 */
export async function handleStreamingRequest(
  bridge: Bridge,
  request: any,
  res: ServerResponse,
  format: 'openai' | 'anthropic' | 'generic' = 'generic',
  headers: Record<string, string> = {}
): Promise<void> {
  // Send SSE headers
  sendSSEHeaders(res, headers);

  try {
    // Get streaming response from bridge
    const stream = bridge.chatStream(request);

    // Stream chunks to client
    for await (const chunk of stream) {
      // Check if response is still writable
      if (!res.writable) {
        break;
      }

      // Format and send chunk based on provider format
      if (format === 'anthropic') {
        // Anthropic uses named events
        sendAnthropicChunk(res, chunk);
      } else {
        // OpenAI and generic use data-only format
        sendSSEChunk(res, chunk);
      }
    }

    // Send done marker (OpenAI style)
    if (format === 'openai' || format === 'generic') {
      sendSSEDone(res);
    } else {
      // Anthropic doesn't use [DONE] marker, just end the stream
      res.end();
    }
  } catch (error) {
    // Send error in stream
    sendSSEError(
      res,
      error instanceof Error ? error : new Error(String(error)),
      format
    );
  }
}

/**
 * Send Anthropic-formatted SSE chunk
 */
function sendAnthropicChunk(res: ServerResponse, chunk: any): void {
  // Anthropic uses event types
  if (chunk.type) {
    sendSSEEvent(res, chunk.type, chunk);
  } else {
    sendSSEChunk(res, chunk);
  }
}

/**
 * Create SSE keep-alive mechanism
 */
export class SSEKeepAlive {
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start sending keep-alive pings
   */
  start(res: ServerResponse, intervalMs: number = 15000): void {
    this.intervalId = setInterval(() => {
      if (res.writable) {
        res.write(': ping\n\n');
      } else {
        this.stop();
      }
    }, intervalMs);
  }

  /**
   * Stop sending keep-alive pings
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

/**
 * Handle client disconnect
 */
export function onClientDisconnect(
  res: ServerResponse,
  callback: () => void
): void {
  res.on('close', callback);
  res.on('finish', callback);
  res.on('error', callback);
}

/**
 * Check if response supports streaming
 */
export function supportsStreaming(res: ServerResponse): boolean {
  return typeof res.flushHeaders === 'function';
}

/**
 * Create streaming abort controller from response
 */
export function createAbortController(res: ServerResponse): AbortController {
  const controller = new AbortController();

  onClientDisconnect(res, () => {
    controller.abort();
  });

  return controller;
}
