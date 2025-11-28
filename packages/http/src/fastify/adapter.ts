/**
 * Fastify HTTP Adapter
 *
 * Converts Fastify Request/Reply to GenericRequest/GenericResponse
 *
 * @module
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { GenericRequest, GenericResponse } from 'ai.matey.http-core';
import { sendSSEHeaders, sendSSEChunk, sendSSEDone } from 'ai.matey.http-core';

/**
 * Adapter that converts Fastify Request to GenericRequest
 */
export class FastifyRequestAdapter implements GenericRequest {
  constructor(private request: FastifyRequest) {}

  get method(): string {
    return this.request.method || 'GET';
  }

  get url(): string {
    return this.request.url || '/';
  }

  get headers(): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(this.request.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value;
      } else if (Array.isArray(value)) {
        headers[key.toLowerCase()] = value.join(', ');
      }
    }

    return headers;
  }

  get body(): any {
    // Fastify automatically parses JSON body
    return this.request.body ?? null;
  }

  get params(): Record<string, string> | undefined {
    return this.request.params as Record<string, string>;
  }

  get query(): Record<string, string> | undefined {
    // Fastify query can have arrays, so we need to stringify them
    const query: Record<string, string> = {};

    for (const [key, value] of Object.entries(this.request.query || {})) {
      if (typeof value === 'string') {
        query[key] = value;
      } else if (Array.isArray(value)) {
        query[key] = value.join(',');
      } else if (value !== undefined) {
        query[key] = String(value);
      }
    }

    return Object.keys(query).length > 0 ? query : undefined;
  }

  get ip(): string | undefined {
    // Fastify provides IP through request.ip
    return this.request.ip || this.request.socket?.remoteAddress;
  }

  /**
   * Get the underlying Fastify request object
   */
  get raw(): FastifyRequest {
    return this.request;
  }
}

/**
 * Adapter that converts GenericResponse methods to Fastify Reply
 */
export class FastifyResponseAdapter implements GenericResponse {
  private _statusCode: number = 200;
  private _headersSent: boolean = false;

  constructor(private reply: FastifyReply) {}

  status(code: number): void {
    this._statusCode = code;
    if (!this._headersSent) {
      this.reply.code(code);
    }
  }

  header(name: string, value: string): void {
    if (!this._headersSent) {
      this.reply.header(name, value);
    }
  }

  send(data: any): void {
    if (!this.isWritable()) {
      return;
    }

    this._headersSent = true;

    // Handle empty string (e.g., for CORS preflight 204 responses)
    if (data === '') {
      this.reply.code(this._statusCode).send('');
      return;
    }

    // Fastify automatically JSON-stringifies objects
    this.reply.code(this._statusCode).send(data);
  }

  async stream(generator: AsyncGenerator<any, void, undefined>): Promise<void> {
    if (!this.isWritable()) {
      return;
    }

    this._headersSent = true;

    // Get the underlying Node.js response for SSE
    const nodeRes = this.reply.raw;

    // Set SSE headers
    sendSSEHeaders(nodeRes, {});

    try {
      // Stream chunks
      for await (const chunk of generator) {
        if (!this.isWritable()) {
          break;
        }
        sendSSEChunk(nodeRes, chunk);
      }

      // Send done marker
      if (this.isWritable()) {
        sendSSEDone(nodeRes);
      }
    } catch (error) {
      // If error occurs during streaming, we can't change status code
      // Just log and close
      console.error('Streaming error:', error);

      if (this.isWritable()) {
        nodeRes.end();
      }
    }
  }

  isWritable(): boolean {
    return !this.reply.sent && !this._headersSent;
  }

  /**
   * Get the underlying Fastify reply object
   */
  get raw(): FastifyReply {
    return this.reply;
  }
}
