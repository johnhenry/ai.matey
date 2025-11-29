# ai.matey.http

HTTP framework adapters for AI Matey - Universal AI Adapter System.

Part of the [ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

## Installation

```bash
npm install ai.matey.http
```

## Overview

This package provides HTTP framework integrations for serving AI Matey bridges as API endpoints. Supports multiple popular Node.js and edge frameworks.

## Included Adapters

- **Express** - Express.js middleware
- **Fastify** - Fastify handler
- **Hono** - Hono middleware (works on edge)
- **Koa** - Koa middleware
- **Node** - Native Node.js HTTP handler
- **Deno** - Deno HTTP handler

For core HTTP utilities (auth, CORS, rate limiting), see [`ai.matey.http-core`](https://www.npmjs.com/package/ai.matey.http-core).

## Usage

### Express

```typescript
import express from 'express';
import { ExpressMiddleware } from 'ai.matey.http';
import { Bridge } from 'ai.matey.core';

const app = express();
const bridge = new Bridge({ frontend, backend });

const middleware = new ExpressMiddleware({ bridge });
app.post('/v1/chat/completions', middleware.handler());
```

### Fastify

```typescript
import Fastify from 'fastify';
import { FastifyHandler } from 'ai.matey.http';

const fastify = Fastify();
const handler = new FastifyHandler({ bridge });

fastify.post('/v1/chat/completions', handler.handler());
```

### Hono

```typescript
import { Hono } from 'hono';
import { HonoMiddleware } from 'ai.matey.http';

const app = new Hono();
const middleware = new HonoMiddleware({ bridge });

app.post('/v1/chat/completions', middleware.handler());
```

### Node.js Native HTTP

```typescript
import http from 'http';
import { NodeHTTPListener } from 'ai.matey.http';

const listener = new NodeHTTPListener({ bridge });
const server = http.createServer(listener.handler());
```

### Deno

```typescript
import { DenoHandler } from 'ai.matey.http';

const handler = new DenoHandler({ bridge });
Deno.serve(handler.handler());
```

## API Reference

See the TypeScript definitions for detailed API documentation.

## License

MIT - see [LICENSE](./LICENSE) for details.
