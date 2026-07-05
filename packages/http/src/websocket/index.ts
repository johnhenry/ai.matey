/**
 * WebSocket Streaming
 *
 * Transport-agnostic WebSocket handler for real-time AI chat. Zero-dependency
 * by design: instead of bundling a WebSocket implementation, it accepts any
 * socket satisfying the structural {@link WebSocketLike} interface — Node
 * `ws` sockets, `Deno.upgradeWebSocket` sockets, Bun sockets, or browser
 * WebSockets all qualify.
 *
 * Wire protocol (JSON text frames):
 * - client → server: `{ type: 'chat', id, request }`, `{ type: 'cancel', id }`
 * - server → client: `{ type: 'start' | 'chunk' | 'done' | 'error', id, ... }`
 *   plus periodic `{ type: 'ping' }` heartbeats
 *
 * @module
 */

import type { Bridge } from 'ai.matey.core';

/**
 * Structural WebSocket interface (satisfied by ws, Deno, Bun, browsers).
 */
export interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  /** DOM-style listener registration. */
  addEventListener?(type: 'message' | 'close' | 'error', listener: (event: unknown) => void): void;
  /** Node ws-style listener registration. */
  on?(type: 'message' | 'close' | 'error', listener: (...args: unknown[]) => void): void;
}

/**
 * Client → server messages.
 */
export type WebSocketClientMessage =
  | { type: 'chat'; id: string; request: unknown }
  | { type: 'cancel'; id: string }
  | { type: 'pong' };

/**
 * Server → client messages.
 */
export type WebSocketServerMessage =
  | { type: 'start'; id: string }
  | { type: 'chunk'; id: string; chunk: unknown }
  | { type: 'done'; id: string }
  | { type: 'error'; id: string | null; error: { message: string; code?: string } }
  | { type: 'ping' };

/**
 * Options for the WebSocket handler.
 */
export interface WebSocketHandlerOptions {
  /** Maximum concurrent streams per connection. @default 5 */
  maxConcurrentStreams?: number;

  /** Heartbeat interval in milliseconds (0 disables). @default 30000 */
  heartbeatMs?: number;

  /** Error observability hook. */
  onError?: (error: Error) => void;
}

/**
 * Create a per-connection handler streaming chat over a WebSocket.
 *
 * @example
 * ```typescript
 * import { WebSocketServer } from 'ws';
 * import { createWebSocketHandler } from 'ai.matey.http/websocket';
 *
 * const handleSocket = createWebSocketHandler(bridge);
 * new WebSocketServer({ port: 8080 }).on('connection', handleSocket);
 * ```
 */
export function createWebSocketHandler(
  bridge: Bridge,
  options: WebSocketHandlerOptions = {}
): (socket: WebSocketLike) => void {
  const maxConcurrentStreams = options.maxConcurrentStreams ?? 5;
  const heartbeatMs = options.heartbeatMs ?? 30000;

  return (socket: WebSocketLike): void => {
    const activeStreams = new Map<string, AbortController>();

    const sendMessage = (message: WebSocketServerMessage): void => {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    let heartbeat: ReturnType<typeof setInterval> | undefined;
    if (heartbeatMs > 0) {
      heartbeat = setInterval(() => sendMessage({ type: 'ping' }), heartbeatMs);
      if (typeof heartbeat === 'object' && 'unref' in heartbeat) {
        heartbeat.unref();
      }
    }

    const cleanup = (): void => {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      for (const controller of activeStreams.values()) {
        controller.abort();
      }
      activeStreams.clear();
    };

    const runChat = async (id: string, request: unknown): Promise<void> => {
      if (activeStreams.size >= maxConcurrentStreams) {
        sendMessage({
          type: 'error',
          id,
          error: { message: `Too many concurrent streams (max ${maxConcurrentStreams})` },
        });
        return;
      }

      const controller = new AbortController();
      activeStreams.set(id, controller);
      sendMessage({ type: 'start', id });

      try {
        const stream = bridge.chatStream(request as never, { signal: controller.signal });
        for await (const chunk of stream) {
          if (controller.signal.aborted) {
            break;
          }
          sendMessage({ type: 'chunk', id, chunk });
        }
        if (!controller.signal.aborted) {
          sendMessage({ type: 'done', id });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          sendMessage({
            type: 'error',
            id,
            error: { message: error instanceof Error ? error.message : String(error) },
          });
        }
      } finally {
        activeStreams.delete(id);
      }
    };

    const onMessage = (raw: unknown): void => {
      let parsed: WebSocketClientMessage;
      try {
        const text =
          typeof raw === 'string'
            ? raw
            : raw instanceof Uint8Array
              ? new TextDecoder().decode(raw)
              : String(raw);
        parsed = JSON.parse(text) as WebSocketClientMessage;
      } catch {
        sendMessage({ type: 'error', id: null, error: { message: 'Malformed JSON message' } });
        return;
      }

      switch (parsed.type) {
        case 'chat':
          if (!parsed.id || parsed.request === undefined) {
            sendMessage({
              type: 'error',
              id: parsed.id ?? null,
              error: { message: "'chat' requires 'id' and 'request'" },
            });
            return;
          }
          void runChat(parsed.id, parsed.request);
          break;

        case 'cancel':
          activeStreams.get(parsed.id)?.abort();
          activeStreams.delete(parsed.id);
          break;

        case 'pong':
          break;

        default:
          sendMessage({
            type: 'error',
            id: null,
            error: {
              message: `Unknown message type: ${String((parsed as { type?: string }).type)}`,
            },
          });
      }
    };

    // Support both listener styles; extract data from DOM MessageEvent
    if (socket.on) {
      socket.on('message', (data) => onMessage(data));
      socket.on('close', cleanup);
      socket.on('error', cleanup);
    } else if (socket.addEventListener) {
      socket.addEventListener('message', (event) =>
        onMessage((event as { data?: unknown }).data ?? event)
      );
      socket.addEventListener('close', cleanup);
      socket.addEventListener('error', cleanup);
    }
  };
}

/**
 * Attach the handler to a `ws`-style server's connection event.
 */
export function attachWebSocketServer(
  server: { on(event: 'connection', listener: (socket: WebSocketLike) => void): void },
  bridge: Bridge,
  options?: WebSocketHandlerOptions
): void {
  server.on('connection', createWebSocketHandler(bridge, options));
}
