/**
 * Koa HTTP Adapter
 *
 * Converts Koa Context to GenericRequest/GenericResponse
 *
 * @module
 */

import type { Context } from 'koa';
import type { GenericRequest, GenericResponse } from '../../core/types.js';
import { sendSSEHeaders, sendSSEChunk, sendSSEDone } from '../../response-formatter.js';

/**
 * Adapter that converts Koa Context to GenericRequest
 */
export class KoaRequestAdapter implements GenericRequest {
  constructor(private ctx: Context) {}

  get method(): string {
    return this.ctx.method || 'GET';
  }

  get url(): string {
    return this.ctx.originalUrl || this.ctx.url || '/';
  }

  get headers(): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(this.ctx.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value;
      } else if (Array.isArray(value)) {
        headers[key.toLowerCase()] = value.join(', ');
      }
    }

    return headers;
  }

  get body(): any {
    // Koa body is already parsed if koa-bodyparser middleware is used
    return (this.ctx.request as any).body ?? null;
  }

  get params(): Record<string, string> | undefined {
    // Koa router stores params in ctx.params
    return (this.ctx as any).params;
  }

  get query(): Record<string, string> | undefined {
    // Koa query is available as ctx.query
    const query: Record<string, string> = {};

    for (const [key, value] of Object.entries(this.ctx.query)) {
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
    // Koa provides IP through ctx.ip
    return this.ctx.ip || this.ctx.request.socket?.remoteAddress;
  }

  /**
   * Get the underlying Koa context object
   */
  get raw(): Context {
    return this.ctx;
  }
}

/**
 * Adapter that converts GenericResponse methods to Koa Context
 */
export class KoaResponseAdapter implements GenericResponse {
  private _statusCode: number = 200;
  private _headersSent: boolean = false;

  constructor(private ctx: Context) {}

  status(code: number): void {
    this._statusCode = code;
    if (!this._headersSent) {
      this.ctx.status = code;
    }
  }

  header(name: string, value: string): void {
    if (!this._headersSent) {
      this.ctx.set(name, value);
    }
  }

  send(data: any): void {
    if (!this.isWritable()) return;

    this._headersSent = true;

    // Handle empty string (e.g., for CORS preflight 204 responses)
    if (data === '') {
      this.ctx.body = '';
      return;
    }

    // Koa automatically JSON-stringifies objects
    this.ctx.status = this._statusCode;
    this.ctx.body = data;
  }

  async stream(generator: AsyncGenerator<any, void, undefined>): Promise<void> {
    if (!this.isWritable()) return;

    this._headersSent = true;

    // Get the underlying Node.js response for SSE
    const nodeRes = this.ctx.res;

    // Set SSE headers
    sendSSEHeaders(nodeRes, {});

    // Set Koa to not handle the response
    this.ctx.respond = false;

    try {
      // Stream chunks
      for await (const chunk of generator) {
        if (!this.isWritable()) break;
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
    return !this.ctx.response.headerSent && this.ctx.writable;
  }

  /**
   * Get the underlying Koa context object
   */
  get raw(): Context {
    return this.ctx;
  }
}
