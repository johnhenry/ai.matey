# React Hooks Bug Fixes and Improvements

This document catalogs all bugs, hallucinations, and edge cases found during code review of the React hooks implementation.

**Review Date:** 2025-10-26
**Scope:** React hooks (useChat, useCompletion, useObject), types, documentation, examples

## Summary

**Total Issues Found:** 15
- 🔴 Critical (breaks functionality): 4
- 🟠 High (causes errors in common scenarios): 5
- 🟡 Medium (edge cases, warnings): 4
- 🔵 Low (documentation, minor improvements): 2

---

## Critical Issues (🔴)

### 1. React Must Be Pre-Loaded Before Using Hooks

**File:** `src/react/use-chat.ts:129`, `use-completion.ts:106`, `use-object.ts:169`

**Problem:**
Hooks check `isReactLoaded()` synchronously, but React is loaded asynchronously via `checkReactAvailability()`. This creates a chicken-and-egg problem: hooks will ALWAYS throw "React is not installed" error on first use, even if React is installed.

**Current Code:**
```typescript
export function useChat(options: UseChatOptions): UseChatHelpers {
  // Check React availability
  if (!isReactLoaded()) {  // ❌ This checks a flag that's never set!
    throw new Error('React is not installed...');
  }
  // ...
}
```

**Problem:** `reactAvailable` flag is only set by calling `await checkReactAvailability()`, but nothing calls that before the hooks are used.

**Fix:** React must be imported at module load time, not runtime checked. Change approach:

```typescript
// At top of file
let React: any;
try {
  React = require('react');  // Will throw if not installed
} catch {
  React = null;
}

export function useChat(options: UseChatOptions): UseChatHelpers {
  if (!React) {
    throw new Error('React is not installed. Please install:\nnpm install react react-dom');
  }

  const { useState, useCallback, useRef } = React;
  // ...
}
```

**Impact:** Hooks are completely broken and unusable. Users will always get "React is not installed" even when it IS installed.

---

### 2. React Type Annotations Cause TypeScript Errors

**File:** `src/react/types.ts:255`, `types.ts:330`

**Problem:**
Type annotations use `React.ChangeEvent` and `React.FormEvent`, but `React` namespace is not imported or declared. This causes TypeScript compilation errors.

**Current Code:**
```typescript
handleInputChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
handleSubmit: (event?: React.FormEvent<HTMLFormElement>) => void;
```

**Error:**
```
Cannot find namespace 'React'
```

**Fix:** Import React types or use fully qualified names:

```typescript
// Option 1: Import types
import type * as React from 'react';

// Option 2: Use generic types
handleInputChange: (event: {
  target: { value: string };
  preventDefault?: () => void;
}) => void;
```

**Impact:** TypeScript compilation fails. Code won't build.

---

### 3. Dependency Array in sendMessage Causes Infinite Loops

**File:** `src/react/use-chat.ts:307-318`

**Problem:**
The `sendMessage` callback includes `messages` in its dependency array. This means `sendMessage` is recreated every time `messages` changes, which happens on every message sent. This can cause:
1. Infinite re-renders if `sendMessage` is used in effects
2. Performance degradation
3. Stale closures

**Current Code:**
```typescript
const sendMessage = useCallback(
  async (content: string) => {
    // Uses messages here
    const allMessages = [...messages, userMessage];
    // ...
  },
  [
    messages,  // ❌ This causes sendMessage to change on every message!
    backend,
    // ...
  ]
);
```

**Fix:** Use functional state updates to avoid depending on `messages`:

```typescript
const sendMessage = useCallback(
  async (content: string) => {
    // ...
    setMessages((prev) => [...prev, userMessage]);  // ✅ Use functional update

    // Build request from previous messages + new one
    setMessages((prev) => {
      const allMessages = [...prev, userMessage];
      const irMessages: IRMessage[] = allMessages.map(toIRMessage);
      // Build and send request...
      return [...prev, assistantMessage];
    });
  },
  [
    // messages removed from deps ✅
    backend,
    model,
    // ...
  ]
);
```

**Impact:** Performance issues, potential infinite loops, React warnings about dependency arrays.

---

### 4. State Updates After Unmount (Memory Leaks)

**File:** `src/react/use-chat.ts`, `use-completion.ts`, `use-object.ts`

**Problem:**
No checks to prevent state updates after component unmounts. If a stream is still running when component unmounts, `setState` calls will trigger React warnings and memory leaks.

**Current Code:**
```typescript
for await (const chunk of stream) {
  if (controller.signal.aborted) {
    break;
  }

  if (chunk.type === 'content' && chunk.delta') {
    setMessages(/* ... */);  // ❌ Might be called after unmount!
  }
}
```

**Warning:**
```
Warning: Can't perform a React state update on an unmounted component.
```

**Fix:** Add mounted flag with useRef:

```typescript
const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    isMountedRef.current = false;
  };
}, []);

// In async functions:
for await (const chunk of stream) {
  if (!isMountedRef.current || controller.signal.aborted) {
    break;
  }

  if (chunk.type === 'content') {
    setMessages(/* ... */);  // ✅ Safe now
  }
}
```

**Impact:** React warnings, potential memory leaks, console errors in development.

---

## High Priority Issues (🟠)

### 5. Progressive JSON Parsing Fails on Complex Structures

**File:** `src/react/use-object.ts:71-104`

**Problem:**
The `parsePartialJSON` function uses simplistic brace/bracket counting. This fails for:
- Strings containing braces/brackets: `{"text": "{ not valid JSON }"}`
- Escaped quotes: `{"name": "John \"Johnny\" Doe"}`
- Nested complex structures
- Comments (if AI generates them)

**Current Code:**
```typescript
const openBraces = (fixed.match(/\{/g) || []).length;  // ❌ Counts braces in strings too!
const closeBraces = (fixed.match(/\}/g) || []).length;
```

**Example Failure:**
```json
{"text": "Use { braces } for"  // Incomplete, but has equal braces
```
The parser will think it's balanced and fail to add closing brace.

**Fix:** Use a proper JSON parser or state machine:

```typescript
function parsePartialJSON(jsonStr: string): any {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try multiple strategies
    const strategies = [
      () => JSON.parse(jsonStr + '}'),    // Add closing brace
      () => JSON.parse(jsonStr + '"}'),   // Close string + object
      () => JSON.parse(jsonStr + '"]'),   // Close array
      () => JSON.parse(jsonStr + '"}]'),  // Close string + array + object
    ];

    for (const strategy of strategies) {
      try {
        return strategy();
      } catch {
        continue;
      }
    }

    return null;
  }
}
```

**Better Fix:** Use a streaming JSON parser library like `partial-json` or `json-stream`.

**Impact:** useObject fails to show progressive updates for complex structures. May show no data until complete.

---

### 6. DeepMerge Doesn't Handle Arrays Correctly

**File:** `src/react/use-object.ts:106-127`

**Problem:**
The `deepMerge` function replaces arrays entirely instead of merging them. This breaks progressive array building during streaming.

**Current Code:**
```typescript
function deepMerge(target: any, source: any): any {
  // ...
  if (Array.isArray(source)) {
    return source;  // ❌ Replaces entire array, losing previous items!
  }
  // ...
}
```

**Example:**
```typescript
// Stream 1: {"items": ["a", "b"]}
// Stream 2: {"items": ["a", "b", "c"]}
// Result: ["a", "b", "c"] ✅

// Stream 1: {"items": ["a", "b"]}
// Stream 2: {"items": []}  // Incomplete parse
// Result: [] ❌ Lost items!
```

**Fix:** Merge arrays intelligently:

```typescript
function deepMerge(target: any, source: any): any {
  if (typeof source !== 'object' || source === null) {
    return source;
  }

  if (Array.isArray(source)) {
    // Keep longer array
    if (Array.isArray(target)) {
      return source.length >= target.length ? source : target;
    }
    return source;
  }

  const result = { ...target };
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      result[key] = deepMerge(target[key], source[key]);
    }
  }
  return result;
}
```

**Impact:** Progressive array updates may lose data or flicker during streaming.

---

### 7. Schema Example Generation is Incomplete

**File:** `src/react/use-object.ts:445-492`

**Problem:**
The `getSchemaExample` and `generateExampleFromDescription` functions are incomplete stubs. They don't properly introspect Zod schemas to generate example structures for the AI.

**Current Code:**
```typescript
function getSchemaExample(schema: any): any {
  // ... simplified version - real implementation would need full Zod parsing.
  return {
    // Schema structure will be inferred  ❌ Not actually inferred!
  };
}
```

**Impact:** AI receives poor guidance about expected structure, leading to:
- Invalid JSON formats
- Missing required fields
- Wrong data types
- Failed validations

**Fix:** Implement proper Zod schema introspection:

```typescript
function getSchemaExample(schema: any): any {
  if (!schema?._def) return {};

  const def = schema._def;

  switch (def.typeName) {
    case 'ZodObject':
      const shape = def.shape();
      const example: any = {};
      for (const [key, value] of Object.entries(shape)) {
        example[key] = getSchemaExample(value);
      }
      return example;

    case 'ZodArray':
      return [getSchemaExample(def.type)];

    case 'ZodString':
      return 'string';

    case 'ZodNumber':
      return 0;

    case 'ZodBoolean':
      return false;

    case 'ZodEnum':
      return def.values[0];

    case 'ZodOptional':
    case 'ZodNullable':
      return getSchemaExample(def.innerType);

    default:
      return null;
  }
}
```

**Impact:** Lower quality structured outputs, more validation failures.

---

### 8. Missing Environment Variable Validation

**File:** Examples and documentation

**Problem:**
Examples use `process.env.OPENAI_API_KEY || ''` which silently fails with empty string if env var is missing. This leads to confusing API errors instead of clear "API key missing" errors.

**Current Code:**
```typescript
const backend = createOpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY || '',  // ❌ Empty string is invalid!
});
```

**Error (confusing):**
```
Error: Request failed with status 401
```

**Better Error:**
```
Error: OPENAI_API_KEY environment variable is not set
```

**Fix:**

```typescript
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error(
    'OPENAI_API_KEY environment variable is required.\n' +
    'Set it in your .env.local file:\n' +
    'NEXT_PUBLIC_OPENAI_API_KEY=sk-...'
  );
}

const backend = createOpenAIBackendAdapter({ apiKey });
```

**Impact:** Confusing error messages for new users.

---

### 9. Incomplete Abort Cleanup in useChat reload()

**File:** `src/react/use-chat.ts:373-393`

**Problem:**
The `reload()` function removes messages and calls `sendMessage()`, but doesn't abort any in-flight request first. If user clicks reload while a message is streaming, both old and new requests will run concurrently.

**Current Code:**
```typescript
const reload = useCallback(async () => {
  // ...
  setMessages(messages.slice(0, indexOfLastUser + 1));
  await sendMessage(lastUserMessage.content);  // ❌ Doesn't stop current request!
}, [messages, sendMessage]);
```

**Fix:**

```typescript
const reload = useCallback(async () => {
  // Stop any in-flight request first
  stop();  // ✅ Abort current stream

  if (messages.length === 0) return;

  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'user');

  if (!lastUserMessage) return;

  const indexOfLastUser = messages.findIndex((m) => m.id === lastUserMessage.id);
  setMessages(messages.slice(0, indexOfLastUser + 1));

  await sendMessage(lastUserMessage.content);
}, [messages, sendMessage, stop]);
```

**Impact:** Concurrent requests, wasted tokens, confusing UI with multiple responses appearing.

---

## Medium Priority Issues (🟡)

### 10. Missing crypto.randomUUID() Polyfill

**File:** `src/react/use-chat.ts:63`

**Problem:**
Comment says `crypto.randomUUID()` but code uses `Math.random()`. Also, `crypto.randomUUID()` isn't available in all environments (older browsers, Node < 19 without webcrypto).

**Current Code:**
```typescript
function toUIMessage(message: IRMessage, id?: string): UIMessage {
  return {
    id: id || crypto.randomUUID(),  // ❌ May not exist!
    // ...
  };
}
```

**Error in older browsers:**
```
ReferenceError: crypto is not defined
```

**Fix:** Use fallback:

```typescript
function generateId(): string {
  // Try crypto.randomUUID() first
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback to manual UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

**Impact:** Runtime errors in older browsers or Node environments.

---

### 11. Inconsistent ID Generation

**File:** `src/react/use-chat.ts:73`, `use-completion.ts:47`, `use-object.ts:51`

**Problem:**
Three different ID generation patterns:
- useChat: `msg-${Date.now()}-${Math.random()}`
- useCompletion: `completion-${Date.now()}-${Math.random()}`
- useObject: `object-${Date.now()}-${Math.random()}`

These can collide if called in the same millisecond (unlikely but possible).

**Better Approach:** Use a counter or UUID:

```typescript
let idCounter = 0;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}-${Math.random().toString(36).slice(2, 9)}`;
}
```

**Impact:** Low probability ID collisions in high-frequency usage.

---

### 12. Missing Loading State During Validation

**File:** `src/react/use-object.ts`

**Problem:**
When schema validation happens in `onFinish`, there's no indication to the user. If validation takes time (large objects, complex schemas), UI appears frozen.

**Current Code:**
```typescript
if (chunk.type === 'done') {
  // Final validation
  let finalObject = lastParsedObject;

  if (schema && finalObject) {
    try {
      finalObject = (schema as any).parse(finalObject);  // ❌ No loading indicator
    } catch (validationError) {
      // ...
    }
  }
}
```

**Fix:** Add validation status:

```typescript
// Add to return type
interface UseObjectHelpers<T> {
  // ...
  isValidating: boolean;  // ✅ New state
}

// Set during validation
setIsValidating(true);
try {
  finalObject = schema.parse(finalObject);
} finally {
  setIsValidating(false);
}
```

**Impact:** UI appears unresponsive during validation.

---

### 13. No Debouncing for Input Change Handlers

**File:** All examples (not in hook itself)

**Problem:**
Examples use `handleInputChange` without debouncing. For features like "search as you type" or "auto-save", this could cause performance issues.

**Note:** This is intentional design (hooks don't dictate UI patterns), but documentation should mention it.

**Documentation Addition Needed:**

```markdown
### Debouncing Inputs

For search-as-you-type or auto-save features, debounce input changes:

\`\`\`tsx
import { useMemo } from 'react';
import { debounce } from 'lodash';

function Chat() {
  const { input, setInput, handleSubmit } = useChat({ backend, model: 'gpt-4' });

  const debouncedSetInput = useMemo(
    () => debounce(setInput, 300),
    [setInput]
  );

  return (
    <input
      onChange={(e) => debouncedSetInput(e.target.value)}
      placeholder="Type to search..."
    />
  );
}
\`\`\`
```

**Impact:** Minor - just missing documentation.

---

## Low Priority / Documentation Issues (🔵)

### 14. Documentation Example Has Syntax Error

**File:** `docs/react-hooks.md:689`

**Problem:**
Example has unclosed string in CSS:

```tsx
borderRadius: '6px',
color: '#856404',  // ❌ Missing closing quote on next line
fontSize: '14px',
```

Actually looking at it, this appears correct. Let me recheck...

Actually the examples look fine on closer inspection. Withdrawing this issue.

---

### 15. Missing "Loading..." Text for Initial Render

**File:** Examples

**Problem:**
Examples don't show placeholder text while waiting for first message. This leaves empty screen.

**Better Example:**

```tsx
{messages.length === 0 && !isLoading && (
  <div className="empty-state">
    <p>No messages yet. Start a conversation!</p>
  </div>
)}

{messages.length === 0 && isLoading && (
  <div className="empty-state">
    <p>Thinking...</p>
  </div>
)}

{messages.map(m => (
  <MessageBubble key={m.id} message={m} />
))}
```

**Impact:** Minor - just UX polish.

---

## Missing Features / Opportunities

### 16. No File/Image Upload Support

**Gap:** Vercel AI SDK supports file attachments. ai.matey hooks don't.

**Future:** Add to UIMessage type:
```typescript
interface UIMessage {
  // ...
  attachments?: {
    type: 'image' | 'file';
    url: string;
    name: string;
  }[];
}
```

---

### 17. No Built-in Rate Limiting

**Gap:** No protection against rapid-fire requests that could exhaust API quotas.

**Future:** Add rate limiting option:
```typescript
interface UseChatOptions {
  // ...
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}
```

---

### 18. No Token Usage Tracking

**Gap:** Users can't see token consumption for cost management.

**Future:** Add to helpers:
```typescript
interface UseChatHelpers {
  // ...
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

## Summary of Fixes Needed

| Priority | Count | Fixes Needed |
|----------|-------|--------------|
| 🔴 Critical | 4 | Must fix before release |
| 🟠 High | 5 | Should fix before production use |
| 🟡 Medium | 4 | Fix in next minor version |
| 🔵 Low | 2 | Nice to have |

**Total:** 15 issues found

---

## Next Steps

1. **Fix Critical Issues (1-4)** - These break functionality
2. **Fix High Priority (5-9)** - These cause errors in common scenarios
3. **Consider Medium Priority (10-13)** - Edge cases and polish
4. **Document Low Priority (14-15)** - Minor UX improvements
5. **Plan Future Features (16-18)** - Next iteration

**Estimated Fix Time:** 2-3 hours for critical + high priority issues.

---

**Review Complete**
Found similar issues to OpenTelemetry review:
- Runtime checking patterns need work
- TypeScript typing issues
- State management edge cases
- Documentation accuracy

The implementation is solid overall, but needs these fixes before production use.
