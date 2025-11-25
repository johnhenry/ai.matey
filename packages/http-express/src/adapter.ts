/**
 * Express HTTP Adapter
 *
 * Converts Express Request/Response to GenericRequest/GenericResponse
 *
 * @module
 */

import type { Request, Response } from 'express';
import type { GenericRequest, GenericResponse } from 'ai.matey.http.core';
import { sendSSEHeaders, sendSSEChunk, sendSSEDone } from 'ai.matey.http.core';

/**
 * Adapter that converts Express Request to GenericRequest
 */
export class ExpressRequestAdapter implements GenericRequest {
  constructor(private req: Request) {}

  get method(): string {
    return this.req.method || 'GET';
  }

  get url(): string {
    return this.req.originalUrl || this.req.url || '/';
  }

  get headers(): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const [key, value] of Object.entries(this.req.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value;
      } else if (Array.isArray(value)) {
        headers[key.toLowerCase()] = value.join(', ');
      }
    }

    return headers;
  }

  get body(): any {
    // Express body is already parsed if body-parser middleware is used
    return this.req.body ?? null;
  }

  get params(): Record<string, string> | undefined {
    return this.req.params;
  }

  get query(): Record<string, string> | undefined {
    // Express query can have arrays, so we need to stringify them
    const query: Record<string, string> = {};

    for (const [key, value] of Object.entries(this.req.query)) {
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
    // Express provides multiple IP sources
    return this.req.ip || this.req.socket?.remoteAddress;
  }

  /**
   * Get the underlying Express request object
   */
  get raw(): Request {
    return this.req;
  }
}

/**
 * Adapter that converts GenericResponse methods to Express Response
 */
export class ExpressResponseAdapter implements GenericResponse {
  private _statusCode: number = 200;
  private _headersSent: boolean = false;

  constructor(private res: Response) {}

  status(code: number): void {
    this._statusCode = code;
    if (!this._headersSent) {
      this.res.status(code);
    }
  }

  header(name: string, value: string): void {
    if (!this._headersSent) {
      this.res.setHeader(name, value);
    }
  }

  send(data: any): void {
    if (!this.isWritable()) return;

    this._headersSent = true;

    // Handle empty string (e.g., for CORS preflight 204 responses)
    if (data === '') {
      this.res.end();
      return;
    }

    // Express has a built-in json() method
    this.res.status(this._statusCode).json(data);
  }

  async stream(generator: AsyncGenerator<any, void, undefined>): Promise<void> {
    if (!this.isWritable()) return;

    this._headersSent = true;

    // Get the underlying Node.js response for SSE
    const nodeRes = this.res as any;

    // Set SSE headers
    sendSSEHeaders(nodeRes, {});

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
    return !this.res.headersSent && this.res.writable;
  }

  /**
   * Get the underlying Express response object
   */
  get raw(): Response {
    return this.res;
  }
}
