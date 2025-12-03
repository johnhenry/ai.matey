# JSDoc Documentation Checklist

## Overview
This checklist ensures EVERY export has comprehensive documentation with clear indicators and complete signatures.

## Documentation Standards

### ✅ Required for ALL Exports

Every exported item MUST have:

1. **Opening JSDoc comment** (`/**` not `/*`)
2. **Summary line** - One sentence describing what it is
3. **Detailed description** - 2-3 sentences explaining purpose and usage
4. **Appropriate tags** based on type (see below)
5. **Example** (when applicable)

## By Export Type

### 🔹 Functions & Methods

**Required:**
- [ ] Summary line
- [ ] Detailed description
- [ ] `@param` for EACH parameter (with type and description)
- [ ] `@returns` with type and description
- [ ] `@throws` if function can throw errors
- [ ] `@example` with realistic usage

**Example:**
```typescript
/**
 * Execute a chat request using Chrome's built-in AI.
 *
 * This method processes an IR chat request through Chrome AI's streaming API,
 * collecting all chunks into a complete response. Chrome AI always streams
 * internally, so this method consumes the stream and returns the final result.
 *
 * @param request - Universal IR chat request
 * @param signal - Optional AbortSignal for cancellation
 * @returns Promise resolving to IR chat response
 * @throws {ProviderError} If Chrome AI is unavailable
 *
 * @example
 * ```typescript
 * const response = await adapter.execute(request, signal);
 * console.log(response.message.content);
 * ```
 */
async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse>
```

### 🔹 Classes

**Required:**
- [ ] Class-level summary
- [ ] Detailed description of class purpose
- [ ] Usage notes (when to use this class)
- [ ] `@example` showing instantiation and basic usage

**Example:**
```typescript
/**
 * Frontend adapter for OpenAI Chat Completions API.
 *
 * This adapter transforms OpenAI-formatted requests/responses to Universal IR
 * and vice versa. Since OpenAI's format is close to IR, this is largely a
 * pass-through adapter with field name mapping.
 *
 * Use this adapter when integrating with OpenAI's API or OpenAI-compatible
 * endpoints (like Azure OpenAI, local models, etc.).
 *
 * @example
 * ```typescript
 * const adapter = new OpenAIFrontendAdapter();
 * const irRequest = await adapter.toIR(openaiRequest);
 * ```
 */
export class OpenAIFrontendAdapter implements FrontendAdapter
```

### 🔹 Interfaces

**Required:**
- [ ] Summary line describing what the interface represents
- [ ] Detailed description of purpose
- [ ] Property descriptions using `/** ... */` inline comments
- [ ] Related types mentioned with `@see` tags

**Example:**
```typescript
/**
 * Configuration options for the Generic Frontend Adapter.
 *
 * These options control how the adapter handles IR requests, including
 * validation, provenance tracking, and capability reporting.
 *
 * @see GenericFrontendAdapter
 */
export interface GenericFrontendConfig {
  /**
   * Custom adapter name for provenance tracking.
   * @default 'generic-frontend'
   */
  readonly name?: string;

  /**
   * Whether to validate requests before passing through.
   * @default false
   */
  readonly validateRequests?: boolean;
}
```

### 🔹 Type Aliases

**Required:**
- [ ] Summary describing what the type represents
- [ ] Explanation of when to use this type
- [ ] Related types with `@see` tags

**Example:**
```typescript
/**
 * OpenAI message content type.
 *
 * Can be either a simple string or an array of content blocks supporting
 * text and images. Use the array form when including images or when you
 * need fine-grained control over content structure.
 *
 * @see OpenAIMessage
 */
export type OpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;
```

### 🔹 Constants & Variables

**Required:**
- [ ] Summary line
- [ ] Explanation of what the value represents
- [ ] When/why this constant is used

**Example:**
```typescript
/**
 * Default mock models for testing.
 *
 * These models simulate various AI providers (GPT-4, Claude 3, etc.) with
 * realistic capabilities for use in tests and development without making
 * actual API calls.
 */
const DEFAULT_MOCK_MODELS: readonly AIModel[] = [...]
```

### 🔹 Enums

**Required:**
- [ ] Enum-level summary
- [ ] Purpose and usage description
- [ ] Inline comments for each member

**Example:**
```typescript
/**
 * Error codes for AI Matey errors.
 *
 * These codes categorize errors by type to enable appropriate error handling,
 * retry logic, and user messaging.
 */
export enum ErrorCode {
  /** Provider API returned an error */
  PROVIDER_ERROR = 'PROVIDER_ERROR',

  /** Request exceeded rate limits */
  RATE_LIMIT = 'RATE_LIMIT',

  /** Network or timeout error */
  NETWORK_ERROR = 'NETWORK_ERROR',
}
```

## Verification Steps

### 1. Run Audit Script
```bash
cd packages/ai.matey.docs
bash scripts/audit-jsdoc.sh
```

### 2. Generate Docs with Validation
```bash
npm run api:generate 2>&1 | grep -E "(warning|error|notDocumented)"
```

Look for warnings like:
- `warning: X has no documentation`
- `warning: Parameter 'x' has no description`

### 3. Visual Inspection

Visit http://localhost:3000/ai.matey/api/generated/ and check:

- [ ] **Functions section** - Should clearly show "Functions" heading
- [ ] **Classes section** - Should show "Classes" heading
- [ ] **Interfaces section** - Should show "Interfaces" heading
- [ ] **Type Aliases section** - Should show "Type Aliases" heading
- [ ] Each item has description text (not just type signature)
- [ ] Parameter tables are complete with descriptions
- [ ] Return value documented
- [ ] Examples are present and rendering correctly

### 4. Completeness Check

For each package in the sidebar:
1. Click through to the generated docs
2. Scroll through the entire page
3. Check every exported item has:
   - Clear section heading (Function, Class, Interface, etc.)
   - Summary description
   - Detailed documentation
   - Parameters documented (if applicable)
   - Example (if applicable)

## Priority Packages

Focus on these high-visibility packages first:

1. ✅ **frontend** - All 7 adapters (DONE)
2. ✅ **react-nextjs** - Hooks and utilities (DONE)
3. ✅ **react-stream** - Stream utilities (DONE)
4. ✅ **backend-browser** - Browser backends (DONE)
5. ⏰ **ai.matey.types** - Core type definitions
6. ⏰ **ai.matey.core** - Bridge and Router
7. ⏰ **ai.matey.errors** - Error classes
8. ⏰ **backend** - All backend adapters

## Quick Reference: TypeDoc Display

TypeDoc will display exports in this order (with our config):

1. **Functions** ← `export function` or `export async function`
2. **Classes** ← `export class`
3. **Interfaces** ← `export interface`
4. **Type Aliases** ← `export type`
5. **Enumerations** ← `export enum`
6. **Variables** ← `export const`

Each section will have:
- **Clear heading** (e.g., "## Functions")
- **Table of contents** at top
- **Signature** showing parameters and return type
- **Description** from JSDoc
- **Parameters table** (if applicable)
- **Returns** section (if applicable)
- **Examples** (if provided)

## Common Mistakes to Avoid

❌ **Don't:** Use single-line `/* */` comments
✅ **Do:** Use JSDoc `/** */` comments

❌ **Don't:** Skip parameter descriptions
✅ **Do:** Document every parameter

❌ **Don't:** Just repeat the type name ("OpenAI request")
✅ **Do:** Explain purpose and usage

❌ **Don't:** Skip examples for public APIs
✅ **Do:** Include realistic usage examples

## Automation

Add to package.json:
```json
{
  "scripts": {
    "audit:jsdoc": "bash scripts/audit-jsdoc.sh",
    "docs:validate": "npm run api:generate 2>&1 | grep -E 'notDocumented' || echo 'All documented!'"
  }
}
```

Run before committing:
```bash
npm run audit:jsdoc
npm run docs:validate
```
