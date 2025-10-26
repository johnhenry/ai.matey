/**
 * Deno HTTP Adapter
 *
 * Converts Deno Request/Response to GenericRequest/GenericResponse
 *
 * @module
 */

import type { GenericRequest, GenericResponse } from '../../core/types.js';

/**
 * Adapter that converts Deno Request to GenericRequest
 */
export class DenoRequestAdapter implements GenericRequest {
  private _body: any = null;

  constructor(
    private request: Request,
    private connInfo?: { remoteAddr?: { hostname?: string } }
  ) {}

  get method(): string {
    return this.request.method || 'GET';
  }

  get url(): string {
    return this.request.url || '/';
  }

  get headers(): Record<string, string> {
    const headers: Record<string, string> = {};

    this.request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    return headers;
  }

  get body(): any {
    // Return parsed body (must be set externally via setBody)
    return this._body;
  }

  get params(): Record<string, string> | undefined {
    // Params would need to be provided by routing layer
    return undefined;
  }

  get query(): Record<string, string> | undefined {
    // Parse query string from URL
    const url = new URL(this.request.url);
    const query: Record<string, string> = {};

    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    return Object.keys(query).length > 0 ? query : undefined;
  }

  get ip(): string | undefined {
    // Try to get IP from connection info or headers
    if (this.connInfo?.remoteAddr?.hostname) {
      return this.connInfo.remoteAddr.hostname;
    }

    const forwarded = this.request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0]?.trim();
    }

    const realIp = this.request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    return undefined;
  }

  /**
   * Set the parsed body (must be called before passing to handler)
   */
  setBody(body: any): void {
    this._body = body;
  }

  /**
   * Get the underlying Deno request object
   */
  get raw(): Request {
    return this.request;
  }
}

/**
 * Adapter that converts GenericResponse methods to Deno Response
 */
export class DenoResponseAdapter implements GenericResponse {
  private _statusCode: number = 200;
  private _headers: Headers = new Headers();
  private _sent: boolean = false;
  private _response: Response | null = null;

  constructor() {}

  status(code: number): void {
    if (!this._sent) {
      this._statusCode = code;
    }
  }

  header(name: string, value: string): void {
    if (!this._sent) {
      this._headers.set(name, value);
    }
  }

  send(data: any): void {
    if (this._sent) return;

    this._sent = true;

    // Clone headers to ensure they're properly set
    const headers = new Headers(this._headers);

    // Handle empty string (e.g., for CORS preflight 204 responses)
    if (data === '') {
      // 204 No Content responses cannot have a body (not even empty string)
      // Use null for 204, empty string for other status codes
      this._response = new Response(this._statusCode === 204 ? null : '', {
        status: this._statusCode,
        headers,
      });
      return;
    }

    // Create JSON response
    headers.set('Content-Type', 'application/json');
    this._response = new Response(JSON.stringify(data), {
      status: this._statusCode,
      headers,
    });
  }

  async stream(generator: AsyncGenerator<any, void, undefined>): Promise<void> {
    if (this._sent) return;

    this._sent = true;

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            const data = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }

          // Send done marker
          const done = 'data: [DONE]\n\n';
          controller.enqueue(new TextEncoder().encode(done));

          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);
          controller.error(error);
        }
      },
    });

    // Set SSE headers
    this._headers.set('Content-Type', 'text/event-stream');
    this._headers.set('Cache-Control', 'no-cache');
    this._headers.set('Connection', 'keep-alive');

    this._response = new Response(stream, {
      status: this._statusCode,
      headers: this._headers,
    });
  }

  isWritable(): boolean {
    return !this._sent;
  }

  /**
   * Get the generated Response object
   */
  getResponse(): Response {
    if (!this._response) {
      // If no response was generated, create an error response
      return new Response('Internal Server Error', { status: 500 });
    }
    return this._response;
  }
}
