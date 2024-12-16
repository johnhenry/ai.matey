# Rewriter API

The `window.ai.rewriter` API provides sophisticated text transformation capabilities. It helps modify existing content while maintaining meaning, improving quality, or adjusting tone and complexity.

## Type Definitions

```typescript
interface ReWriterOptions extends SessionOptions {
  tone?: "formal" | "casual" | "neutral";
  format?: "as-is";
  "plain-text";
  markdown;
  length?: "as-is";
  shorter;
  longer;
  sharedContext?: string;
}

interface ReWriteOptions {
  tone?: "formal" | "casual" | "neutral";
  format?: "as-is";
  "plain-text";
  markdown;
  length?: "as-is";
  shorter;
  longer;
  context?: string;
}

interface ReWriterSession {
  tokensSoFar: number;
  maxTokens: number;
  get tokensLeft(): number;
  rewrite(text: string, options?: ReWriteOptions): Promise<string>;
  rewriteStreaming(
    text: string,
    options?: ReWriteOptions
  ): Promise<ReadableStream<string>>;
  destroy(): Promise<void>;
  clone(options?: ReWriterOptions): Promise<ReWriterSession>;
}
```

## Core Functions

### capabilities()

Returns information about rewriter availability and parameters.

**Returns:** `Promise<AILanguageModelCapabilities>`

### create()

Creates a new rewriter session.

**Parameters:**

- `options?: ReWriterOptions` - Configuration for the rewriter

**Returns:** `Promise<ReWriterSession>`

## Session Methods

### rewrite(text: string, options?: ReWriteOptions): Promise<string>

Rewrites the input text according to the specified tone and goal.

### rewriteStreaming(text: string, options?: ReWriteOptions): Promise<ReadableStream<string>>

Rewrites the input text and returns it as a streaming response.

### destroy(): Promise<void>

Cleans up the rewriter session resources.

### clone(options?: ReWriterOptions): Promise<ReWriterSession>

Clones the current rewriter session.

## Getting Started

Check capabilities:

```javascript
const capabilities = await window.ai.rewriter.capabilities();
if (capabilities.available !== "no") {
  const rewriter = await ai.rewriter.create();
}
```

## Session Management

### Creating a Rewriter

Basic creation:

```javascript
const rewriter = await ai.rewriter.create();
```

With options:

```javascript
const rewriter = await ai.rewriter.create({
  tone: "professional",
  goal: "formalize",
  systemPrompt:
    "You are a rewriter focused on producing professional, formal text",
});
```

### Session Information

```javascript
console.log(
  `${rewriter.tokensSoFar}/${rewriter.maxTokens} (${rewriter.tokensLeft} left)`
);
```

### Session Control

```javascript
const controller = new AbortController();
const rewriter = await ai.rewriter.create({
  signal: controller.signal,
});

// Abort if needed
controller.abort();
```

## Rewriting Methods

### Basic Rewriting

```javascript
const text = "Original content here...";
const rewritten = await rewriter.rewrite(text, {
  context: "Make more formal for business audience",
});
```

### Streaming Rewriting

```javascript
const stream = await rewriter.rewriteStreaming(text, {
  context: "Simplify for general audience",
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

## Session Persistence and Cloning

```javascript
const clonedRewriter = await rewriter.clone();
```

## Cleanup

```javascript
await rewriter.destroy();
```

## Use Cases and Examples

### Tone Adjustment

```javascript
const formalizer = await ai.rewriter.create({
  tone: "formal",
});
const formal = await formalizer.rewrite(casualEmail, {
  context: "Business communication to client",
});
```

### Content Simplification

```javascript
const simplifier = await ai.rewriter.create({});
const simplified = await simplifier.rewrite(technicalContent, {
  context: "Explain like I'm 5",
});
```

### Word Count Optimization

```javascript
const optimizer = await ai.rewriter.create({});
const optimized = await optimizer.rewrite(longContent, {
  context: "Reduce to 500 words while maintaining key points",
});
```

## Error Handling

```javascript
try {
  const rewritten = await rewriter.rewrite(text);
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Rewriting was aborted");
  } else {
    console.error("Rewriting failed:", error);
  }
}
```
