# Summarizer API

The `window.ai.summarizer` API provides high-level functionality for generating summaries of text content. It abstracts away the complexities of prompt engineering while maintaining powerful summarization capabilities.

## Type Definitions

```typescript
interface SummarizerOptions extends SessionOptions {
  type?: "headline" | "tl;dr" | "key-points" | "teaser";
  length?: "short" | "medium" | "long";
  sharedContext?: string;
}

interface SummarizeOptions {
  type?: "headline" | "tl;dr" | "key-points" | "teaser";
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

## Core Functions

### capabilities()

Returns information about summarizer availability and parameters.

**Returns:** `Promise<AILanguageModelCapabilities>`

### create()

Creates a new summarizer session.

**Parameters:**

- `options?: SummarizerOptions` - Configuration for the summarizer

**Returns:** `Promise<SummarizerSession>`

## Session Methods

### summarize(text: string, options?: SummarizeOptions): Promise<string>

Generates a summary of the input text.

### summarizeStreaming(text: string, options?: SummarizeOptions): Promise<ReadableStream<string>>

Generates a streaming summary of the input text.

### destroy(): Promise<void>

Cleans up the summarizer session resources.

### clone(options?: SummarizerOptions): Promise<SummarizerSession>

Clones the current summarizer session.

## Getting Started

Check capabilities before creating a summarizer:

```javascript
const capabilities = await window.ai.summarizer.capabilities();
if (capabilities.available !== "no") {
  const summarizer = await ai.summarizer.create();
}
```

## Session Management

### Creating a Summarizer

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

### Session Information

```javascript
console.log(
  `${summarizer.tokensSoFar}/${summarizer.maxTokens} (${summarizer.tokensLeft} left)`
);
```

## Session Persistence and Cloning

```javascript
const clonedSummarizer = await summarizer.clone();
```

## Cleanup

Always destroy the session when done:

```javascript
await summarizer.destroy();
```

## Use Cases and Examples

### Meeting Transcript Summary

```javascript
const summarizer = await ai.summarizer.create({
  type: "minutes",
  sharedContext: "Weekly team meeting",
});
const summary = await summarizer.summarize(transcript, {
  context: "Engineering team standup from March 15, 2024",
});
```

### Article Title Generation

```javascript
const titleGenerator = await ai.summarizer.create({
  type: "headline",
  length: "short",
  systemPrompt: "You are a summarizer focused on headlines",
});
const title = await titleGenerator.summarize(articleContent);
```

### Product Review Summary

```javascript
const reviewSummarizer = await ai.summarizer.create({
  type: "review",
  sharedContext: "Customer reviews for Product X",
});
const summaries = await Promise.all(
  reviews.map((review) => reviewSummarizer.summarize(review))
);
```

## Error Handling

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
