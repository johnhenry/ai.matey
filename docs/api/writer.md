# Writer API

The `window.ai.writer` API provides sophisticated content generation capabilities. It helps create various types of content while maintaining consistent style, tone, and formatting.

## Type Definitions

```typescript
interface WriterOptions extends SessionOptions {
  tone?: "formal" | "casual" | "neutral";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
}

interface WriteOptions {
  tone?: "formal" | "casual" | "neutral";
  length?: "short" | "medium" | "long";
  context?: string;
}

interface WriterSession {
  tokensSoFar: number;
  maxTokens: number;
  get tokensLeft(): number;
  write(task: string, options?: WriteOptions): Promise<string>;
  writeStreaming(
    task: string,
    options?: WriteOptions
  ): Promise<ReadableStream<string>>;
  destroy(): Promise<void>;
  clone(options?: WriterOptions): Promise<WriterSession>;
}
```

## Core Functions

### capabilities()

Returns information about writer availability and parameters.

**Returns:** `Promise<AILanguageModelCapabilities>`

### create()

Creates a new writer session.

**Parameters:**

- `options?: WriterOptions` - Configuration for the writer

**Returns:** `Promise<WriterSession>`

## Session Methods

### write(task: string, options?: WriteOptions): Promise<string>

Generates text based on the given task description.

### writeStreaming(task: string, options?: WriteOptions): Promise<ReadableStream<string>>

Generates streaming text based on the given task description.

### destroy(): Promise<void>

Cleans up the writer session resources.

### clone(options?: WriterOptions): Promise<WriterSession>

Clones the current writer session.

## Getting Started

Check capabilities:

```javascript
const capabilities = await window.ai.writer.capabilities();
if (capabilities.available !== "no") {
  const writer = await ai.writer.create();
}
```

## Session Management

### Creating a Writer

Basic creation:

```javascript
const writer = await ai.writer.create();
```

With options:

```javascript
const writer = await ai.writer.create({
  tone: "professional",
  length: "medium",
  systemPrompt: "You are a writer focusing on professional tone",
});
```

### Session Information

```javascript
console.log(
  `${writer.tokensSoFar}/${writer.maxTokens} (${writer.tokensLeft} left)`
);
```

### Session Control

```javascript
const controller = new AbortController();
const writer = await ai.writer.create({
  signal: controller.signal,
});

// Abort if needed
controller.abort();
```

## Writing Methods

### Basic Writing

```javascript
const task = "Write a product description for our new AI-powered smartwatch";
const content = await writer.write(task, {
  context: "Marketing material for tech-savvy audience",
});
```

### Streaming Writing

```javascript
const stream = await writer.writeStreaming(task, {
  context: "Technical blog post",
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

## Use Cases and Examples

### Blog Post Generation

```javascript
const blogWriter = await ai.writer.create({
  tone: "conversational",
});
const post = await blogWriter.write(
  "Write about the future of AI in healthcare",
  { context: "Technology blog for general audience" }
);
```

### Social Media Content

```javascript
const socialWriter = await ai.writer.create({
  tone: "casual",
  length: "short",
});
const posts = await Promise.all([
  socialWriter.write("Announce new product feature X"),
  socialWriter.write("Share customer success story"),
  socialWriter.write("Promote upcoming webinar"),
]);
```

## Error Handling

```javascript
try {
  const content = await writer.write(prompt);
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Writing was aborted");
  } else {
    console.error("Writing failed:", error);
  }
}
```
