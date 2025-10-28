# Frontend Integration for Structured Output

**Date:** 2025-10-26
**Status:** 📋 **DESIGN PROPOSAL**
**Related:** STRUCTURED_OUTPUT_PROPOSAL.md

---

## Problem

The current proposal focuses on backend-side structured output (`generateObject()`), but we should also support schemas at the **frontend level** so they flow through the entire pipeline.

**Use Case:**
```typescript
// User wants to pass schema in their native format (OpenAI, Anthropic, etc.)
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Extract user...' }],
  schema: UserSchema, // Pass Zod schema here
})
```

---

## Solution: Schema in IR

Add schema information to the IR so it flows from frontend → backend:

### 1. Extend IRChatRequest

```typescript
// src/types/ir.ts (additions)

/**
 * Schema definition for structured output.
 */
export interface IRSchema {
  /**
   * Schema type
   */
  type: 'zod' | 'json-schema'

  /**
   * The actual schema (Zod schema or JSON Schema object)
   */
  schema: any

  /**
   * Extraction mode preference
   */
  mode?: 'tools' | 'json' | 'md_json' | 'json_schema'

  /**
   * Schema name (for tool calling)
   */
  name?: string

  /**
   * Schema description
   */
  description?: string

  /**
   * Whether to validate the response
   * @default true
   */
  validate?: boolean
}

export interface IRChatRequest {
  // ... existing fields ...

  /**
   * Optional schema for structured output.
   *
   * When provided, the backend will attempt to return
   * structured data matching the schema.
   *
   * Backends implement this via:
   * - Tool calling (most providers)
   * - JSON mode (OpenAI, some others)
   * - Prompt engineering (fallback)
   */
  readonly schema?: IRSchema
}
```

### 2. Frontend Adapter Support

Each frontend adapter can accept schemas in their native format:

```typescript
// OpenAI Frontend - accepts Zod or OpenAI's native format
const openaiRequest = {
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Extract...' }],

  // Option 1: Pass Zod schema (universal)
  schema: UserSchema,

  // Option 2: Pass OpenAI native format (provider-specific)
  response_format: { type: 'json_object' },
  tools: [{
    type: 'function',
    function: { name: 'extract', parameters: {...} }
  }]
}

// Frontend adapter converts either format to IR
class OpenAIFrontendAdapter {
  async toIR(request: OpenAIRequest): Promise<IRChatRequest> {
    const ir: IRChatRequest = {
      messages: convertMessages(request.messages),
      // ... other fields ...
    }

    // If Zod schema provided, add to IR
    if (request.schema) {
      ir.schema = {
        type: 'zod',
        schema: request.schema,
        mode: 'tools', // or detect from other params
      }
    }

    // If OpenAI native format provided, convert to IR
    else if (request.response_format || request.tools) {
      // Convert OpenAI format to IR schema
      ir.schema = convertOpenAIToIRSchema(request)
    }

    return ir
  }
}
```

### 3. Backend Adapter Implementation

Each backend adapter implements schemas in the best way for that provider:

```typescript
// Backend adapters handle IRSchema
class OpenAIBackendAdapter {
  fromIR(request: IRChatRequest): OpenAIRequest {
    const providerRequest = {
      model: request.parameters?.model,
      messages: convertMessages(request.messages),
    }

    // Handle schema if provided
    if (request.schema) {
      const { schema, mode, name } = request.schema

      // Convert Zod to JSON Schema if needed
      const jsonSchema = schema.type === 'zod'
        ? convertZodToJsonSchema(schema.schema)
        : schema.schema

      if (mode === 'tools') {
        // Use tool calling
        providerRequest.tools = [{
          type: 'function',
          function: {
            name: name || 'extract',
            parameters: jsonSchema
          }
        }]
        providerRequest.tool_choice = { type: 'function', function: { name: name || 'extract' } }
      }
      else if (mode === 'json' || mode === 'json_schema') {
        // Use response_format
        providerRequest.response_format = mode === 'json_schema'
          ? { type: 'json_schema', json_schema: jsonSchema }
          : { type: 'json_object' }
      }
    }

    return providerRequest
  }

  toIR(response: OpenAIResponse, request: IRChatRequest): IRChatResponse {
    const ir = convertResponseToIR(response)

    // If schema validation requested, validate here
    if (request.schema?.validate !== false && request.schema?.schema) {
      const content = extractContent(response)
      try {
        const parsed = JSON.parse(content)
        const validated = request.schema.schema.parse(parsed)
        // Update IR with validated content
        ir.message.content = JSON.stringify(validated)
      } catch (error) {
        // Add validation warning
        ir.metadata.warnings = [
          ...(ir.metadata.warnings || []),
          {
            category: 'schema-validation-failed',
            severity: 'warning',
            message: `Schema validation failed: ${error.message}`,
            field: 'response',
          }
        ]
      }
    }

    return ir
  }
}
```

### 4. Bridge Convenience Methods

Bridge can handle both styles:

```typescript
class Bridge {
  // Style 1: Native frontend format (pass through)
  async chat(request: FrontendRequest): Promise<FrontendResponse> {
    // If request has schema, it flows through IR automatically
    return this.frontend.fromIR(
      await this.backend.execute(
        await this.frontend.toIR(request)
      )
    )
  }

  // Style 2: Universal format with explicit schema
  async chatWithSchema<T>(options: {
    schema: any,
    messages: IRMessage[],
    model?: string,
    mode?: 'tools' | 'json'
  }): Promise<T> {
    const ir: IRChatRequest = {
      messages: options.messages,
      schema: {
        type: 'zod',
        schema: options.schema,
        mode: options.mode || 'tools'
      },
      parameters: {
        model: options.model
      },
      metadata: {
        requestId: generateId(),
        timestamp: Date.now(),
        provenance: {}
      }
    }

    const response = await this.backend.execute(ir)

    // Parse and validate
    const content = typeof response.message.content === 'string'
      ? response.message.content
      : JSON.stringify(response.message.content)

    const parsed = JSON.parse(content)
    const validated = options.schema.parse(parsed)

    return validated as T
  }

  // Style 3: Using generateObject() (from main proposal)
  async generateObject<T>(options: GenerateObjectOptions<T>): Promise<GenerateObjectResult<T>> {
    return generateObject({
      ...options,
      backend: this.backend
    })
  }
}
```

---

## Usage Examples

### Example 1: Frontend-Native Format (OpenAI Style)

```typescript
import { OpenAIFrontendAdapter, OpenAIBackendAdapter, Bridge } from 'ai.matey'
import { z } from 'zod'

const frontend = new OpenAIFrontendAdapter()
const backend = new OpenAIBackendAdapter({ apiKey: '...' })
const bridge = new Bridge(frontend, backend)

const UserSchema = z.object({
  name: z.string(),
  age: z.number()
})

// Pass Zod schema directly in OpenAI-style request
const response = await bridge.chat({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'John is 30' }],
  schema: UserSchema, // ← Zod schema in frontend format
})

// Response is in OpenAI format
const user = JSON.parse(response.choices[0].message.content)
console.log(user) // { name: 'John', age: 30 }
```

### Example 2: Universal Format with Schema

```typescript
// Use universal IR format directly
const user = await bridge.chatWithSchema({
  schema: UserSchema,
  messages: [{ role: 'user', content: 'John is 30' }],
  model: 'gpt-4',
  mode: 'tools'
})

// Returns validated, typed object directly
console.log(user.name, user.age) // Typed!
```

### Example 3: Backend-Only (generateObject)

```typescript
// Use the standalone generateObject function
import { generateObject } from 'ai.matey/structured'

const result = await generateObject({
  backend,
  schema: UserSchema,
  messages: [{ role: 'user', content: 'John is 30' }],
  mode: 'tools'
})

console.log(result.data) // { name: 'John', age: 30 }
```

### Example 4: Provider Switch with Same Schema

```typescript
// Schema flows through IR, works with any provider!

// OpenAI
const openaiResponse = await bridge.chat({
  model: 'gpt-4',
  messages: [...],
  schema: UserSchema
})

// Switch to Anthropic backend
const anthropicBridge = new Bridge(
  new OpenAIFrontendAdapter(), // Keep same frontend
  new AnthropicBackendAdapter({ apiKey: '...' }) // Different backend
)

// Same request works!
const anthropicResponse = await anthropicBridge.chat({
  model: 'gpt-4', // Mapped to claude-3-5-sonnet via router
  messages: [...],
  schema: UserSchema // Same schema!
})
```

---

## Three Levels of Schema Support

### Level 1: IR-Embedded (Frontend → IR → Backend)
```typescript
// Schema travels through IR
Frontend Request (with schema)
    ↓
Frontend Adapter toIR() → adds schema to IR
    ↓
IR (with schema field)
    ↓
Backend Adapter fromIR() → implements schema
    ↓
Backend Adapter toIR() → validates response
    ↓
IR Response
    ↓
Frontend Adapter fromIR() → frontend format
```

**Pros:**
- Works with any frontend format
- Provider-agnostic
- Flows through middleware
- Can be logged/cached

**Cons:**
- Frontend adapters need schema conversion logic
- Backend adapters need schema implementation

### Level 2: Bridge Convenience Method
```typescript
// Bridge handles schema directly
await bridge.chatWithSchema({
  schema: UserSchema,
  messages: [...],
  model: 'gpt-4'
})
```

**Pros:**
- Simple API
- Type-safe
- Direct validation

**Cons:**
- Bypasses frontend adapter
- Less flexible

### Level 3: Standalone Function
```typescript
// Direct backend usage
await generateObject({
  backend,
  schema: UserSchema,
  messages: [...]
})
```

**Pros:**
- Most explicit
- Most control
- Works with any backend

**Cons:**
- More boilerplate
- No frontend format support

---

## Implementation Checklist

### IR Changes
- [ ] Add `IRSchema` interface to `src/types/ir.ts`
- [ ] Add `schema?: IRSchema` to `IRChatRequest`
- [ ] Update IR documentation

### Frontend Adapters
- [ ] Update `OpenAIFrontendAdapter` to accept `schema` in request
- [ ] Update `AnthropicFrontendAdapter` to accept `schema`
- [ ] Update other frontend adapters
- [ ] Convert Zod → provider-specific format in `toIR()`
- [ ] Add schema field to IR in `toIR()`

### Backend Adapters
- [ ] Update `OpenAIBackendAdapter` to handle `IRSchema` in `fromIR()`
- [ ] Update `AnthropicBackendAdapter` to handle `IRSchema`
- [ ] Update other backend adapters
- [ ] Implement schema via tools/JSON mode
- [ ] Optionally validate responses in `toIR()`

### Bridge
- [ ] Add `chatWithSchema<T>()` convenience method
- [ ] Ensure existing `chat()` passes schemas through
- [ ] Add `generateObject()` wrapper (from main proposal)

### Testing
- [ ] Test schema flow through IR
- [ ] Test with all frontend/backend combinations
- [ ] Test validation at different levels
- [ ] Test mode selection (tools vs JSON)

### Documentation
- [ ] Document schema in IR specification
- [ ] Update frontend adapter docs
- [ ] Update backend adapter docs
- [ ] Add examples for all three levels

---

## Benefits of This Approach

### 1. **Maximum Flexibility**
```typescript
// Use whichever style makes sense for your use case
await bridge.chat({ schema: UserSchema, ... })           // Level 1
await bridge.chatWithSchema({ schema: UserSchema, ... }) // Level 2
await generateObject({ backend, schema: UserSchema, ... }) // Level 3
```

### 2. **Provider Agnostic**
```typescript
// Schema works the same with any provider
const schema = UserSchema

// OpenAI
await generateObject({ backend: openaiBackend, schema, ... })

// Anthropic
await generateObject({ backend: anthropicBackend, schema, ... })

// Gemini
await generateObject({ backend: geminiBackend, schema, ... })
```

### 3. **Works with Routing**
```typescript
const router = new Router()
  .register('openai', openaiBackend)
  .register('anthropic', anthropicBackend)
  .setFallbackChain(['openai', 'anthropic'])

// Schema flows through routing and fallback
await bridge.chat({
  model: 'gpt-4',
  schema: UserSchema,
  messages: [...]
})
// If OpenAI fails, falls back to Anthropic with same schema!
```

### 4. **Middleware Compatible**
```typescript
bridge.use(loggingMiddleware()) // Logs schema
bridge.use(cachingMiddleware()) // Can cache by schema hash
bridge.use(validationMiddleware()) // Can pre-validate schemas

await bridge.chat({ schema: UserSchema, ... })
// Schema flows through entire middleware pipeline
```

### 5. **Gradual Adoption**
```typescript
// Start without schema
await bridge.chat({ messages: [...] })

// Add schema later
await bridge.chat({ messages: [...], schema: UserSchema })

// Or use advanced features
await generateObject({ backend, schema: UserSchema, stream: true })
```

---

## Migration Path

### Phase 1: IR Support (Core)
Add `schema` field to IR, update types

### Phase 2: Backend Implementation (Providers)
Each backend adapter implements schema handling

### Phase 3: Frontend Support (Adapters)
Frontend adapters accept and convert schemas

### Phase 4: Bridge Methods (Convenience)
Add `chatWithSchema()` and `generateObject()` to Bridge

### Phase 5: Documentation (Usage)
Document all three levels with examples

---

## Open Questions

1. **Should validation happen at backend or frontend level?**
   - Backend: More consistent, provider-agnostic
   - Frontend: More flexible, can customize per adapter
   - **Proposed:** Backend validates, frontend can override

2. **Should schema be required or optional in IR?**
   - Optional (current proposal) - backward compatible
   - **Approved**

3. **Should we support non-Zod schemas?**
   - JSON Schema directly (yes, for flexibility)
   - TypeBox, Yup, etc. (future consideration)
   - **Proposed:** Start with Zod + JSON Schema

4. **Should schema mode be required?**
   - Auto-detect based on provider capabilities (smart)
   - Require explicit mode (explicit)
   - **Proposed:** Default to 'tools', allow override

5. **How should validation failures be handled?**
   - Throw error (strict)
   - Return warning in metadata (lenient)
   - Make configurable (flexible)
   - **Proposed:** Configurable via `validate` flag

---

## Summary

**Three Ways to Use Structured Output:**

1. **Frontend-Native** - Pass schema in frontend format, flows through IR
   ```typescript
   await bridge.chat({ model: 'gpt-4', schema: UserSchema, ... })
   ```

2. **Universal Bridge Method** - Direct typed API
   ```typescript
   await bridge.chatWithSchema<User>({ schema: UserSchema, ... })
   ```

3. **Standalone Function** - Maximum control
   ```typescript
   await generateObject({ backend, schema: UserSchema, ... })
   ```

**All three styles:**
- ✅ Work with any provider
- ✅ Support routing and fallback
- ✅ Flow through middleware
- ✅ Provide type safety
- ✅ Validate at runtime

**Next Step:** Approve this design, then implement in phases.
