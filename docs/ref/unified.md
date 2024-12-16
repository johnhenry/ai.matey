Below is a revised version of the README with the four main API sections normalized. All original information has been retained. Additional details have been added to match the thoroughness and structure of the Language Model API section. Headings, type definitions, session management, and other details are aligned across all four APIs. No information has been removed; missing or inferred details have been filled in for consistency.

---

# window.ai API Documentation

This document provides comprehensive documentation for the window.ai APIs, which include the Language Model API, Summarizer API, Writer API, and Rewriter API. Each API is designed to provide specific functionality while maintaining consistent patterns, capabilities, and development practices across the platform.

## Table of Contents

1. [Language Model API (window.ai.languageModel)](#language-model-api)
2. [Summarizer API (window.ai.summarizer)](#summarizer-api)
3. [Writer API (window.ai.writer)](#writer-api)
4. [Rewriter API (window.ai.rewriter)](#rewriter-api)

## Add Support to Localhost

To access the Language Model API on localhost during the origin trial:

1. Update Chrome to the latest version
2. Open Chrome on Windows, Mac, or Linux
3. Go to `chrome://flags/#optimization-guide-on-device-model`
4. Select `Enabled BypassPerfRequirement`
5. Click Relaunch or restart Chrome
6. Visit `chrome://components` and check for updates to the `Optimization Guide` component

---

## Language Model API

The `window.ai.languageModel` API provides direct access to Chrome's built-in AI capabilities, specifically the Gemini Nano model. This low-level API allows for direct interaction with the language model for custom AI applications.

### Type Definitions

```typescript
interface AIConfig {
  endpoint?: string;
  credentials?: {
    apiKey: string;
    [key: string]: any;
  };
  model?: string;
}

interface AILanguageModelCapabilities {
  available: "no" | "readily" | "after-download";
  defaultTopK: number;
  maxTopK: number;
  defaultTemperature: number;
}

interface SessionOptions {
  temperature?: number; // Controls randomness in responses
  topK?: number; // Controls diversity of responses
  signal?: AbortSignal; // For cancelling operations
  systemPrompt?: string;
  initialPrompts?: Array<{ role: string; content: string }>;
  monitor?: (monitor: EventTarget) => void;
}

interface PromptOptions {
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
}

interface Session {
  tokensSoFar: number;
  maxTokens: number;
  get tokensLeft(): number;
  prompt(prompt: string, options?: PromptOptions): Promise<string>;
  promptStreaming(
    prompt: string,
    options?: PromptOptions
  ): Promise<ReadableStream<string>>;
  destroy(): Promise<void>;
  clone(options?: SessionOptions): Promise<Session>;
}
```

### Core Functions

#### capabilities()

Returns information about model availability and parameters.

**Returns:** `Promise<AILanguageModelCapabilities>`

```typescript
const capabilities = await window.ai.languageModel.capabilities();
```

#### create()

Creates a new language model session.

**Parameters:**

- `options?: SessionOptions` - Configuration for the session

**Returns:** `Promise<Session>`

```typescript
const session = await window.ai.languageModel.create({
  temperature: 0.7,
  topK: 40,
  systemPrompt: "You are a helpful assistant",
});
```

### Session Methods

#### prompt(prompt: string, options?: PromptOptions): Promise<string>

Sends a prompt to the model and receives a complete response.

#### promptStreaming(prompt: string, options?: PromptOptions): Promise<ReadableStream<string>>

Sends a prompt and receives a streaming response.

#### destroy(): Promise<void>

Cleans up the session resources.

#### clone(options?: SessionOptions): Promise<Session>

Clones the current session, potentially preserving its context and configuration.

### Model Availability and Download

Check model availability using `capabilities()`:

```javascript
const { available, defaultTemperature, defaultTopK, maxTopK } =
  await window.ai.languageModel.capabilities();
```

- "no": API supported but currently unusable
- "readily": API supported and immediately usable
- "after-download": API supported but requires model download

Monitor download progress when needed:

```javascript
const session = await window.ai.languageModel.create({
  monitor(m) {
    m.addEventListener("downloadprogress", (e) => {
      console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
    });
  },
});
```

### Session Management

#### Creating Sessions

Basic session creation:

```javascript
const session = await window.ai.languageModel.create();
```

With custom options:

```javascript
const session = await window.ai.languageModel.create({
  temperature: 1.2,
  topK: 3,
  systemPrompt: "You are a helpful and friendly assistant.",
  initialPrompts: [
    { role: "system", content: "Previous context here" },
    { role: "user", content: "Previous user message" },
    { role: "assistant", content: "Previous response" },
  ],
});
```

#### Session Information

Monitor token usage:

```javascript
console.log(
  `${session.tokensSoFar}/${session.maxTokens} (${session.tokensLeft} left)`
);
```

Limits:

- Per prompt: 1,024 tokens
- Session context: 4,096 tokens

#### Session Control

Abort a session with an AbortSignal:

```javascript
const controller = new AbortController();
const session = await window.ai.languageModel.create({
  signal: controller.signal,
});

// Later, to abort:
controller.abort();
```

### Prompting the Model

#### Non-streaming Output

```javascript
const result = await session.prompt("What is the capital of France?");
console.log(result); // "The capital of France is Paris."
```

#### Streaming Output

```javascript
const stream = await session.promptStreaming(
  "Write a story about space exploration."
);
for await (const chunk of stream) {
  console.log(chunk);
}
```

### Session Persistence and Cloning

Clone a session to preserve resources and state:

```javascript
const clonedSession = await session.clone();
```

### Cleanup

Always destroy sessions when done:

```javascript
await session.destroy();
```

---

## Summarizer API

The `window.ai.summarizer` API provides high-level functionality for generating summaries of text content. It abstracts away the complexities of prompt engineering while maintaining powerful summarization capabilities.

### Type Definitions

```typescript
interface SummarizerOptions extends SessionOptions {
  type?:
    | "headline"
    | "tl;dr"
    | "key-points"
    | "teaser"
    | "technical"
    | "casual"
    | "minutes"
    | "review";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
}

interface SummarizeOptions {
  type?:
    | "headline"
    | "tl;dr"
    | "key-points"
    | "teaser"
    | "technical"
    | "casual"
    | "minutes"
    | "review";
  length?: "short" | "medium" | "long";
  context?: string;
}

interface SummarizerSession {
  tokensSoFar: number;
  maxTokens: number;
  get tokensLeft(): number;
  summarize(text: string, options?: SummarizeOptions): Promise<string>;
  summarizeStreaming(
    text: string,
    options?: SummarizeOptions
  ): Promise<ReadableStream<string>>;
  destroy(): Promise<void>;
  clone(options?: SummarizerOptions): Promise<SummarizerSession>;
}
```

### Core Functions

#### capabilities()

Returns information about summarizer availability and parameters.

**Returns:** `Promise<AILanguageModelCapabilities>`

#### create()

Creates a new summarizer session.

**Parameters:**

- `options?: SummarizerOptions` - Configuration for the summarizer

**Returns:** `Promise<SummarizerSession>`

### Session Methods

#### summarize(text: string, options?: SummarizeOptions): Promise<string>

Generates a summary of the input text.

#### summarizeStreaming(text: string, options?: SummarizeOptions): Promise<ReadableStream<string>>

Generates a streaming summary of the input text.

#### destroy(): Promise<void>

Cleans up the summarizer session resources.

#### clone(options?: SummarizerOptions): Promise<SummarizerSession>

Clones the current summarizer session.

### Getting Started

Check capabilities before creating a summarizer:

```javascript
const capabilities = await window.ai.summarizer.capabilities();
if (capabilities.available !== "no") {
  const summarizer = await ai.summarizer.create();
}
```

### Session Management

#### Creating a Summarizer

Basic creation:

```javascript
const summarizer = await ai.summarizer.create();
```

With options:

```javascript
const summarizer = await ai.summarizer.create({
  sharedContext: "Technical documentation from a software project",
  type: "technical",
  length: "medium",
  systemPrompt: "You are a helpful summarizer",
});
```

#### Session Information

```javascript
console.log(
  `${summarizer.tokensSoFar}/${summarizer.maxTokens} (${summarizer.tokensLeft} left)`
);
```

#### Session Control

Use an AbortSignal if needed:

```javascript
const controller = new AbortController();
const summarizer = await ai.summarizer.create({
  signal: controller.signal,
});
```

Abort later if required:

```javascript
controller.abort();
```

### Summarization Methods

#### Basic Summarization

```javascript
const text = "Long article content here...";
const summary = await summarizer.summarize(text, {
  context: "This is a research paper from 2024",
});
```

#### Streaming Summarization

```javascript
const stream = await summarizer.summarizeStreaming(text, {
  context: "Breaking news article from today",
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

### Session Persistence and Cloning

```javascript
const clonedSummarizer = await summarizer.clone();
```

### Cleanup

Always destroy the session when done:

```javascript
await summarizer.destroy();
```

### Use Cases and Examples

**Meeting Transcript Summary:**

```javascript
const summarizer = await ai.summarizer.create({
  type: "minutes",
  sharedContext: "Weekly team meeting",
});
const summary = await summarizer.summarize(transcript, {
  context: "Engineering team standup from March 15, 2024",
});
```

**Article Title Generation:**

```javascript
const titleGenerator = await ai.summarizer.create({
  type: "headline",
  length: "short",
  systemPrompt: "You are a summarizer focused on headlines",
});
const title = await titleGenerator.summarize(articleContent);
```

**Product Review Summary:**

```javascript
const reviewSummarizer = await ai.summarizer.create({
  type: "review",
  sharedContext: "Customer reviews for Product X",
});
const summaries = await Promise.all(
  reviews.map((review) => reviewSummarizer.summarize(review))
);
```

### Error Handling

```javascript
try {
  const summary = await summarizer.summarize(text);
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Summarization was aborted");
  } else {
    console.error("Summarization failed:", error);
  }
}
```

---

## Writer API

The `window.ai.writer` API provides sophisticated content generation capabilities. It helps create various types of content while maintaining consistent style, tone, and formatting.

### Type Definitions

```typescript
interface WriterOptions extends SessionOptions {
  tone?:
    | "formal"
    | "casual"
    | "neutral"
    | "professional"
    | "technical"
    | "conversational";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
}

interface WriteOptions {
  tone?:
    | "formal"
    | "casual"
    | "neutral"
    | "professional"
    | "technical"
    | "conversational";
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

### Core Functions

#### capabilities()

Returns information about writer availability and parameters.

**Returns:** `Promise<AILanguageModelCapabilities>`

#### create()

Creates a new writer session.

**Parameters:**

- `options?: WriterOptions` - Configuration for the writer

**Returns:** `Promise<WriterSession>`

### Session Methods

#### write(task: string, options?: WriteOptions): Promise<string>

Generates text based on the given task description.

#### writeStreaming(task: string, options?: WriteOptions): Promise<ReadableStream<string>>

Generates streaming text based on the given task description.

#### destroy(): Promise<void>

Cleans up the writer session resources.

#### clone(options?: WriterOptions): Promise<WriterSession>

Clones the current writer session.

### Getting Started

Check capabilities:

```javascript
const capabilities = await window.ai.writer.capabilities();
if (capabilities.available !== "no") {
  const writer = await ai.writer.create();
}
```

### Session Management

#### Creating a Writer

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

#### Session Information

```javascript
console.log(
  `${writer.tokensSoFar}/${writer.maxTokens} (${writer.tokensLeft} left)`
);
```

#### Session Control

```javascript
const controller = new AbortController();
const writer = await ai.writer.create({
  signal: controller.signal,
});

// Abort if needed
controller.abort();
```

### Writing Methods

#### Basic Writing

```javascript
const prompt = "Write a product description for a new smartphone";
const content = await writer.write(prompt, {
  context: "High-end smartphone market, targeting tech enthusiasts",
});
```

#### Streaming Writing

```javascript
const prompt = "Write a technical blog post about machine learning";
const stream = await writer.writeStreaming(prompt, {
  context: "Technical blog post",
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

### Session Persistence and Cloning

```javascript
const clonedWriter = await writer.clone();
```

### Cleanup

```javascript
await writer.destroy();
```

### Use Cases and Examples

**Technical Documentation:**

```javascript
const docWriter = await ai.writer.create({
  tone: "technical",
});
const docs = await docWriter.write(
  "Document the authentication API endpoints",
  { context: "RESTful API documentation" }
);
```

**Blog Post Generation:**

```javascript
const blogWriter = await ai.writer.create({
  tone: "conversational",
});
const post = await blogWriter.write(
  "Write about the future of AI in healthcare",
  { context: "Technology blog for general audience" }
);
```

**Social Media Content:**

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

### Error Handling

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

---

## Rewriter API

The `window.ai.rewriter` API provides sophisticated text transformation capabilities. It helps modify existing content while maintaining meaning, improving quality, or adjusting tone and complexity.

### Type Definitions

```typescript
interface ReWriterOptions extends SessionOptions {
  tone?: "formal" | "casual" | "neutral" | "professional";
  goal?: "simplify" | "formalize" | "constructive" | "improve";
  sharedContext?: string;
}

interface ReWriteOptions {
  tone?: "formal" | "casual" | "neutral" | "professional";
  goal?: "simplify" | "formalize" | "constructive" | "improve";
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

### Core Functions

#### capabilities()

Returns information about rewriter availability and parameters.

**Returns:** `Promise<AILanguageModelCapabilities>`

#### create()

Creates a new rewriter session.

**Parameters:**

- `options?: ReWriterOptions` - Configuration for the rewriter

**Returns:** `Promise<ReWriterSession>`

### Session Methods

#### rewrite(text: string, options?: ReWriteOptions): Promise<string>

Rewrites the input text according to the specified tone and goal.

#### rewriteStreaming(text: string, options?: ReWriteOptions): Promise<ReadableStream<string>>

Rewrites the input text and returns it as a streaming response.

#### destroy(): Promise<void>

Cleans up the rewriter session resources.

#### clone(options?: ReWriterOptions): Promise<ReWriterSession>

Clones the current rewriter session.

### Getting Started

Check capabilities:

```javascript
const capabilities = await window.ai.rewriter.capabilities();
if (capabilities.available !== "no") {
  const rewriter = await ai.rewriter.create();
}
```

### Session Management

#### Creating a Rewriter

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

#### Session Information

```javascript
console.log(
  `${rewriter.tokensSoFar}/${rewriter.maxTokens} (${rewriter.tokensLeft} left)`
);
```

#### Session Control

```javascript
const controller = new AbortController();
const rewriter = await ai.rewriter.create({
  signal: controller.signal,
});

// Abort if needed
controller.abort();
```

### Rewriting Methods

#### Basic Rewriting

```javascript
const text = "Original content here...";
const rewritten = await rewriter.rewrite(text, {
  context: "Make more formal for business audience",
});
```

#### Streaming Rewriting

```javascript
const stream = await rewriter.rewriteStreaming(text, {
  context: "Simplify for general audience",
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

### Session Persistence and Cloning

```javascript
const clonedRewriter = await rewriter.clone();
```

### Cleanup

```javascript
await rewriter.destroy();
```

### Use Cases and Examples

**Tone Adjustment:**

```javascript
const formalizer = await ai.rewriter.create({
  tone: "formal",
});
const formal = await formalizer.rewrite(casualEmail, {
  context: "Business communication to client",
});
```

**Content Simplification:**

```javascript
const simplifier = await ai.rewriter.create({});
const simplified = await simplifier.rewrite(technicalContent, {
  context: "Explain like I'm 5",
});
```

**Word Count Optimization:**

```javascript
const optimizer = await ai.rewriter.create({});
const optimized = await optimizer.rewrite(longContent, {
  context: "Reduce to 500 words while maintaining key points",
});
```

### Error Handling

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

---

## Implementation Notes

All APIs in the window.ai platform share these characteristics:

- Support for capability checking before use
- Consistent error handling patterns
- Both synchronous and streaming output options
- Abort signal support for cancellation
- Context preservation where appropriate
- Session management (creation, cloning, destroying) to handle resources effectively

### Privacy and Security

- All APIs support local processing for sensitive data
- No guarantee of data privacy unless explicitly specified
- Implementation-specific security measures apply
- Potential fingerprinting considerations through capabilities APIs

### Performance Considerations

- Local processing provides faster results
- Streaming support for long-form content
- Resource management through session handling
- Automatic cleanup of unused resources

### Best Practices

1. Always check capabilities before creating instances
2. Use streaming for long-form content
3. Properly handle errors and aborts
4. Clean up resources when done
5. Provide clear context for better results
