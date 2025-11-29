# CORRECT IMPORT PATTERNS FOR AI.MATEY MONOREPO

## Package Names (use dots, not slashes or @scope)

### Core Packages
```typescript
import { Bridge } from 'ai.matey.core';
import type { IRChatRequest } from 'ai.matey.types';
import { AdapterError } from 'ai.matey.errors';
import { validateIRChatRequest } from 'ai.matey.utils';
```

### Backend Adapters (with subpaths)
```typescript
import { OpenAIBackendAdapter } from 'ai.matey.backend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { GeminiBackendAdapter } from 'ai.matey.backend/gemini';
```

### Frontend Adapters (with subpaths)
```typescript
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicFrontendAdapter } from 'ai.matey.frontend/anthropic';
```

### HTTP Adapters (with subpaths)
```typescript
import { NodeHTTPListener } from 'ai.matey.http/node';
import { ExpressMiddleware } from 'ai.matey.http/express';
import { FastifyHandler } from 'ai.matey.http/fastify';
```

### Wrappers (with subpaths)
```typescript
import { OpenAI } from 'ai.matey.wrapper/openai';
import { Anthropic } from 'ai.matey.wrapper/anthropic';
import { ChromeAILanguageModel } from 'ai.matey.wrapper/chrome-ai';
```

### Browser-Compatible Backends (with subpaths)
```typescript
import { MockBackendAdapter } from 'ai.matey.backend.browser/mock';
import { ChromeAIBackend } from 'ai.matey.backend.browser/chrome-ai';
```

### Native/Node.js-Only Packages
```typescript
import { NodeLlamaCppBackend } from 'ai.matey.native.node-llamacpp';
import { AppleBackend } from 'ai.matey.native.apple';
```

### Other Packages
```typescript
import { createLoggingMiddleware } from 'ai.matey.middleware';
import { toOpenAI } from 'ai.matey.cli';
import { createMockBackend } from 'ai.matey.testing';
```

### Umbrella Package (for convenience)
```typescript
import { Bridge, OpenAIFrontendAdapter, AnthropicBackendAdapter } from 'ai.matey';
```

## WRONG Patterns (DO NOT USE)

### ❌ Scoped Packages
```typescript
import { Bridge } from '@ai.matey/core'; // WRONG
import { OpenAI } from '@ai.matey/wrappers'; // WRONG
```

### ❌ Old Slash Paths
```typescript
import { OpenAI } from 'ai.matey/wrappers'; // WRONG
import { NodeHTTPListener } from 'ai.matey/http'; // WRONG
import { LlamaCppBackend } from 'ai.matey/adapters/backend-native'; // WRONG
```

### ❌ Dot Notation for Subpaths
```typescript
import { OpenAIBackendAdapter } from 'ai.matey.backend.openai'; // WRONG
```

## Key Rules

1. **Package names use DOTS**: `ai.matey.core`, `ai.matey.types`, etc.
2. **Subpaths use SLASH**: `ai.matey.backend/openai`, `ai.matey.http/express`
3. **NO scoped packages**: Never use `@ai.matey/*`
4. **NO old path structures**: Never use `ai.matey/adapters/*`
