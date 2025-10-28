# Structured Output Implementation Proposal

**Date:** 2025-10-26
**Status:** 📋 **PROPOSAL - AWAITING APPROVAL**
**Priority:** HIGH (Competitive gap vs Instructor-JS)

---

## Executive Summary

Add Zod-based structured output to ai.matey to match Instructor-JS's key feature while maintaining our zero-dependency core and provider-agnostic architecture. This will close a critical competitive gap identified in the ROADMAP.

**Key Benefits:**
- ✅ Type-safe data extraction from LLMs
- ✅ Runtime validation with Zod schemas
- ✅ Progressive streaming with partial validation
- ✅ Works with all providers through IR abstraction
- ✅ Integrates with routing, middleware, and fallback
- ✅ Optional dependency (maintains zero-dependency core)

---

## Where It Fits in the Architecture

### Current Flow (Without Structured Output)
```
Application Code
    ↓
Bridge/Router
    ↓ (middleware)
Backend Adapter
    ↓
Provider API
    ↓ (response)
Manual JSON.parse() + validation
```

### Proposed Flow (With Structured Output)
```
Application Code (with Zod schema)
    ↓
Bridge.generateObject<T>({ schema, ... })
    ↓ (converts schema → tool definition OR JSON mode)
    ↓ (middleware pipeline)
Backend Adapter
    ↓ (execute with structured output)
Provider API (with tool calling or JSON mode)
    ↓ (streaming response)
Progressive JSON Parser
    ↓ (incremental parsing + validation)
Validated TypeScript Object<T>
```

---

## Availability - Three Levels

### 1. **Core Level** - Direct Backend Usage
```typescript
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend'
import { generateObject } from 'ai.matey/structured'
import { z } from 'zod'

const backend = createOpenAIBackendAdapter({ apiKey: '...' })
const schema = z.object({
  name: z.string(),
  age: z.number()
})

// Direct usage with any backend
const result = await generateObject({
  backend,
  schema,
  messages: [{ role: 'user', content: 'Extract: John is 30' }],
  mode: 'tools' // or 'json'
})

console.log(result.name, result.age) // Typed!
```

### 2. **Bridge Level** - With Routing & Middleware
```typescript
import { Bridge, Router } from 'ai.matey'
import { z } from 'zod'

const router = new Router()
  .register('openai', openaiBackend)
  .register('anthropic', anthropicBackend)
  .setFallbackChain(['openai', 'anthropic'])

const bridge = new Bridge(frontend, router)

// Works with routing and fallback
const result = await bridge.generateObject({
  schema: UserSchema,
  messages: [{ role: 'user', content: 'Extract user...' }],
  model: 'gpt-4' // Router selects backend
})
```

### 3. **React Hooks Level** - Already Implemented!
```typescript
import { useObject } from 'ai.matey/react'
import { z } from 'zod'

// This already exists from our React hooks implementation!
const { object, submit, isLoading } = useObject({
  backend,
  model: 'gpt-4',
  schema: RecipeSchema
})
```

**Result:** Structured output available **everywhere** in ai.matey.

---

## Implementation Design

### Module Structure

```
src/structured/
├── index.ts                  # Public API exports
├── types.ts                  # TypeScript type definitions
├── generate-object.ts        # Core generateObject function
├── json-parser.ts            # Progressive JSON parsing
├── schema-converter.ts       # Zod → JSON Schema conversion
├── modes.ts                  # Extraction modes (tools, json, etc.)
└── validation.ts             # Validation utilities
```

### Core Types

```typescript
// src/structured/types.ts
import type { BackendAdapter } from '../types/adapters.js'
import type { IRMessage } from '../types/ir.js'

/**
 * Extraction modes (matching Instructor-JS)
 */
export type ExtractionMode =
  | 'tools'      // Use function/tool calling (most reliable)
  | 'json'       // Use JSON mode (response_format)
  | 'md_json'    // Extract JSON from markdown (fallback)
  | 'json_schema' // Direct JSON schema (OpenAI specific)

/**
 * Options for generateObject
 */
export interface GenerateObjectOptions<T> {
  /**
   * Backend adapter to use for generation
   */
  backend: BackendAdapter

  /**
   * Zod schema for validation and type inference
   */
  schema: any // Zod schema - typed as `any` to avoid hard dependency

  /**
   * Conversation messages
   */
  messages: IRMessage[]

  /**
   * Model to use (optional - backend may have default)
   */
  model?: string

  /**
   * Extraction mode
   * @default 'tools'
   */
  mode?: ExtractionMode

  /**
   * Schema name (for tool calling)
   * @default 'extract'
   */
  name?: string

  /**
   * Schema description (for tool calling)
   */
  description?: string

  /**
   * Enable streaming with partial validation
   * @default false
   */
  stream?: boolean

  /**
   * Additional parameters
   */
  temperature?: number
  maxTokens?: number

  /**
   * Callback for each partial update (streaming only)
   */
  onPartial?: (partial: Partial<T>) => void

  /**
   * Callback on completion
   */
  onFinish?: (result: T) => void | Promise<void>

  /**
   * Callback on error
   */
  onError?: (error: Error) => void
}

/**
 * Result from generateObject
 */
export interface GenerateObjectResult<T> {
  /**
   * Validated result object
   */
  data: T

  /**
   * Raw response content (for debugging)
   */
  raw: string

  /**
   * Validation warnings (if any partial failures)
   */
  warnings?: string[]

  /**
   * Metadata from response
   */
  metadata: {
    model: string
    finishReason: string
    usage?: {
      promptTokens: number
      completionTokens: number
      totalTokens: number
    }
  }
}
```

### Core Implementation

```typescript
// src/structured/generate-object.ts
import type { GenerateObjectOptions, GenerateObjectResult } from './types.js'
import type { IRChatRequest, IRMessage } from '../types/ir.js'
import { convertZodToJsonSchema } from './schema-converter.js'
import { parsePartialJSON } from './json-parser.js'

/**
 * Generate a structured object from LLM with Zod validation.
 *
 * Uses function/tool calling or JSON mode to extract validated data.
 *
 * @param options Generation options with Zod schema
 * @returns Validated object matching schema type
 *
 * @example
 * ```typescript
 * const result = await generateObject({
 *   backend,
 *   schema: z.object({ name: z.string(), age: z.number() }),
 *   messages: [{ role: 'user', content: 'John is 30' }],
 *   mode: 'tools'
 * })
 * console.log(result.data.name) // Typed as string
 * ```
 */
export async function generateObject<T>(
  options: GenerateObjectOptions<T>
): Promise<GenerateObjectResult<T>> {
  const {
    backend,
    schema,
    messages,
    model,
    mode = 'tools',
    name = 'extract',
    description,
    temperature,
    maxTokens,
    onFinish,
    onError,
  } = options

  try {
    // Convert Zod schema to JSON Schema
    const jsonSchema = convertZodToJsonSchema(schema)

    // Build request based on mode
    let request: IRChatRequest

    if (mode === 'tools') {
      // Use function/tool calling
      request = {
        messages,
        tools: [{
          name,
          description: description || `Extract structured data matching the ${name} schema`,
          parameters: jsonSchema
        }],
        toolChoice: { name }, // Force tool use
        parameters: {
          model,
          temperature,
          maxTokens,
        },
        metadata: {
          requestId: generateId(),
          timestamp: Date.now(),
          provenance: {},
        }
      }
    } else if (mode === 'json' || mode === 'json_schema') {
      // Use JSON mode
      request = {
        messages: [
          {
            role: 'system',
            content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`
          },
          ...messages
        ],
        parameters: {
          model,
          temperature,
          maxTokens,
          // Provider-specific JSON mode via custom parameters
          custom: {
            response_format: mode === 'json_schema'
              ? { type: 'json_schema', json_schema: jsonSchema }
              : { type: 'json_object' }
          }
        },
        metadata: {
          requestId: generateId(),
          timestamp: Date.now(),
          provenance: {},
        }
      }
    } else {
      // md_json mode - extract from markdown
      request = {
        messages: [
          {
            role: 'system',
            content: `Respond with JSON in a markdown code block:\n\`\`\`json\n...\n\`\`\``
          },
          ...messages
        ],
        parameters: {
          model,
          temperature,
          maxTokens,
        },
        metadata: {
          requestId: generateId(),
          timestamp: Date.now(),
          provenance: {},
        }
      }
    }

    // Execute request
    const response = await backend.execute(request)

    // Extract JSON content
    let jsonContent: string
    if (mode === 'tools') {
      // Extract from tool call arguments
      jsonContent = extractToolArguments(response)
    } else if (mode === 'md_json') {
      // Extract from markdown code block
      jsonContent = extractMarkdownJson(response.message.content as string)
    } else {
      // Direct JSON content
      jsonContent = typeof response.message.content === 'string'
        ? response.message.content
        : JSON.stringify(response.message.content)
    }

    // Parse and validate
    const parsed = JSON.parse(jsonContent)
    const validated = schema.parse(parsed) as T

    // Call onFinish
    if (onFinish) {
      await onFinish(validated)
    }

    return {
      data: validated,
      raw: jsonContent,
      metadata: {
        model: response.metadata.providerResponseId || model || 'unknown',
        finishReason: response.finishReason,
        usage: response.usage ? {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
        } : undefined
      }
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))

    if (onError) {
      onError(err)
    }

    throw err
  }
}

/**
 * Generate a structured object with streaming and partial validation.
 */
export async function* generateObjectStream<T>(
  options: GenerateObjectOptions<T>
): AsyncGenerator<Partial<T>, T, undefined> {
  // Implementation for streaming...
  // Similar to useObject hook we already built
}

function generateId(): string {
  return `structured-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function extractToolArguments(response: any): string {
  // Extract arguments from tool call in response
  // Implementation depends on IR tool call structure
}

function extractMarkdownJson(content: string): string {
  // Extract JSON from markdown code block
  const match = content.match(/```json\n([\s\S]*?)\n```/)
  if (match) {
    return match[1]
  }
  // Fallback: try to parse entire content
  return content
}
```

### Schema Converter

```typescript
// src/structured/schema-converter.ts
import type { JSONSchema } from '../types/ir.js'

/**
 * Convert Zod schema to JSON Schema.
 *
 * Uses zod-to-json-schema library internally.
 */
export function convertZodToJsonSchema(zodSchema: any): JSONSchema {
  // Use zod-to-json-schema package (peer dependency)
  // This is a thin wrapper that adds error handling

  try {
    // Dynamically import to avoid hard dependency
    const { zodToJsonSchema } = require('zod-to-json-schema')
    return zodToJsonSchema(zodSchema, {
      target: 'openApi3', // Compatible with most providers
      $refStrategy: 'none' // Inline all definitions
    })
  } catch (error) {
    throw new Error(
      'zod-to-json-schema is required for structured output. Install with: npm install zod-to-json-schema'
    )
  }
}
```

### Progressive JSON Parser

```typescript
// src/structured/json-parser.ts

/**
 * Parse potentially incomplete JSON during streaming.
 *
 * Handles partial JSON by attempting to close open structures.
 * Returns null if JSON cannot be parsed even with fixes.
 *
 * NOTE: This is the same implementation used in useObject hook.
 */
export function parsePartialJSON(jsonStr: string): any {
  if (!jsonStr.trim()) {
    return null
  }

  try {
    // First try parsing as-is
    return JSON.parse(jsonStr)
  } catch {
    // Try to fix incomplete JSON
    let fixed = jsonStr.trim()

    // Count open/close brackets and braces
    const openBraces = (fixed.match(/\{/g) || []).length
    const closeBraces = (fixed.match(/\}/g) || []).length
    const openBrackets = (fixed.match(/\[/g) || []).length
    const closeBrackets = (fixed.match(/\]/g) || []).length

    // Add missing closing characters
    fixed += '}'.repeat(Math.max(0, openBraces - closeBraces))
    fixed += ']'.repeat(Math.max(0, openBrackets - closeBrackets))

    try {
      return JSON.parse(fixed)
    } catch {
      // If still can't parse, return null
      return null
    }
  }
}

/**
 * Deep merge two objects for progressive updates.
 */
export function deepMerge(target: any, source: any): any {
  if (typeof source !== 'object' || source === null) {
    return source
  }

  if (Array.isArray(source)) {
    return source
  }

  const result = { ...target }
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
  }
  return result
}
```

### Bridge Integration

```typescript
// src/bridge.ts (additions)
import { generateObject, generateObjectStream } from './structured/index.js'
import type { GenerateObjectOptions } from './structured/types.js'

export class Bridge {
  // ... existing code ...

  /**
   * Generate structured object with Zod validation.
   *
   * Convenience method that uses the current router/backend
   * with structured output.
   *
   * @example
   * ```typescript
   * const user = await bridge.generateObject({
   *   schema: UserSchema,
   *   messages: [{ role: 'user', content: 'Extract...' }],
   *   model: 'gpt-4'
   * })
   * ```
   */
  async generateObject<T>(
    options: Omit<GenerateObjectOptions<T>, 'backend'>
  ): Promise<GenerateObjectResult<T>> {
    // Use the backend from router or direct backend
    const backend = this.backend

    return generateObject({
      ...options,
      backend
    })
  }

  /**
   * Generate structured object with streaming.
   */
  generateObjectStream<T>(
    options: Omit<GenerateObjectOptions<T>, 'backend'>
  ): AsyncGenerator<Partial<T>, T, undefined> {
    const backend = this.backend

    return generateObjectStream({
      ...options,
      backend
    })
  }
}
```

---

## Middleware Integration (Optional)

For advanced use cases, create a middleware that automatically applies structured output:

```typescript
// src/middleware/structured-output.ts
import type { Middleware } from '../types/middleware.js'
import { convertZodToJsonSchema } from '../structured/schema-converter.js'

export interface StructuredOutputMiddlewareConfig {
  schema: any // Zod schema
  mode?: 'tools' | 'json'
  name?: string
}

export function structuredOutputMiddleware(
  config: StructuredOutputMiddlewareConfig
): Middleware {
  return {
    name: 'structured-output',

    async onRequest(request, context) {
      const { schema, mode = 'tools', name = 'extract' } = config

      // Convert schema to JSON Schema
      const jsonSchema = convertZodToJsonSchema(schema)

      // Modify request to include tool or JSON mode
      if (mode === 'tools') {
        request.tools = [{
          name,
          description: `Extract structured data`,
          parameters: jsonSchema
        }]
        request.toolChoice = { name }
      } else {
        // Add system message for JSON mode
        request.messages = [
          {
            role: 'system',
            content: `Respond with JSON:\n${JSON.stringify(jsonSchema, null, 2)}`
          },
          ...request.messages
        ]
      }

      return request
    },

    async onResponse(response, context) {
      // Parse and validate response
      const { schema } = config

      // Extract JSON content based on mode
      const content = typeof response.message.content === 'string'
        ? response.message.content
        : JSON.stringify(response.message.content)

      const parsed = JSON.parse(content)
      const validated = schema.parse(parsed)

      // Replace content with validated data
      response.message.content = JSON.stringify(validated)

      return response
    }
  }
}
```

---

## Dependencies

### Required (Peer Dependencies)
- `zod` - Schema validation (user must install)
- `zod-to-json-schema` - Schema conversion (user must install)

### Optional
- None - uses existing ai.matey infrastructure

### package.json Updates
```json
{
  "peerDependencies": {
    "zod": "^3.22.0",
    "zod-to-json-schema": "^3.22.0"
  },
  "peerDependenciesMeta": {
    "zod": { "optional": true },
    "zod-to-json-schema": { "optional": true }
  }
}
```

**Rationale:** Same pattern as React hooks - optional peer dependencies maintain zero-dependency core.

---

## Usage Examples

### Example 1: Basic Extraction

```typescript
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend'
import { generateObject } from 'ai.matey/structured'
import { z } from 'zod'

const backend = createOpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY
})

const UserSchema = z.object({
  name: z.string().describe('Full name'),
  age: z.number().int().min(0),
  email: z.string().email(),
  phone: z.string().optional()
})

const result = await generateObject({
  backend,
  schema: UserSchema,
  messages: [{
    role: 'user',
    content: 'John Doe is 30 years old. Email: john@example.com'
  }],
  mode: 'tools'
})

console.log(result.data)
// { name: 'John Doe', age: 30, email: 'john@example.com' }
// Fully typed!
```

### Example 2: With Bridge & Router

```typescript
import { Bridge, Router } from 'ai.matey'
import { OpenAIFrontendAdapter } from 'ai.matey/adapters/frontend'
import { z } from 'zod'

const router = new Router()
  .register('openai', openaiBackend)
  .register('anthropic', anthropicBackend)
  .setStrategy('cost-optimized')
  .setFallbackChain(['openai', 'anthropic'])

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  router
)

// Works with routing and fallback!
const invoice = await bridge.generateObject({
  schema: InvoiceSchema,
  messages: [{ role: 'user', content: invoiceText }],
  model: 'gpt-4',
  mode: 'tools'
})

// If OpenAI fails, automatically falls back to Anthropic
```

### Example 3: Streaming with Progress

```typescript
const RecipeSchema = z.object({
  name: z.string(),
  ingredients: z.array(z.string()),
  steps: z.array(z.object({
    number: z.number(),
    instruction: z.string()
  })),
  cookingTime: z.number()
})

const stream = generateObjectStream({
  backend,
  schema: RecipeSchema,
  messages: [{ role: 'user', content: 'Recipe for chocolate chip cookies' }],
  mode: 'tools',
  onPartial: (partial) => {
    console.log('Progress:', {
      name: partial.name,
      ingredients: partial.ingredients?.length || 0,
      steps: partial.steps?.length || 0
    })
  }
})

for await (const partial of stream) {
  // Update UI with progressive data
  updateUI(partial)
}
```

### Example 4: Multiple Providers

```typescript
// Extract with OpenAI
const openaiResult = await generateObject({
  backend: openaiBackend,
  schema: EntitySchema,
  messages: [{ role: 'user', content: document }],
  mode: 'tools'
})

// Same code works with Anthropic
const anthropicResult = await generateObject({
  backend: anthropicBackend,
  schema: EntitySchema,
  messages: [{ role: 'user', content: document }],
  mode: 'tools'
})

// Or Gemini
const geminiResult = await generateObject({
  backend: geminiBackend,
  schema: EntitySchema,
  messages: [{ role: 'user', content: document }],
  mode: 'tools'
})
```

---

## Testing Strategy

### Unit Tests
```typescript
// tests/unit/structured-output.test.ts
describe('generateObject', () => {
  it('validates simple schemas', async () => {
    const schema = z.object({ count: z.number() })
    const result = await generateObject({
      backend: mockBackend,
      schema,
      messages: [{ role: 'user', content: 'Count to 5' }]
    })
    expect(result.data).toHaveProperty('count')
    expect(typeof result.data.count).toBe('number')
  })

  it('handles validation errors', async () => {
    const schema = z.object({ age: z.number().min(0).max(150) })
    await expect(
      generateObject({
        backend: mockBadBackend, // Returns age: 200
        schema,
        messages: [{ role: 'user', content: 'Age?' }]
      })
    ).rejects.toThrow()
  })

  it('works with all extraction modes', async () => {
    for (const mode of ['tools', 'json', 'md_json']) {
      const result = await generateObject({
        backend: mockBackend,
        schema: SimpleSchema,
        messages: [{ role: 'user', content: 'Test' }],
        mode
      })
      expect(result.data).toBeDefined()
    }
  })
})
```

### Integration Tests
```typescript
// tests/integration/structured-providers.test.ts
describe('Structured Output with Real Providers', () => {
  it('works with OpenAI', async () => {
    const backend = createOpenAIBackendAdapter({ apiKey: OPENAI_KEY })
    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [{ role: 'user', content: 'John is 30' }],
      mode: 'tools'
    })
    expect(result.data.name).toBe('John')
    expect(result.data.age).toBe(30)
  })

  it('works with Anthropic', async () => {
    const backend = createAnthropicBackendAdapter({ apiKey: ANTHROPIC_KEY })
    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [{ role: 'user', content: 'Jane is 25' }],
      mode: 'tools'
    })
    expect(result.data.name).toBe('Jane')
  })

  it('works with routing and fallback', async () => {
    const router = new Router()
      .register('openai', openaiBackend)
      .register('anthropic', anthropicBackend)
      .setFallbackChain(['openai', 'anthropic'])

    const bridge = new Bridge(frontend, router)

    // Should work even if one provider fails
    const result = await bridge.generateObject({
      schema: UserSchema,
      messages: [{ role: 'user', content: 'Test' }]
    })
    expect(result.data).toBeDefined()
  })
})
```

---

## Documentation Plan

### New Documentation Files

1. **`docs/structured-output.md`** (Main guide)
   - Introduction and benefits
   - Installation instructions
   - Basic usage examples
   - Extraction modes comparison
   - Streaming guide
   - Provider compatibility
   - Error handling
   - Best practices

2. **`examples/structured/`** (Code examples)
   - `basic-extraction.ts` - Simple extraction
   - `with-router.ts` - Using with routing
   - `streaming-progress.ts` - Progressive updates
   - `form-extraction.ts` - Form filling use case
   - `invoice-parser.ts` - Document parsing
   - `entity-extraction.ts` - NER use case
   - `multi-provider.ts` - Provider comparison

3. **Update existing docs**
   - Add to `README.md` feature list
   - Update `docs/ROADMAP.md` to mark as complete
   - Add to `docs/API.md` with API reference

### Example Documentation Structure

```markdown
# Structured Output Guide

## Overview

Extract type-safe, validated data structures from LLMs using Zod schemas.

## Installation

```bash
npm install zod zod-to-json-schema
```

## Basic Usage

```typescript
import { generateObject } from 'ai.matey/structured'
import { z } from 'zod'

const schema = z.object({
  name: z.string(),
  age: z.number()
})

const result = await generateObject({
  backend,
  schema,
  messages: [{ role: 'user', content: 'John is 30' }]
})

console.log(result.data) // { name: 'John', age: 30 }
```

## Extraction Modes

### Tools Mode (Recommended)
Most reliable. Uses function/tool calling.

### JSON Mode
Lighter weight. Uses response_format.

### Markdown JSON Mode
Fallback for providers without strict JSON support.

[... detailed guide continues ...]
```

---

## Implementation Timeline

### Phase 1: Core Module (Week 1)
- [ ] Create `src/structured/` directory structure
- [ ] Implement `types.ts`
- [ ] Implement `json-parser.ts` (reuse from useObject)
- [ ] Implement `schema-converter.ts`
- [ ] Implement `generate-object.ts` (non-streaming)
- [ ] Add peer dependencies to package.json
- [ ] Basic unit tests

### Phase 2: Streaming & Advanced Features (Week 2)
- [ ] Implement `generateObjectStream()`
- [ ] Add all extraction modes (tools, json, md_json, json_schema)
- [ ] Add validation error handling
- [ ] Integration tests with real providers
- [ ] Performance testing

### Phase 3: Bridge Integration (Week 3)
- [ ] Add `bridge.generateObject()` method
- [ ] Add `bridge.generateObjectStream()` method
- [ ] Create structured output middleware
- [ ] Integration tests with routing/fallback

### Phase 4: Documentation & Examples (Week 4)
- [ ] Write `docs/structured-output.md`
- [ ] Create 6+ examples
- [ ] Update main README
- [ ] Update ROADMAP
- [ ] API reference documentation

### Phase 5: Polish & Release
- [ ] Code review
- [ ] Performance optimization
- [ ] Edge case handling
- [ ] Beta testing
- [ ] Release v0.2.0

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Zod peer dependency issues | Low | Medium | Clear documentation, error messages |
| Provider compatibility | Medium | High | Test with all providers, fallback modes |
| Performance overhead | Low | Low | Minimal validation overhead, optional streaming |
| Schema conversion edge cases | Medium | Medium | Comprehensive testing, clear limitations |
| Streaming reliability | Medium | Medium | Robust error handling, partial validation |

---

## Competitive Comparison After Implementation

| Feature | Instructor-JS | ai.matey (After) |
|---------|---------------|------------------|
| **Zod Integration** | ✅ Core feature | ✅ Core feature |
| **Schema Validation** | ✅ Runtime validation | ✅ Runtime validation |
| **Streaming** | ✅ Partial hydration | ✅ Partial hydration |
| **Multi-Provider** | Via llm-polyglot | ✅ Native with routing |
| **Routing** | ❌ None | ✅ 7 strategies |
| **Middleware** | ❌ None | ✅ Built-in pipeline |
| **Fallback** | ❌ Manual | ✅ Automatic |
| **HTTP Server** | ❌ None | ✅ 6+ frameworks |
| **Type Inference** | ✅ From Zod | ✅ From Zod |
| **Extraction Modes** | ✅ 4 modes | ✅ 4 modes |

**Result:** Feature parity with Instructor-JS + all our existing advantages!

---

## Success Criteria

### Must Have (MVP)
- ✅ `generateObject()` function works with Zod schemas
- ✅ Works with OpenAI, Anthropic, Gemini backends
- ✅ Tools mode and JSON mode supported
- ✅ Runtime validation with clear error messages
- ✅ TypeScript type inference from schemas
- ✅ Integrates with Bridge
- ✅ Basic documentation and examples

### Should Have (v1.0)
- ✅ Streaming with partial validation
- ✅ All 4 extraction modes
- ✅ Works with Router and fallback
- ✅ Structured output middleware
- ✅ Comprehensive documentation
- ✅ 6+ real-world examples

### Nice to Have (Future)
- ⏳ Automatic mode selection based on provider
- ⏳ Schema caching for performance
- ⏳ Integration with React hooks (already have useObject!)
- ⏳ Support for nested tool calls
- ⏳ Retry with mode fallback

---

## Questions for Review

1. **Architecture Approval**
   - Does this fit well with the existing IR-based architecture?
   - Should structured output be a first-class method on BackendAdapter or a separate function?
   - Is the three-level availability (Core, Bridge, React) the right approach?

2. **Dependencies**
   - Is `zod-to-json-schema` acceptable as a peer dependency?
   - Should we vendor/inline any code to reduce dependencies?
   - Any concerns about Zod version compatibility?

3. **API Design**
   - Is `generateObject()` the right function name? (vs `extractObject`, `structuredOutput`, etc.)
   - Should extraction mode be required or default to 'tools'?
   - Any missing options in `GenerateObjectOptions`?

4. **Scope**
   - Should this be part of the core library or a separate package?
   - Should we implement all 4 extraction modes or start with just 'tools'?
   - Is streaming support critical for MVP?

5. **Documentation**
   - What examples would be most valuable?
   - Should we create video tutorials?
   - Migration guide from Instructor-JS needed?

---

## Next Steps

**If Approved:**
1. Create feature branch: `feat/structured-output`
2. Implement Phase 1 (Core Module)
3. Test with real providers
4. Iterate based on feedback
5. Complete all phases
6. Release as v0.2.0

**If Changes Needed:**
- Update proposal based on feedback
- Re-submit for approval
- Address concerns

---

**Proposal Submitted:** 2025-10-26
**Awaiting:** User approval to proceed with implementation
**Priority:** HIGH - Closes competitive gap with Instructor-JS
**Estimated Effort:** 4-5 weeks for full implementation
