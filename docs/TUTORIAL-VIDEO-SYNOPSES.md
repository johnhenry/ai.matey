# ai.matey.universal Tutorial Video Synopses

**Date:** October 26, 2025
**Purpose:** Detailed synopses for external video production
**Total Videos:** 35+

---

## Getting Started Series (5 videos)

### 1. Introduction to ai.matey.universal
**Duration:** 8-10 minutes
**Target Audience:** Developers new to ai.matey
**Difficulty:** Beginner

**Learning Objectives:**
- Understand what ai.matey.universal is and why it exists
- Learn the core value proposition (unified API, provider independence)
- See the problem it solves (vendor lock-in, API fragmentation)

**Script Outline:**
1. Opening: "The Problem with AI APIs Today" (2 min)
   - Show fragmented landscape (OpenAI, Anthropic, Google, etc.)
   - Each has different API formats, authentication, error handling
   - Switching providers = rewriting code

2. "Enter ai.matey.universal" (3 min)
   - Unified intermediate representation (IR)
   - Write once, run on any provider
   - Automatic fallbacks, cost optimization, routing

3. Quick Demo (3 min)
   - Install: `npm install ai.matey.universal`
   - Simple example: Send same request to OpenAI and Anthropic
   - Show how easy it is to switch providers

4. What You'll Learn (1 min)
   - Preview of upcoming tutorials
   - Architecture overview diagram

**Code Examples:**
```typescript
// Before ai.matey (fragmented)
const openaiResponse = await openai.chat.completions.create({...});
const anthropicResponse = await anthropic.messages.create({...});

// After ai.matey (unified)
const bridge = new Bridge(openaiAdapter, anthropicAdapter);
const response = await bridge.execute(request);
```

**Visual Aids:**
- Animated diagram: Multiple AI providers → ai.matey → Your app
- Side-by-side code comparison
- Architecture diagram showing IR at center

---

### 2. Installation and Setup (Complete Guide)
**Duration:** 6-8 minutes
**Target Audience:** Developers ready to get started
**Difficulty:** Beginner

**Learning Objectives:**
- Install ai.matey.universal
- Set up API keys securely
- Create first Bridge
- Run first AI request

**Script Outline:**
1. Installation (2 min)
   - npm/pnpm/yarn commands
   - Verify installation
   - Check supported Node.js versions (18+)

2. Environment Setup (2 min)
   - Creating .env file
   - Adding API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY)
   - Security best practices
   - Never commit API keys to git

3. First Bridge (2 min)
   - Import statement
   - Create adapters (OpenAI, Anthropic)
   - Initialize Bridge
   - Basic configuration

4. First Request (2 min)
   - Create IR request
   - Execute through Bridge
   - Handle response
   - Error handling basics

**Code Examples:**
```bash
npm install ai.matey.universal dotenv
```

```typescript
import { Bridge, OpenAIBackendAdapter, AnthropicBackendAdapter } from 'ai.matey.universal';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAIBackendAdapter({
  apiKey: process.env.OPENAI_API_KEY!,
});

const anthropic = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const bridge = new Bridge(openai, anthropic, {
  defaultBackend: 'openai',
});

const request = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello!' }] }],
  parameters: { model: 'gpt-4', temperature: 0.7, maxTokens: 100 },
  metadata: { requestId: 'demo-1', timestamp: Date.now() },
};

const response = await bridge.execute(request);
console.log(response.message.content);
```

**Visual Aids:**
- Screen recording of terminal commands
- VSCode setup walkthrough
- .env file structure diagram

---

### 3. Understanding the IR (Intermediate Representation)
**Duration:** 10-12 minutes
**Target Audience:** Developers wanting to understand core concepts
**Difficulty:** Beginner-Intermediate

**Learning Objectives:**
- Understand IR structure and purpose
- Learn message format (role, content)
- Understand parameters vs metadata
- See how IR maps to different providers

**Script Outline:**
1. Why IR? (2 min)
   - Problem: Each provider has different API
   - Solution: Common representation that works everywhere
   - Benefits: Write once, run anywhere

2. IR Request Structure (3 min)
   - Messages array (role, content)
   - Parameters (model, temperature, maxTokens)
   - Metadata (requestId, timestamp, custom fields)
   - Tools/function calling

3. IR Response Structure (2 min)
   - Message (role: assistant, content)
   - Usage (tokens)
   - Metadata (provenance, timing)

4. Provider Mapping (3 min)
   - Show how same IR becomes OpenAI format
   - Show how same IR becomes Anthropic format
   - Adapter's job: IR ↔ Provider format

5. Content Types (2 min)
   - Text content
   - Image content (for vision models)
   - Tool use/results

**Code Examples:**
```typescript
// IR Request
const request: IRChatRequest = {
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'What is TypeScript?' }] },
  ],
  parameters: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 200,
    topP: 0.9,
  },
  metadata: {
    requestId: 'req-123',
    timestamp: Date.now(),
    custom: {
      userId: 'user-456',
      sessionId: 'session-789',
    },
  },
};

// IR Response
const response: IRChatResponse = {
  message: {
    role: 'assistant',
    content: [{ type: 'text', text: 'TypeScript is a typed superset...' }],
  },
  usage: {
    inputTokens: 12,
    outputTokens: 45,
    totalTokens: 57,
  },
  metadata: {
    requestId: 'req-123',
    timestamp: Date.now(),
    provenance: {
      backend: 'openai',
      model: 'gpt-4-0613',
      adaptedAt: Date.now(),
    },
  },
};
```

**Visual Aids:**
- Animated diagram showing IR in center, providers on sides
- Side-by-side comparison: IR vs OpenAI vs Anthropic formats
- Data flow diagram: Request → IR → Adapter → Provider → Response

---

### 4. Your First Chat Application
**Duration:** 12-15 minutes
**Target Audience:** Developers ready to build
**Difficulty:** Beginner

**Learning Objectives:**
- Build complete chat application from scratch
- Handle user input
- Display AI responses
- Add basic error handling

**Script Outline:**
1. Project Setup (2 min)
   - Create new project
   - Install dependencies
   - Set up TypeScript

2. Basic CLI Chat (5 min)
   - readline for user input
   - Send messages to Bridge
   - Display responses
   - Exit handling

3. Conversation Context (3 min)
   - Maintain message history
   - Include previous messages in requests
   - Memory management (token limits)

4. Error Handling (2 min)
   - Try-catch blocks
   - Handle network errors
   - Handle API errors
   - User-friendly messages

5. Enhancements (3 min)
   - Add typing indicator
   - Format markdown responses
   - Save conversation history

**Code Examples:**
Full working CLI chat application (~100 lines)

**Visual Aids:**
- Split screen: Code editor + running terminal
- Demonstration of chat interaction
- Error scenarios and handling

---

### 5. Working with Multiple Providers
**Duration:** 8-10 minutes
**Target Audience:** Developers wanting provider flexibility
**Difficulty:** Beginner-Intermediate

**Learning Objectives:**
- Register multiple backends
- Switch between providers
- Use explicit backend selection
- Understand provider availability

**Script Outline:**
1. Why Multiple Providers? (2 min)
   - Redundancy (if one is down)
   - Cost optimization (use cheaper for simple tasks)
   - Model specialization (GPT-4 for code, Claude for writing)

2. Registering Backends (2 min)
   - Create multiple adapters
   - Pass to Bridge constructor
   - Named backends

3. Explicit Backend Selection (2 min)
   - Use `backend: 'openai'` in metadata
   - When to use explicit selection
   - Override default backend

4. Checking Availability (2 min)
   - `bridge.isBackendAvailable()`
   - Health checks
   - Fallback strategies

5. Demo: Multi-Provider App (2 min)
   - Let user choose provider
   - Show response times
   - Compare outputs

**Code Examples:**
```typescript
const openai = new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! });
const anthropic = new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! });
const google = new GeminiBackendAdapter({ apiKey: process.env.GOOGLE_API_KEY! });

const bridge = new Bridge(openai, anthropic, google, {
  defaultBackend: 'openai',
  fallbackStrategy: 'sequential',
});

// Explicit selection
const request = {
  messages: [...],
  parameters: { model: 'gpt-4' },
  metadata: {
    requestId: 'test-1',
    timestamp: Date.now(),
    custom: { backend: 'anthropic' }, // Use Anthropic instead of default
  },
};
```

**Visual Aids:**
- Diagram of Bridge with multiple backends
- Flowchart showing backend selection logic
- Demo comparing provider responses

---

## Core Features Series (10 videos)

### 6. Understanding Bridges vs Routers
**Duration:** 10-12 minutes
**Target Audience:** Intermediate developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Understand Bridge (frontend-to-backend)
- Understand Router (backend-only routing)
- Know when to use each
- See practical examples

**Script Outline:**
1. The Two Routing Layers (3 min)
   - Bridge: Frontend adapter → Backend adapter
   - Router: Multiple backend adapters only
   - Why have both?

2. Bridge Deep Dive (3 min)
   - Frontend normalization
   - Backend selection
   - Response transformation
   - Use case: Multi-frontend app

3. Router Deep Dive (3 min)
   - Backend-only routing
   - Optimization strategies
   - Fallback handling
   - Use case: Backend service

4. When to Use What (2 min)
   - Use Bridge: Different frontends (OpenAI SDK, Anthropic SDK)
   - Use Router: Single IR source, multiple backends
   - Can combine both

5. Comparison Demo (2 min)
   - Same task with Bridge
   - Same task with Router
   - Show code differences

**Code Examples:**
```typescript
// Bridge Example (Frontend + Backend)
const bridge = new Bridge(
  new OpenAIFrontendAdapter(), // Accept OpenAI SDK format
  new AnthropicBackendAdapter() // Send to Anthropic
);

// Router Example (Backend-only)
const router = new Router({
  optimization: 'cost',
  fallbackStrategy: 'sequential',
});
router
  .register('openai', new OpenAIBackendAdapter())
  .register('anthropic', new AnthropicBackendAdapter());
```

**Visual Aids:**
- Architecture diagrams for Bridge vs Router
- Request flow animations
- Decision tree: Which to use?

---

### 7. Streaming Responses
**Duration:** 12-15 minutes
**Target Audience:** Developers building real-time UIs
**Difficulty:** Intermediate

**Learning Objectives:**
- Enable streaming mode
- Handle stream chunks
- Build real-time UI
- Handle stream errors

**Script Outline:**
1. Why Streaming? (2 min)
   - Better UX (see response immediately)
   - Perception of speed
   - Long responses don't timeout

2. Enable Streaming (2 min)
   - Set `stream: true` in parameters
   - Check backend support
   - Response type changes to AsyncIterable

3. Consuming Streams (4 min)
   - for await...of loop
   - Process chunks
   - Concatenate text
   - Update UI progressively

4. Stream Error Handling (2 min)
   - Try-catch around loop
   - Partial response handling
   - Connection loss scenarios

5. CLI Streaming Demo (3 min)
   - Build streaming CLI chat
   - Character-by-character display
   - Handle interrupts (Ctrl+C)

6. Web Streaming Demo (2 min)
   - Server-Sent Events (SSE)
   - Update React component
   - Cancel stream button

**Code Examples:**
```typescript
const request: IRChatRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Write a story' }] }],
  parameters: {
    model: 'gpt-4',
    temperature: 0.8,
    maxTokens: 500,
    stream: true, // Enable streaming
  },
  metadata: { requestId: 'stream-1', timestamp: Date.now() },
};

const stream = await bridge.execute(request);

for await (const chunk of stream) {
  if (chunk.type === 'delta' && chunk.delta.content) {
    for (const content of chunk.delta.content) {
      if (content.type === 'text') {
        process.stdout.write(content.text);
      }
    }
  }
}
```

**Visual Aids:**
- Animation showing streaming vs non-streaming
- Split screen: Code + live streaming output
- Network waterfall showing chunked responses

---

### 8. Automatic Fallbacks
**Duration:** 10-12 minutes
**Target Audience:** Developers building resilient apps
**Difficulty:** Intermediate

**Learning Objectives:**
- Configure fallback strategies
- Handle provider failures gracefully
- Monitor fallback behavior
- Test fallback scenarios

**Script Outline:**
1. Why Fallbacks Matter (2 min)
   - Providers go down (happens to all of them)
   - Rate limits
   - Regional outages
   - Cost of downtime

2. Fallback Strategies (3 min)
   - `none`: No fallback (fail fast)
   - `sequential`: Try each backend in order
   - `parallel`: Try all simultaneously (first wins)
   - `prioritized`: Try preferred first, then others

3. Configuration (2 min)
   - Set in Bridge/Router config
   - Backend registration order matters
   - Max retry attempts
   - Timeout settings

4. Monitoring Fallbacks (2 min)
   - Check response metadata
   - Log which backend succeeded
   - Track fallback rates
   - Alert on high fallback rates

5. Demo: Simulated Failure (3 min)
   - Mock backend that fails
   - Show fallback in action
   - Log output showing retry logic
   - Success with second backend

**Code Examples:**
```typescript
const router = new Router({
  fallbackStrategy: 'sequential',
  maxRetries: 3,
  retryDelay: 1000, // ms
});

router
  .register('primary', primaryBackend)
  .register('secondary', secondaryBackend)
  .register('tertiary', tertiaryBackend);

const response = await router.execute(request);

// Check which backend was used
console.log('Used backend:', response.metadata.provenance?.backend);
console.log('Attempts:', response.metadata.custom?.attempts);
```

**Visual Aids:**
- Flowchart showing fallback decision tree
- Timeline showing sequential vs parallel fallback
- Demo with simulated failures

---

### 9. Middleware Deep Dive
**Duration:** 15-18 minutes
**Target Audience:** Advanced developers
**Difficulty:** Advanced

**Learning Objectives:**
- Understand middleware pipeline
- Create custom middleware
- Use built-in middleware
- Compose middleware

**Script Outline:**
1. What is Middleware? (3 min)
   - Request/response interceptors
   - Transform, log, cache, validate
   - Pipeline execution model
   - Order matters

2. Built-in Middleware (4 min)
   - Logging middleware (request/response logging)
   - Cost tracking (token usage, pricing)
   - Rate limiting (prevent quota exhaustion)
   - Caching (avoid duplicate requests)
   - Telemetry (OpenTelemetry integration)

3. Creating Custom Middleware (4 min)
   - Middleware interface
   - processRequest method
   - processResponse method
   - Error handling
   - State management

4. Middleware Composition (2 min)
   - Add to Bridge/Router
   - Execution order
   - Short-circuiting

5. Real Examples (4 min)
   - Content filtering middleware (PII removal)
   - Response caching middleware
   - Custom logging middleware
   - Request validation middleware

**Code Examples:**
```typescript
import type { Middleware, IRChatRequest, IRChatResponse } from 'ai.matey.universal';

class ContentFilterMiddleware implements Middleware {
  name = 'content-filter';

  async processRequest(request: IRChatRequest): Promise<IRChatRequest> {
    // Remove PII from request
    const filtered = { ...request };
    // ... filtering logic
    return filtered;
  }

  async processResponse(response: IRChatResponse): Promise<IRChatResponse> {
    // Filter PII from response
    const filtered = { ...response };
    // ... filtering logic
    return filtered;
  }
}

const bridge = new Bridge(frontend, backend, {
  middleware: [
    new LoggingMiddleware(),
    new ContentFilterMiddleware(),
    new CostTrackingMiddleware(),
  ],
});
```

**Visual Aids:**
- Pipeline diagram showing middleware flow
- Animated execution showing order
- Code walkthrough with debugging

---

### 10. Cost Tracking and Optimization
**Duration:** 12-15 minutes
**Target Audience:** Developers managing AI costs
**Difficulty:** Intermediate

**Learning Objectives:**
- Track token usage and costs
- Set budget limits
- Optimize for cost
- Analyze spending patterns

**Script Outline:**
1. Why Cost Matters (2 min)
   - AI APIs can be expensive
   - Costs scale with usage
   - Token-based pricing varies wildly
   - Need visibility and control

2. Token Usage Tracking (3 min)
   - Usage in response metadata
   - Input vs output tokens
   - Total cost calculation
   - Provider pricing differences

3. Cost Tracking Middleware (3 min)
   - Enable cost tracking
   - Aggregate costs
   - Per-user tracking
   - Export to analytics

4. Cost Optimization Strategies (3 min)
   - Use cheaper models for simple tasks
   - Capability-based routing with cost priority
   - Caching responses
   - Shorter context windows
   - Lower temperature (less tokens)

5. Budget Limits (2 min)
   - Set spending caps
   - Alert on threshold
   - Reject requests over budget
   - Monthly rollover

6. Cost Dashboard Demo (2 min)
   - Real-time cost monitoring
   - Cost breakdown by model
   - Cost trends over time
   - Cost per user

**Code Examples:**
```typescript
import { Router, CostTrackingMiddleware } from 'ai.matey.universal';

const costTracker = new CostTrackingMiddleware({
  budget: {
    daily: 100, // $100/day
    monthly: 2000, // $2000/month
  },
  onBudgetExceeded: (period, current, limit) => {
    console.error(`Budget exceeded! ${period}: $${current} / $${limit}`);
    // Send alert, reject requests, etc.
  },
});

const router = new Router({
  capabilityBasedRouting: true,
  optimization: 'cost', // Prefer cheaper models
  middleware: [costTracker],
});

// After requests
const stats = costTracker.getStats();
console.log('Total spent:', stats.totalCost);
console.log('Requests:', stats.requestCount);
console.log('Avg cost per request:', stats.averageCost);
```

**Visual Aids:**
- Cost comparison chart (models side-by-side)
- Dashboard mockup showing real-time costs
- Cost optimization decision tree

---

### 11. Capability-Based Routing (Smart Model Selection)
**Duration:** 15-18 minutes
**Target Audience:** Developers wanting intelligent routing
**Difficulty:** Advanced

**Learning Objectives:**
- Understand capability-based routing
- Define capability requirements
- Optimize for cost, speed, or quality
- Use hard vs soft requirements

**Script Outline:**
1. What is Capability-Based Routing? (3 min)
   - Problem: How to choose the right model?
   - Solution: Match requirements to capabilities
   - Multi-objective optimization (cost, speed, quality)
   - Automatic best-fit selection

2. Model Capabilities (3 min)
   - Context window size
   - Supports vision/tools/streaming
   - Pricing (input/output cost)
   - Latency (p50/p95)
   - Quality score
   - Model family

3. Defining Requirements (4 min)
   - Hard requirements (must have)
     - Vision support
     - Large context window
     - Tool calling
   - Soft requirements (preferences)
     - Max cost per 1k tokens
     - Max latency
     - Min quality score
   - Optimization strategy
     - Cost: Cheapest matching model
     - Speed: Fastest matching model
     - Quality: Highest quality matching model
     - Balanced: Best overall score

4. Custom Optimization Weights (2 min)
   - Fine-tune trade-offs
   - Example: 70% cost, 20% speed, 10% quality
   - Use cases for different weights

5. Real-World Examples (4 min)
   - Example 1: Code generation (need tools, optimize for quality)
   - Example 2: Simple classification (optimize for cost)
   - Example 3: Real-time chat (optimize for speed)
   - Example 4: Long documents (need large context, optimize for cost)

6. Capability Inference (2 min)
   - Automatic detection from model names
   - Pattern matching (gpt-4, claude-3, etc.)
   - Fallback when listModels() unavailable

**Code Examples:**
```typescript
const router = new Router({
  capabilityBasedRouting: true,
  optimization: 'balanced',
});

router
  .register('openai', new OpenAIBackendAdapter())
  .register('anthropic', new AnthropicBackendAdapter())
  .register('google', new GeminiBackendAdapter());

// Request with capability requirements
const request: IRChatRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Analyze this image' }] }],
  parameters: {
    model: 'gpt-4', // Requested model (may be substituted)
    temperature: 0.7,
    maxTokens: 500,
  },
  metadata: {
    requestId: 'cap-1',
    timestamp: Date.now(),
    custom: {
      capabilityRequirements: {
        required: {
          supportsVision: true, // MUST have vision
          contextWindow: 50000, // MUST have 50k+ context
        },
        preferred: {
          maxCostPer1kTokens: 0.01, // Prefer < $0.01 per 1k tokens
          maxLatencyMs: 3000, // Prefer < 3s latency
        },
        optimization: 'cost', // Among matching models, pick cheapest
      },
    },
  },
};

const response = await router.execute(request);

// Check which model was selected
console.log('Selected backend:', response.metadata.provenance?.backend);
console.log('Selected model:', response.metadata.provenance?.model);
```

**Visual Aids:**
- Decision matrix showing models scored across dimensions
- Animated scoring algorithm visualization
- Real-world scenario comparisons

---

### 12. Vision Models (Image Understanding)
**Duration:** 10-12 minutes
**Target Audience:** Developers working with images
**Difficulty:** Intermediate

**Learning Objectives:**
- Use vision-capable models
- Send images in requests
- Handle image formats
- Build image analysis app

**Script Outline:**
1. Vision Model Overview (2 min)
   - GPT-4 Vision, Claude 3, Gemini Pro Vision
   - Use cases: Image description, OCR, visual Q&A
   - Cost considerations (images are expensive)

2. Image Content Format (3 min)
   - Image URL (public URL)
   - Base64 encoding (local files)
   - Image types (jpeg, png, webp)
   - Size limits

3. Sending Image Requests (3 min)
   - Add image content to messages
   - Combine with text prompts
   - Multiple images
   - Ensure model supports vision

4. Demo: Image Description App (3 min)
   - Load local image
   - Convert to base64
   - Send to vision model
   - Display description

5. Advanced: Visual Q&A (2 min)
   - Multiple turns
   - Ask follow-up questions about image
   - Context preservation

**Code Examples:**
```typescript
import fs from 'fs';

// Load image and convert to base64
const imageBuffer = fs.readFileSync('./photo.jpg');
const base64Image = imageBuffer.toString('base64');

const request: IRChatRequest = {
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What do you see in this image?' },
        {
          type: 'image',
          source: {
            type: 'base64',
            mediaType: 'image/jpeg',
            data: base64Image,
          },
        },
      ],
    },
  ],
  parameters: {
    model: 'gpt-4-vision-preview',
    temperature: 0.7,
    maxTokens: 300,
  },
  metadata: {
    requestId: 'vision-1',
    timestamp: Date.now(),
    custom: {
      capabilityRequirements: {
        required: { supportsVision: true },
      },
    },
  },
};

const response = await bridge.execute(request);
console.log(response.message.content);
```

**Visual Aids:**
- Split screen: Image + AI description
- Supported image formats comparison
- Cost breakdown for vision requests

---

### 13. Tool Calling / Function Calling
**Duration:** 15-18 minutes
**Target Audience:** Advanced developers
**Difficulty:** Advanced

**Learning Objectives:**
- Define tools/functions
- Handle tool call requests
- Execute tools and return results
- Build agentic workflows

**Script Outline:**
1. What is Tool Calling? (3 min)
   - Let AI use external functions
   - AI decides when to call
   - Examples: Get weather, search database, make API calls
   - Enables agentic behavior

2. Defining Tools (4 min)
   - Tool schema (name, description, parameters)
   - JSON Schema for parameters
   - Clear descriptions for AI
   - Input validation

3. Tool Call Lifecycle (4 min)
   - 1. Send tools with request
   - 2. AI returns tool call request
   - 3. Execute tool function
   - 4. Send tool result back to AI
   - 5. AI generates final response

4. Implementing Tool Execution (3 min)
   - Parse tool call from response
   - Match to function implementation
   - Execute with parameters
   - Format result for AI

5. Multi-Turn Tool Use (2 min)
   - Multiple tool calls in sequence
   - Conversation context management
   - Error handling in tools

6. Demo: Weather Agent (4 min)
   - Define getWeather tool
   - User asks about weather
   - AI calls tool
   - Return weather data
   - AI formats response

**Code Examples:**
```typescript
const tools = [
  {
    name: 'get_weather',
    description: 'Get current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name (e.g., "San Francisco, CA")',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Temperature unit',
        },
      },
      required: ['location'],
    },
  },
];

const request: IRChatRequest = {
  messages: [{ role: 'user', content: [{ type: 'text', text: 'What\'s the weather in Tokyo?' }] }],
  parameters: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 200,
  },
  tools,
  metadata: { requestId: 'tool-1', timestamp: Date.now() },
};

let response = await bridge.execute(request);

// Check if AI wants to call tool
if (response.message.toolCalls) {
  for (const toolCall of response.message.toolCalls) {
    if (toolCall.name === 'get_weather') {
      const params = JSON.parse(toolCall.arguments);
      const weatherData = await getWeather(params.location, params.unit);

      // Send tool result back
      const followUp: IRChatRequest = {
        messages: [
          ...request.messages,
          response.message,
          {
            role: 'tool',
            content: [{ type: 'text', text: JSON.stringify(weatherData) }],
            toolCallId: toolCall.id,
          },
        ],
        parameters: request.parameters,
        metadata: { requestId: 'tool-2', timestamp: Date.now() },
      };

      response = await bridge.execute(followUp);
    }
  }
}

console.log(response.message.content);
```

**Visual Aids:**
- Sequence diagram showing tool call flow
- Demo of weather agent in action
- Error handling flowchart

---

### 14. Model Listing and Discovery
**Duration:** 8-10 minutes
**Target Audience:** Developers building dynamic UIs
**Difficulty:** Intermediate

**Learning Objectives:**
- List available models from backends
- Discover model capabilities
- Build model selection UI
- Handle model unavailability

**Script Outline:**
1. Why List Models? (2 min)
   - Let users choose models
   - Discover new models automatically
   - Check availability
   - Show pricing/capabilities

2. Using listModels() (3 min)
   - Call on backend adapter
   - Returns list of AIModel
   - Capabilities included
   - Cache duration

3. Model Discovery (2 min)
   - Aggregate models from all backends
   - Filter by capabilities
   - Sort by cost/speed/quality

4. Building Model Picker UI (3 min)
   - Fetch models on load
   - Display in dropdown/list
   - Show capabilities/pricing
   - Update selection
   - Send selected model in request

**Code Examples:**
```typescript
const backend = new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! });

const result = await backend.listModels();
console.log('Available models:', result.models.length);

for (const model of result.models) {
  console.log(`- ${model.name} (${model.id})`);
  if (model.capabilities) {
    console.log(`  Context: ${model.capabilities.contextWindow} tokens`);
    if (model.capabilities.pricing) {
      const cost = model.capabilities.pricing;
      console.log(`  Cost: $${cost.input}/1k input, $${cost.output}/1k output`);
    }
  }
}
```

**Visual Aids:**
- UI mockup of model picker
- Model comparison table
- Live demo fetching models

---

### 15. Creating Custom Backend Adapters
**Duration:** 18-22 minutes
**Target Audience:** Advanced developers
**Difficulty:** Advanced

**Learning Objectives:**
- Understand BackendAdapter interface
- Implement chat method
- Add streaming support
- Handle provider-specific errors
- Add model listing

**Script Outline:**
1. When to Create Custom Adapter (2 min)
   - New AI provider not supported
   - Custom internal AI service
   - Proprietary model API
   - Specialized use case

2. BackendAdapter Interface (4 min)
   - Required: chat() method
   - Optional: chatStream() method
   - Optional: listModels() method
   - Configuration and initialization

3. Implementing chat() (5 min)
   - Convert IR request to provider format
   - Make HTTP request to provider API
   - Parse provider response
   - Convert to IR response
   - Error handling

4. Adding Streaming (4 min)
   - Implement chatStream()
   - Parse SSE or chunked responses
   - Yield IRStreamChunk deltas
   - Handle stream errors
   - Close stream properly

5. Model Listing (2 min)
   - Implement listModels()
   - Fetch from provider API
   - Map to AIModel format
   - Include capabilities

6. Testing Your Adapter (3 min)
   - Unit tests
   - Integration tests
   - Mock HTTP responses
   - Test error cases

7. Example: Custom Local API (3 min)
   - Full implementation walkthrough
   - Register with Bridge
   - Use in application

**Code Examples:**
```typescript
import type { BackendAdapter, IRChatRequest, IRChatResponse, IRStreamChunk } from 'ai.matey.universal';

export class CustomBackendAdapter implements BackendAdapter {
  name = 'custom-backend';

  constructor(private config: { apiKey: string; endpoint: string }) {}

  async chat(request: IRChatRequest): Promise<IRChatResponse> {
    // 1. Convert IR to provider format
    const providerRequest = this.convertToProviderFormat(request);

    // 2. Make API call
    const response = await fetch(`${this.config.endpoint}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(providerRequest),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const providerResponse = await response.json();

    // 3. Convert provider response to IR
    return this.convertFromProviderFormat(providerResponse, request);
  }

  async *chatStream(request: IRChatRequest): AsyncIterable<IRStreamChunk> {
    // Similar to chat() but parse SSE stream
    const response = await fetch(`${this.config.endpoint}/chat/stream`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.convertToProviderFormat(request)),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const parsed = this.parseStreamChunk(chunk);

      if (parsed) {
        yield {
          type: 'delta',
          delta: { content: [{ type: 'text', text: parsed.text }] },
        };
      }
    }
  }

  async listModels() {
    const response = await fetch(`${this.config.endpoint}/models`, {
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
    });

    const data = await response.json();

    return {
      models: data.models.map((m: any) => ({
        id: m.id,
        name: m.name,
        capabilities: {
          contextWindow: m.context_window,
          maxTokens: m.max_tokens,
          pricing: m.pricing,
        },
      })),
      source: 'api',
      fetchedAt: Date.now(),
      isComplete: true,
    };
  }

  private convertToProviderFormat(request: IRChatRequest) {
    // Implementation...
  }

  private convertFromProviderFormat(response: any, request: IRChatRequest): IRChatResponse {
    // Implementation...
  }

  private parseStreamChunk(chunk: string) {
    // Implementation...
  }
}
```

**Visual Aids:**
- Architecture diagram showing adapter role
- Data flow: IR → Adapter → Provider → Adapter → IR
- Side-by-side code comparison with existing adapter

---

## Advanced Topics Series (8 videos)

### 16. Testing Strategies for ai.matey Applications
**Duration:** 15-18 minutes
**Target Audience:** Developers writing tests
**Difficulty:** Intermediate-Advanced

**Learning Objectives:**
- Test applications using ai.matey
- Mock backends for testing
- Use fixtures for deterministic tests
- Test streaming responses
- Contract testing

**Script Outline:**
1. Testing Challenges with AI (2 min)
   - Non-deterministic responses
   - API costs in tests
   - Slow test execution
   - Rate limits

2. MockBackendAdapter (4 min)
   - Built-in mock for testing
   - Configure canned responses
   - Test error scenarios
   - Fast, free, deterministic

3. Fixture-Based Testing (3 min)
   - Capture real API responses
   - Replay in tests
   - Fixtures for all scenarios
   - Update fixtures periodically

4. Testing Streaming (3 min)
   - Test stream chunks
   - Verify streaming behavior
   - Simulate stream errors
   - Test stream cancellation

5. Contract Testing (2 min)
   - Ensure adapter compliance
   - Test IR conversion
   - Provider API change detection

6. Integration Tests (2 min)
   - Test full pipeline
   - Multiple backends
   - Fallback scenarios
   - Middleware behavior

7. Example Test Suite (3 min)
   - Full Vitest test suite
   - Unit tests for adapters
   - Integration tests for Bridge
   - E2E tests for application

**Code Examples:**
```typescript
import { describe, it, expect } from 'vitest';
import { Bridge, MockBackendAdapter } from 'ai.matey.universal';

describe('Chat Application', () => {
  it('should handle basic chat request', async () => {
    const mock = new MockBackendAdapter({
      name: 'test-backend',
      defaultModel: 'test-model',
    });

    // Configure mock response
    mock.setResponse({
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello from mock!' }],
      },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      metadata: { requestId: 'test-1', timestamp: Date.now() },
    });

    const bridge = new Bridge(mock);

    const request = {
      messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
      parameters: { model: 'test-model', temperature: 0.7, maxTokens: 100 },
      metadata: { requestId: 'test-1', timestamp: Date.now() },
    };

    const response = await bridge.execute(request);

    expect(response.message.content[0].text).toBe('Hello from mock!');
    expect(response.usage.totalTokens).toBe(15);
  });

  it('should handle streaming', async () => {
    const mock = new MockBackendAdapter({ name: 'test-backend' });

    mock.setStreamChunks([
      { type: 'delta', delta: { content: [{ type: 'text', text: 'Hello' }] } },
      { type: 'delta', delta: { content: [{ type: 'text', text: ' world' }] } },
      { type: 'done', response: { /* full response */ } },
    ]);

    const bridge = new Bridge(mock);
    const request = { /* ... */ parameters: { stream: true } };

    const chunks: string[] = [];
    const stream = await bridge.execute(request);

    for await (const chunk of stream) {
      if (chunk.type === 'delta' && chunk.delta.content) {
        for (const content of chunk.delta.content) {
          if (content.type === 'text') chunks.push(content.text);
        }
      }
    }

    expect(chunks.join('')).toBe('Hello world');
  });

  it('should fallback on error', async () => {
    const failingMock = new MockBackendAdapter({ name: 'failing' });
    failingMock.setError(new Error('API is down'));

    const workingMock = new MockBackendAdapter({ name: 'working' });
    workingMock.setResponse({ /* success response */ });

    const bridge = new Bridge(failingMock, workingMock, {
      fallbackStrategy: 'sequential',
    });

    const response = await bridge.execute(request);

    expect(response.metadata.provenance?.backend).toBe('working');
  });
});
```

**Visual Aids:**
- Test pyramid diagram
- Mock vs fixture comparison
- Test suite structure example

---

### 17. Production Deployment Best Practices
**Duration:** 15-18 minutes
**Target Audience:** Developers deploying to production
**Difficulty:** Advanced

**Learning Objectives:**
- Configure for production
- Handle secrets securely
- Implement monitoring
- Set up error tracking
- Scale horizontally

**Script Outline:**
1. Configuration Management (3 min)
   - Environment variables
   - Config files vs env vars
   - Secrets management (AWS Secrets Manager, Vault)
   - Multiple environments (dev, staging, prod)

2. Security Best Practices (3 min)
   - API key rotation
   - Rate limiting
   - Input validation
   - Output sanitization
   - Content filtering

3. Monitoring and Observability (3 min)
   - Log aggregation (Datadog, Splunk)
   - Metrics (requests/sec, latency, error rate)
   - OpenTelemetry integration
   - Alerts and dashboards

4. Error Handling (2 min)
   - Graceful degradation
   - User-friendly error messages
   - Error tracking (Sentry)
   - Automatic retries

5. Performance Optimization (3 min)
   - Response caching
   - Connection pooling
   - Request deduplication
   - CDN for static assets

6. Scaling Considerations (2 min)
   - Horizontal scaling
   - Load balancing
   - Stateless design
   - Database considerations

7. Cost Management (2 min)
   - Budget alerts
   - Cost attribution
   - Optimization strategies
   - Reserved capacity

**Code Examples:**
```typescript
import { Router, LoggingMiddleware, CostTrackingMiddleware, createOpenTelemetryMiddleware } from 'ai.matey.universal';

// Production configuration
const router = new Router({
  capabilityBasedRouting: true,
  optimization: 'balanced',
  fallbackStrategy: 'sequential',
  maxRetries: 3,
  retryDelay: 2000,
  capabilityCacheDuration: 3600000, // 1 hour

  middleware: [
    // Logging
    new LoggingMiddleware({
      level: process.env.LOG_LEVEL || 'info',
      destination: process.env.LOG_DESTINATION || 'stdout',
    }),

    // Cost tracking
    new CostTrackingMiddleware({
      budget: {
        daily: parseFloat(process.env.DAILY_BUDGET!),
        monthly: parseFloat(process.env.MONTHLY_BUDGET!),
      },
      onBudgetExceeded: async (period, current, limit) => {
        await sendAlert(`Budget exceeded: ${period} $${current}/$${limit}`);
        throw new Error('Budget exceeded');
      },
    }),

    // OpenTelemetry
    createOpenTelemetryMiddleware({
      serviceName: 'ai-matey-app',
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT!,
      headers: {
        'x-api-key': process.env.OTEL_API_KEY!,
      },
    }),
  ],
});

// Register backends with secure config
router.register('openai', new OpenAIBackendAdapter({
  apiKey: await getSecret('OPENAI_API_KEY'),
  organization: await getSecret('OPENAI_ORG_ID'),
}));

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    backends: {},
  };

  for (const backend of router.getAvailableBackends()) {
    health.backends[backend] = router.isBackendAvailable(backend);
  }

  res.json(health);
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Request failed', { error: err.message, stack: err.stack });

  // Don't leak internal errors to users
  res.status(500).json({
    error: 'Something went wrong. Please try again.',
    requestId: req.id,
  });
});
```

**Visual Aids:**
- Architecture diagram for production deployment
- Monitoring dashboard mockup
- Security checklist

---

### 18. Building Agentic Workflows
**Duration:** 20-25 minutes
**Target Audience:** Advanced developers
**Difficulty:** Advanced

**Learning Objectives:**
- Design multi-step agentic workflows
- Implement tool orchestration
- Handle complex state management
- Build autonomous agents

**Script Outline:**
1. What are Agentic Workflows? (3 min)
   - Autonomous task completion
   - Multi-step reasoning
   - Dynamic tool selection
   - Self-correction

2. Workflow Design Patterns (5 min)
   - Sequential: Step-by-step execution
   - Parallel: Multiple tasks simultaneously
   - Conditional: Branch based on results
   - Looping: Iterate until goal met
   - Tree search: Explore options

3. State Management (4 min)
   - Conversation history
   - Tool call history
   - Intermediate results
   - Decision tree

4. Tool Orchestration (4 min)
   - Register multiple tools
   - Let AI choose tools
   - Compose tool results
   - Error recovery

5. Example: Research Agent (6 min)
   - Tools: search, read_url, summarize
   - User query: "Research topic X"
   - Agent workflow:
     1. Search for sources
     2. Read top sources
     3. Summarize findings
     4. Synthesize answer
   - Handle errors and retries

6. Advanced: Multi-Agent Systems (3 min)
   - Multiple specialized agents
   - Agent communication
   - Task delegation
   - Consensus building

**Code Examples:**
```typescript
class ResearchAgent {
  constructor(private bridge: Bridge) {}

  async research(query: string): Promise<string> {
    const tools = [
      {
        name: 'search',
        description: 'Search the web for information',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            num_results: { type: 'number', description: 'Number of results' },
          },
          required: ['query'],
        },
      },
      {
        name: 'read_url',
        description: 'Read and extract content from a URL',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to read' },
          },
          required: ['url'],
        },
      },
      {
        name: 'summarize',
        description: 'Summarize long text',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to summarize' },
          },
          required: ['text'],
        },
      },
    ];

    const messages: IRMessage[] = [
      {
        role: 'system',
        content: [{ type: 'text', text: 'You are a research assistant. Use the provided tools to thoroughly research the topic and provide a comprehensive summary.' }],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: `Research this topic: ${query}` }],
      },
    ];

    let iterations = 0;
    const maxIterations = 10;

    while (iterations < maxIterations) {
      const request: IRChatRequest = {
        messages,
        parameters: { model: 'gpt-4', temperature: 0.7, maxTokens: 1000 },
        tools,
        metadata: { requestId: `research-${iterations}`, timestamp: Date.now() },
      };

      const response = await this.bridge.execute(request);
      messages.push(response.message);

      // Check if AI wants to use tools
      if (response.message.toolCalls && response.message.toolCalls.length > 0) {
        // Execute all tool calls
        for (const toolCall of response.message.toolCalls) {
          const result = await this.executeTool(toolCall);
          messages.push({
            role: 'tool',
            content: [{ type: 'text', text: JSON.stringify(result) }],
            toolCallId: toolCall.id,
          });
        }
        iterations++;
      } else {
        // AI finished research, return final answer
        return response.message.content[0].text!;
      }
    }

    throw new Error('Max iterations reached');
  }

  private async executeTool(toolCall: ToolCall) {
    const params = JSON.parse(toolCall.arguments);

    switch (toolCall.name) {
      case 'search':
        return await this.search(params.query, params.num_results || 5);
      case 'read_url':
        return await this.readUrl(params.url);
      case 'summarize':
        return await this.summarize(params.text);
      default:
        throw new Error(`Unknown tool: ${toolCall.name}`);
    }
  }

  private async search(query: string, numResults: number) {
    // Implement search
  }

  private async readUrl(url: string) {
    // Implement URL reading
  }

  private async summarize(text: string) {
    // Implement summarization
  }
}

// Usage
const agent = new ResearchAgent(bridge);
const result = await agent.research('Latest developments in quantum computing');
console.log(result);
```

**Visual Aids:**
- Workflow diagram showing agent decision tree
- State machine visualization
- Multi-agent system architecture

---

### 19. Caching Strategies
**Duration:** 12-15 minutes
**Target Audience:** Developers optimizing performance
**Difficulty:** Intermediate-Advanced

**Learning Objectives:**
- Implement response caching
- Use cache middleware
- Handle cache invalidation
- Optimize cache hit rates

**Script Outline:**
1. Why Cache AI Responses? (2 min)
   - Save costs (avoid duplicate API calls)
   - Reduce latency
   - Handle rate limits
   - Deterministic responses

2. Cache Key Design (3 min)
   - Hash request content
   - Include relevant parameters
   - Exclude non-deterministic fields (timestamp, requestId)
   - Model versioning considerations

3. Cache Middleware (3 min)
   - Built-in caching middleware
   - In-memory vs persistent cache
   - TTL (time to live)
   - Size limits (LRU eviction)

4. Cache Backends (3 min)
   - Memory (fast, not persistent)
   - Redis (distributed, persistent)
   - Database (PostgreSQL, MongoDB)
   - CDN (for static responses)

5. Cache Invalidation (2 min)
   - Manual invalidation
   - TTL expiration
   - Model version changes
   - User-specific caches

6. Monitoring Cache Performance (2 min)
   - Hit rate
   - Miss rate
   - Average latency improvement
   - Storage usage

**Code Examples:**
```typescript
import { Router, CachingMiddleware } from 'ai.matey.universal';
import Redis from 'ioredis';

// Redis cache backend
class RedisCacheBackend {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<IRChatResponse | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: IRChatResponse, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

// Configure caching middleware
const redis = new Redis(process.env.REDIS_URL!);
const cacheBackend = new RedisCacheBackend(redis);

const cachingMiddleware = new CachingMiddleware({
  backend: cacheBackend,
  ttl: 3600, // 1 hour
  keyGenerator: (request) => {
    // Generate cache key from request
    const key = {
      messages: request.messages,
      model: request.parameters?.model,
      temperature: request.parameters?.temperature,
      maxTokens: request.parameters?.maxTokens,
    };
    return hashObject(key);
  },
  shouldCache: (request, response) => {
    // Only cache successful, non-streaming responses
    return !request.parameters?.stream && response.usage.totalTokens < 5000;
  },
});

const router = new Router({
  middleware: [cachingMiddleware],
});

// Monitor cache performance
setInterval(() => {
  const stats = cachingMiddleware.getStats();
  console.log('Cache hit rate:', (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) + '%');
  console.log('Total hits:', stats.hits);
  console.log('Total misses:', stats.misses);
  console.log('Avg latency improvement:', stats.avgLatencyImprovement + 'ms');
}, 60000);
```

**Visual Aids:**
- Cache flow diagram
- Hit rate chart
- Cost savings calculation

---

### 20. Rate Limiting and Quota Management
**Duration:** 12-15 minutes
**Target Audience:** Developers managing API limits
**Difficulty:** Intermediate

**Learning Objectives:**
- Implement rate limiting
- Handle provider quotas
- Queue requests
- Distribute load across providers

**Script Outline:**
1. Understanding Rate Limits (2 min)
   - Provider limits (requests/min, tokens/min)
   - Consequences of exceeding limits
   - HTTP 429 errors
   - Backoff strategies

2. Rate Limiting Middleware (3 min)
   - Track request rates
   - Enforce limits
   - Queue excess requests
   - Per-user limits

3. Quota Management (3 min)
   - Track usage against quotas
   - Alert on threshold
   - Reject when quota exceeded
   - Reset periods (hourly, daily, monthly)

4. Request Queuing (3 min)
   - Queue excess requests
   - Process at allowed rate
   - Priority queues
   - Timeout handling

5. Load Distribution (2 min)
   - Spread across multiple backends
   - Round-robin strategy
   - Weighted distribution
   - Failover on limit reached

6. Demo: Rate-Limited Application (2 min)
   - Configure limits
   - Simulate high load
   - Show queuing behavior
   - Monitor queue depth

**Code Examples:**
```typescript
import { Router, RateLimitMiddleware } from 'ai.matey.universal';

const rateLimiter = new RateLimitMiddleware({
  // Per-backend limits
  limits: {
    openai: {
      requestsPerMinute: 60,
      tokensPerMinute: 90000,
    },
    anthropic: {
      requestsPerMinute: 50,
      tokensPerMinute: 100000,
    },
  },

  // Per-user limits
  userLimits: {
    requestsPerHour: 100,
    tokensPerDay: 500000,
  },

  // Queuing config
  queue: {
    enabled: true,
    maxSize: 1000,
    timeout: 30000, // ms
  },

  // Actions on limit exceeded
  onLimitExceeded: (backend, userId, limit) => {
    logger.warn(`Rate limit exceeded: ${backend} for ${userId}`);
  },
});

const router = new Router({
  middleware: [rateLimiter],

  // Distribute load across backends
  fallbackStrategy: 'round-robin',
});

// Monitor rate limit status
app.get('/api/rate-limit-status', (req, res) => {
  const status = rateLimiter.getStatus(req.user.id);
  res.json({
    requestsRemaining: status.requestsRemaining,
    tokensRemaining: status.tokensRemaining,
    resetAt: status.resetAt,
    queueDepth: status.queueDepth,
  });
});
```

**Visual Aids:**
- Rate limit visualization
- Queue depth over time chart
- Load distribution diagram

---

### 21. Error Handling and Recovery Patterns
**Duration:** 12-15 minutes
**Target Audience:** All developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Handle common error types
- Implement retry logic
- Graceful degradation
- User-friendly error messages

**Script Outline:**
1. Common Error Types (3 min)
   - Network errors (timeouts, connection refused)
   - API errors (401, 429, 500)
   - Validation errors (invalid request)
   - Provider-specific errors

2. Error Detection (2 min)
   - Try-catch blocks
   - Error middleware
   - Response validation
   - Error logging

3. Retry Strategies (3 min)
   - Exponential backoff
   - Max retry attempts
   - Retry on transient errors only
   - Circuit breaker pattern

4. Fallback Strategies (3 min)
   - Try alternate backend
   - Use cached response
   - Return partial result
   - Default response

5. User Communication (2 min)
   - Friendly error messages
   - Don't expose internal errors
   - Suggest actions
   - Provide request ID for support

6. Monitoring and Alerting (2 min)
   - Error rate tracking
   - Alert on error spike
   - Error categorization
   - Root cause analysis

**Code Examples:**
```typescript
import { Router, ErrorHandlingMiddleware } from 'ai.matey.universal';

const errorHandler = new ErrorHandlingMiddleware({
  // Retry config
  retry: {
    maxAttempts: 3,
    initialDelay: 1000, // ms
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableErrors: [
      'NetworkError',
      'TimeoutError',
      'RateLimitError',
      'ServerError',
    ],
  },

  // Error transformation
  transformError: (error) => {
    // Convert to user-friendly message
    if (error.code === 'rate_limit_exceeded') {
      return {
        message: 'The AI service is currently busy. Please try again in a moment.',
        userFacing: true,
        retryable: true,
        retryAfter: error.retryAfter,
      };
    }

    if (error.code === 'invalid_api_key') {
      return {
        message: 'Service configuration error. Please contact support.',
        userFacing: true,
        retryable: false,
      };
    }

    // Default: Don't expose internal errors
    return {
      message: 'Something went wrong. Please try again.',
      userFacing: true,
      retryable: true,
    };
  },

  // Error logging
  onError: (error, request, attempt) => {
    logger.error('Request failed', {
      error: error.message,
      code: error.code,
      requestId: request.metadata.requestId,
      attempt,
      backend: error.backend,
    });
  },
});

const router = new Router({
  middleware: [errorHandler],
  fallbackStrategy: 'sequential',
});

// Application error handling
app.post('/api/chat', async (req, res) => {
  try {
    const response = await router.execute(req.body);
    res.json(response);
  } catch (error) {
    // Error middleware has already logged and transformed
    const transformed = error.userFacing ? error : {
      message: 'An unexpected error occurred.',
      retryable: false,
    };

    res.status(error.statusCode || 500).json({
      error: transformed.message,
      requestId: req.body.metadata.requestId,
      retryable: transformed.retryable,
      retryAfter: transformed.retryAfter,
    });
  }
});
```

**Visual Aids:**
- Error flow diagram
- Retry backoff visualization
- Error categorization chart

---

### 22. Performance Optimization Techniques
**Duration:** 15-18 minutes
**Target Audience:** Developers optimizing performance
**Difficulty:** Advanced

**Learning Objectives:**
- Profile application performance
- Identify bottlenecks
- Optimize request/response pipeline
- Reduce latency

**Script Outline:**
1. Performance Metrics (3 min)
   - Latency (p50, p95, p99)
   - Throughput (requests/sec)
   - Token usage
   - Memory usage
   - Cost per request

2. Profiling (3 min)
   - Built-in profiler middleware
   - Timing breakdown per stage
   - Memory snapshots
   - Bottleneck identification

3. Optimization Strategies (5 min)
   - Reduce token usage
     - Shorter prompts
     - Lower maxTokens
     - Smaller context windows
   - Use faster models
     - Speed optimization in capability routing
     - Trade quality for speed when appropriate
   - Parallel requests
     - Batch processing
     - Concurrent execution
   - Caching
     - Response caching
     - Model list caching
     - Capability caching
   - Connection pooling
     - Reuse HTTP connections
     - Keep-alive

4. Streaming for Perceived Performance (2 min)
   - Start displaying immediately
   - Better UX even if same total time
   - Reduce timeout risk

5. Provider Selection (2 min)
   - Choose provider based on latency
   - Geographic proximity
   - Provider SLA comparison

6. Demo: Before and After (3 min)
   - Profile slow application
   - Apply optimizations
   - Show performance improvement
   - Cost reduction

**Code Examples:**
```typescript
import { Router, ProfilerMiddleware } from 'ai.matey.universal';

const profiler = new ProfilerMiddleware({
  enabled: true,
  sampleRate: 1.0, // Profile 100% of requests (reduce in prod)
});

const router = new Router({
  capabilityBasedRouting: true,
  optimization: 'speed', // Prioritize fast models
  middleware: [profiler],
});

// After some requests
const report = profiler.generateReport();
console.log('Performance Report:');
console.log('- Avg latency:', report.avgLatency + 'ms');
console.log('- P95 latency:', report.p95Latency + 'ms');
console.log('- Slowest stage:', report.bottleneck.stage);
console.log('- Avg time in stage:', report.bottleneck.avgTime + 'ms');
console.log('Recommendations:', report.recommendations);

// Optimization: Reduce token usage
const optimizedRequest = {
  messages: [
    { role: 'system', content: [{ type: 'text', text: 'Be concise.' }] },
    { role: 'user', content: [{ type: 'text', text: request.query }] },
  ],
  parameters: {
    model: 'gpt-3.5-turbo', // Faster, cheaper
    temperature: 0.7,
    maxTokens: 200, // Reduced from 500
  },
  metadata: {
    requestId: generateId(),
    timestamp: Date.now(),
    custom: {
      capabilityRequirements: {
        optimization: 'speed',
        preferred: {
          maxLatencyMs: 1000,
        },
      },
    },
  },
};

// Optimization: Parallel processing
const requests = userQueries.map(query => ({
  messages: [{ role: 'user', content: [{ type: 'text', text: query }] }],
  parameters: { model: 'gpt-3.5-turbo', maxTokens: 100 },
  metadata: { requestId: generateId(), timestamp: Date.now() },
}));

const responses = await Promise.all(
  requests.map(req => router.execute(req))
);
```

**Visual Aids:**
- Performance profile breakdown chart
- Before/after latency comparison
- Optimization checklist

---

### 23. Security and Privacy Considerations
**Duration:** 12-15 minutes
**Target Audience:** All developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Handle sensitive data
- Implement PII filtering
- Secure API keys
- Audit logging

**Script Outline:**
1. Sensitive Data Handling (3 min)
   - Identify PII (personally identifiable information)
   - GDPR, CCPA compliance
   - Data residency requirements
   - Provider data policies

2. PII Filtering (3 min)
   - Detect PII in requests
   - Redact before sending to provider
   - Restore in responses
   - Custom filtering rules

3. API Key Security (2 min)
   - Never commit keys to git
   - Use secrets management
   - Rotate keys regularly
   - Restrict key permissions

4. Audit Logging (2 min)
   - Log all requests (metadata only)
   - Compliance requirements
   - Retention policies
   - Secure storage

5. Network Security (2 min)
   - Use HTTPS only
   - Certificate validation
   - Firewall rules
   - VPN/private networks

6. Demo: PII Filtering (3 min)
   - Implement PII detection
   - Redact before API call
   - Verify provider doesn't see PII
   - Restore in response

**Code Examples:**
```typescript
import { Router, PIIFilterMiddleware, AuditLogMiddleware } from 'ai.matey.universal';

// PII filtering middleware
const piiFilter = new PIIFilterMiddleware({
  patterns: {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  },
  replacementToken: '[REDACTED]',
  preserveForResponse: true, // Restore in final response
});

// Audit logging middleware
const auditLog = new AuditLogMiddleware({
  destination: 'database', // or 'file', 'syslog'
  logLevel: 'full', // or 'metadata-only', 'minimal'
  includeRequestBody: false, // Don't log full request for privacy
  includeResponseBody: false,
  retention: {
    days: 90,
    autoDelete: true,
  },
  onLog: async (entry) => {
    await db.auditLogs.insert({
      timestamp: entry.timestamp,
      requestId: entry.requestId,
      userId: entry.userId,
      backend: entry.backend,
      model: entry.model,
      tokenUsage: entry.tokenUsage,
      success: entry.success,
      error: entry.error,
    });
  },
});

const router = new Router({
  middleware: [piiFilter, auditLog],
});

// Secure API key management
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secretsManager = new SecretsManager({ region: 'us-east-1' });

async function getApiKey(name: string): Promise<string> {
  const response = await secretsManager.getSecretValue({ SecretId: name });
  return JSON.parse(response.SecretString!).apiKey;
}

const openaiKey = await getApiKey('prod/openai-api-key');
const anthropicKey = await getApiKey('prod/anthropic-api-key');
```

**Visual Aids:**
- Data flow diagram showing PII filtering
- Security checklist
- Compliance requirements table

---

## Integration Examples Series (6 videos)

### 24. Next.js Integration
**Duration:** 12-15 minutes
**Target Audience:** Next.js developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Set up ai.matey in Next.js
- Create API routes
- Build chat UI with streaming
- Deploy to Vercel

**Script Outline:**
1. Project Setup (2 min)
   - Create Next.js app
   - Install ai.matey.universal
   - Configure environment variables

2. API Routes (3 min)
   - Create `/api/chat` endpoint
   - Initialize Router
   - Handle POST requests
   - Error handling

3. Streaming API Route (3 min)
   - Server-Sent Events (SSE)
   - Stream response chunks
   - Handle client disconnection

4. Chat UI Component (4 min)
   - useState for messages
   - Form for user input
   - Display chat history
   - Handle streaming

5. Deployment (2 min)
   - Configure environment variables in Vercel
   - Deploy to Vercel
   - Test production deployment

**Code Examples:**
Full Next.js application with API routes and React components

**Visual Aids:**
- Project structure
- Live demo of chat UI
- Deployment walkthrough

---

### 25. Express.js REST API
**Duration:** 10-12 minutes
**Target Audience:** Express.js developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Build REST API for AI chat
- Add authentication
- Implement rate limiting
- Document with OpenAPI

**Script Outline:**
1. Express Setup (2 min)
   - Initialize Express app
   - Install dependencies
   - Basic routing

2. Chat Endpoint (3 min)
   - POST /api/chat
   - Request validation
   - Execute through Bridge
   - Response formatting

3. Authentication (2 min)
   - JWT middleware
   - API key validation
   - Per-user rate limits

4. Rate Limiting (2 min)
   - express-rate-limit
   - Per-user quotas
   - Error responses

5. API Documentation (2 min)
   - OpenAPI/Swagger spec
   - Document all endpoints
   - Example requests/responses

**Code Examples:**
Full Express.js API with auth, rate limiting, and docs

**Visual Aids:**
- API endpoint table
- Swagger UI screenshot
- Postman demo

---

### 26. React Chat UI (Advanced)
**Duration:** 15-18 minutes
**Target Audience:** React developers
**Difficulty:** Intermediate-Advanced

**Learning Objectives:**
- Build production-quality chat UI
- Handle streaming responses
- Implement markdown rendering
- Add code syntax highlighting

**Script Outline:**
1. Component Architecture (2 min)
   - ChatContainer
   - MessageList
   - MessageBubble
   - InputForm

2. State Management (3 min)
   - useState for messages
   - useReducer for complex state
   - Context for global state

3. Streaming Integration (4 min)
   - Fetch API with SSE
   - Update UI as chunks arrive
   - Handle errors
   - Cancel request

4. Markdown Rendering (3 min)
   - react-markdown
   - Code blocks with syntax highlighting
   - Custom renderers

5. Advanced Features (4 min)
   - Typing indicator
   - Message reactions
   - Copy code button
   - Export conversation

6. Styling (2 min)
   - Tailwind CSS
   - Dark mode
   - Responsive design

**Code Examples:**
Complete React chat application

**Visual Aids:**
- Live demo of chat UI
- Component hierarchy diagram
- Responsive design showcase

---

### 27. FastAPI Integration (Python)
**Duration:** 10-12 minutes
**Target Audience:** Python developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Use ai.matey from Python
- Create FastAPI endpoints
- Handle async requests
- Type hints and validation

**Script Outline:**
1. Why Use From Python? (1 min)
   - Integrate with Python ML pipelines
   - Leverage Python ecosystem
   - Unified AI interface

2. Calling ai.matey from Python (3 min)
   - HTTP API approach
   - Wrap Node.js module (optional)
   - Request/response formatting

3. FastAPI Endpoint (3 min)
   - POST /chat endpoint
   - Pydantic models for validation
   - Async request handling
   - Error responses

4. Streaming in FastAPI (3 min)
   - StreamingResponse
   - Yield chunks
   - SSE format

5. Integration Example (2 min)
   - Python ML model + ai.matey
   - Preprocessing → AI → Postprocessing
   - Complete pipeline

**Code Examples:**
```python
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import json

app = FastAPI()

class ChatRequest(BaseModel):
    messages: list
    model: str = "gpt-4"
    temperature: float = 0.7
    max_tokens: int = 500

class ChatResponse(BaseModel):
    message: dict
    usage: dict

AI_MATEY_URL = "http://localhost:3000/api/chat"

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                AI_MATEY_URL,
                json={
                    "messages": request.messages,
                    "parameters": {
                        "model": request.model,
                        "temperature": request.temperature,
                        "maxTokens": request.max_tokens,
                    },
                    "metadata": {
                        "requestId": generate_id(),
                        "timestamp": int(time.time() * 1000),
                    },
                },
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                AI_MATEY_URL,
                json={...},  # same as above
            ) as response:
                async for chunk in response.aiter_text():
                    yield f"data: {chunk}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

**Visual Aids:**
- Architecture diagram: Python ↔ ai.matey ↔ Providers
- API documentation
- Integration flowchart

---

### 28. Discord Bot Integration
**Duration:** 12-15 minutes
**Target Audience:** Discord bot developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Build Discord bot with ai.matey
- Handle slash commands
- Stream responses to Discord
- Manage conversation context

**Script Outline:**
1. Discord Bot Setup (2 min)
   - Create Discord application
   - Get bot token
   - Install discord.js
   - Invite bot to server

2. Basic Command Handler (3 min)
   - Slash command: /ask
   - Get user input
   - Send to ai.matey
   - Reply in Discord

3. Streaming Responses (3 min)
   - Discord message editing
   - Update message as chunks arrive
   - Handle long responses (split messages)

4. Conversation Context (3 min)
   - Store per-channel/per-user history
   - Include context in requests
   - Clear command
   - Memory limits

5. Advanced Features (3 min)
   - Model selection command
   - Image analysis (vision models)
   - Typing indicator
   - Error handling

**Code Examples:**
```typescript
import { Client, GatewayIntentBits, SlashCommandBuilder } from 'discord.js';
import { Bridge, OpenAIBackendAdapter, AnthropicBackendAdapter } from 'ai.matey.universal';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const bridge = new Bridge(
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! }),
  new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! })
);

// Store conversation history per channel
const conversations = new Map<string, Array<any>>();

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ask') {
    const query = interaction.options.getString('query')!;
    const channelId = interaction.channelId;

    await interaction.deferReply();

    // Get conversation history
    const history = conversations.get(channelId) || [];
    history.push({
      role: 'user',
      content: [{ type: 'text', text: query }],
    });

    // Keep last 10 messages only
    const recentHistory = history.slice(-10);

    const request = {
      messages: recentHistory,
      parameters: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 500,
        stream: true,
      },
      metadata: {
        requestId: interaction.id,
        timestamp: Date.now(),
      },
    };

    try {
      let fullResponse = '';
      let lastUpdate = Date.now();

      const stream = await bridge.execute(request);

      for await (const chunk of stream) {
        if (chunk.type === 'delta' && chunk.delta.content) {
          for (const content of chunk.delta.content) {
            if (content.type === 'text') {
              fullResponse += content.text;

              // Update message every 500ms
              if (Date.now() - lastUpdate > 500) {
                await interaction.editReply(fullResponse || '...');
                lastUpdate = Date.now();
              }
            }
          }
        }
      }

      // Final update
      await interaction.editReply(fullResponse);

      // Store assistant response in history
      history.push({
        role: 'assistant',
        content: [{ type: 'text', text: fullResponse }],
      });
      conversations.set(channelId, history);

    } catch (error) {
      await interaction.editReply('Sorry, something went wrong. Please try again.');
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN!);
```

**Visual Aids:**
- Discord bot in action (screen recording)
- Command reference
- Architecture diagram

---

### 29. Slack Bot Integration
**Duration:** 12-15 minutes
**Target Audience:** Slack bot developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Build Slack bot with ai.matey
- Handle mentions and DMs
- Thread conversations
- Add buttons and actions

**Script Outline:**
Similar to Discord bot but for Slack:
1. Slack app setup
2. Event handling (app_mention, message)
3. Streaming to Slack
4. Thread-based conversations
5. Interactive components (buttons, modals)

**Code Examples:**
Full Slack bot implementation with Bolt framework

**Visual Aids:**
- Slack bot demo
- Thread conversation example
- Interactive components showcase

---

## Optimization and Troubleshooting Series (5 videos)

### 30. Debugging Common Issues
**Duration:** 12-15 minutes
**Target Audience:** All developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Use debug mode
- Read error messages
- Troubleshoot common problems
- Use logging effectively

**Script Outline:**
1. Enable Debug Mode (2 min)
   - Debug configuration
   - Verbose logging
   - Request/response inspection

2. Common Issues (6 min)
   - "Backend not found" - Registration issue
   - "API key invalid" - Configuration issue
   - "Rate limit exceeded" - Quota management
   - "Streaming not supported" - Model limitation
   - "Model not found" - Model name mismatch
   - "Timeout" - Long requests, increase timeout

3. Reading Error Messages (2 min)
   - Error structure
   - Error codes
   - Stack traces
   - Request ID for support

4. Logging Best Practices (2 min)
   - Log levels
   - Structured logging
   - Sensitive data
   - Log aggregation

5. Debugging Tools (3 min)
   - Built-in profiler
   - Pipeline inspector
   - Network inspector
   - Debug middleware

**Code Examples:**
```typescript
const router = new Router({
  debug: {
    enabled: true,
    logLevel: 'trace',
    captureTimings: true,
    captureTransformations: true,
    outputFormat: 'console',
  },
  middleware: [new LoggingMiddleware({ level: 'debug' })],
});

// Common issue: Backend not registered
try {
  const response = await router.execute(request);
} catch (error) {
  if (error.code === 'NO_AVAILABLE_BACKENDS') {
    console.error('No backends registered!');
    console.log('Available backends:', router.getAvailableBackends());
    // Register backends...
  }
}
```

**Visual Aids:**
- Error message anatomy diagram
- Debugging checklist
- Common issues troubleshooting tree

---

### 31. Monitoring and Observability with OpenTelemetry
**Duration:** 15-18 minutes
**Target Audience:** DevOps/SRE, Advanced developers
**Difficulty:** Advanced

**Learning Objectives:**
- Set up OpenTelemetry
- Export traces to Jaeger/Datadog
- Create custom metrics
- Build dashboards

**Script Outline:**
1. OpenTelemetry Overview (2 min)
   - Industry standard for observability
   - Traces, metrics, logs
   - Vendor-neutral

2. Setup and Configuration (3 min)
   - Install OTel dependencies
   - Initialize provider
   - Configure exporters
   - Sample rates

3. ai.matey OTel Integration (3 min)
   - Enable OTel middleware
   - Automatic span creation
   - Custom attributes
   - Trace context propagation

4. Exporting to Jaeger (2 min)
   - Run Jaeger locally
   - Configure exporter
   - View traces in Jaeger UI

5. Exporting to Datadog (2 min)
   - Configure Datadog exporter
   - API key setup
   - View in Datadog APM

6. Custom Metrics (3 min)
   - Create meters
   - Counters and histograms
   - Export to Prometheus

7. Building Dashboards (3 min)
   - Grafana setup
   - Query metrics
   - Create visualizations
   - Alerts

**Code Examples:**
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry
const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'ai-matey-app',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: {
      'x-api-key': process.env.OTEL_API_KEY,
    },
  }),
});

sdk.start();

// Use with ai.matey
import { Router, createOpenTelemetryMiddleware } from 'ai.matey.universal';

const router = new Router({
  middleware: [
    createOpenTelemetryMiddleware({
      serviceName: 'ai-matey-app',
      attributes: {
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION,
      },
    }),
  ],
});

// Traces will now be automatically exported
const response = await router.execute(request);
```

**Visual Aids:**
- Jaeger UI showing traces
- Datadog APM dashboard
- Grafana dashboard with metrics

---

### 32. Load Testing and Benchmarking
**Duration:** 12-15 minutes
**Target Audience:** Performance engineers
**Difficulty:** Advanced

**Learning Objectives:**
- Create load testing scenarios
- Use k6 for benchmarking
- Analyze performance results
- Identify bottlenecks

**Script Outline:**
1. Why Load Test? (2 min)
   - Understand capacity limits
   - Find breaking points
   - Performance under load
   - Cost at scale

2. Load Testing Tools (2 min)
   - k6 (JavaScript-based)
   - Apache JMeter
   - Artillery
   - Locust (Python)

3. Creating Test Scenarios (4 min)
   - Ramp-up load
   - Sustained load
   - Spike test
   - Stress test

4. Running Load Tests (3 min)
   - Execute k6 script
   - Monitor during test
   - Collect results

5. Analyzing Results (3 min)
   - Response time distribution
   - Error rate
   - Throughput
   - Resource utilization

6. Optimization (2 min)
   - Identify bottlenecks
   - Scale horizontally
   - Optimize configuration
   - Re-test

**Code Examples:**
```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 10 },  // Ramp up to 10 users
    { duration: '5m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 50 },  // Spike to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests < 2s
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export default function () {
  const payload = JSON.stringify({
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
    ],
    parameters: {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 100,
    },
    metadata: {
      requestId: `load-test-${__VU}-${__ITER}`,
      timestamp: Date.now(),
    },
  });

  const response = http.post('http://localhost:3000/api/chat', payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_KEY}`,
    },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response has message': (r) => JSON.parse(r.body).message !== undefined,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
```

**Visual Aids:**
- k6 dashboard showing results
- Response time charts
- Bottleneck identification guide

---

### 33. Cost Analysis and Optimization
**Duration:** 12-15 minutes
**Target Audience:** Engineering managers, developers
**Difficulty:** Intermediate

**Learning Objectives:**
- Analyze AI costs
- Identify cost drivers
- Implement cost optimizations
- Set budgets and alerts

**Script Outline:**
1. Understanding AI Costs (3 min)
   - Token-based pricing
   - Input vs output tokens
   - Model pricing tiers
   - Hidden costs (failed requests, retries)

2. Cost Tracking (3 min)
   - Enable cost tracking middleware
   - Aggregate costs
   - Per-user attribution
   - Export to analytics

3. Cost Analysis (3 min)
   - Identify expensive models
   - Identify expensive users
   - Identify expensive features
   - Cost trends over time

4. Optimization Strategies (4 min)
   - Use capability-based routing with cost optimization
   - Implement caching
   - Reduce token usage (shorter prompts, lower maxTokens)
   - Use cheaper models for simple tasks
   - Batch requests

5. Budget Management (2 min)
   - Set daily/monthly budgets
   - Alert on threshold
   - Reject over-budget requests
   - Budget rollover

**Code Examples:**
```typescript
import { Router, CostTrackingMiddleware, CostAnalyzer } from 'ai.matey.universal';

const costTracker = new CostTrackingMiddleware({
  budget: {
    daily: 100,
    monthly: 2000,
  },
  attribution: {
    enabled: true,
    userIdExtractor: (request) => request.metadata.custom?.userId,
  },
  alertThresholds: {
    daily: 0.8,  // Alert at 80% of daily budget
    monthly: 0.9,
  },
  onBudgetExceeded: async (period, current, limit) => {
    await sendAlert(`Budget exceeded: ${period} $${current}/$${limit}`);
    throw new Error('Budget exceeded');
  },
});

const router = new Router({
  capabilityBasedRouting: true,
  optimization: 'cost', // Prefer cheaper models
  middleware: [costTracker],
});

// Analyze costs
const analyzer = new CostAnalyzer(costTracker);

// Top expensive users
const topUsers = analyzer.getTopUsers(10);
console.log('Most expensive users:');
for (const user of topUsers) {
  console.log(`- ${user.id}: $${user.totalCost} (${user.requestCount} requests)`);
}

// Model cost breakdown
const modelCosts = analyzer.getCostByModel();
console.log('Cost by model:');
for (const [model, cost] of Object.entries(modelCosts)) {
  console.log(`- ${model}: $${cost}`);
}

// Optimization recommendations
const recommendations = analyzer.getOptimizationRecommendations();
console.log('Recommendations:', recommendations);
// Example output:
// - Switch from gpt-4 to gpt-3.5-turbo for simple queries: Save ~$50/day
// - Enable caching for repeated queries: Save ~$20/day
// - Reduce maxTokens from 500 to 200 where possible: Save ~$15/day
```

**Visual Aids:**
- Cost breakdown charts
- Cost trends graph
- Optimization impact calculator

---

### 34. Migration Guide (From OpenAI SDK to ai.matey)
**Duration:** 10-12 minutes
**Target Audience:** Developers migrating existing apps
**Difficulty:** Beginner-Intermediate

**Learning Objectives:**
- Identify migration benefits
- Convert OpenAI SDK code
- Handle breaking changes
- Test migrated code

**Script Outline:**
1. Why Migrate? (2 min)
   - Provider independence
   - Automatic fallbacks
   - Cost optimization
   - Better observability

2. Code Conversion (4 min)
   - Before: OpenAI SDK code
   - After: ai.matey equivalent
   - Side-by-side comparison
   - Common patterns

3. Handling Differences (2 min)
   - IR format vs OpenAI format
   - Response structure changes
   - Error handling changes

4. Testing Migration (2 min)
   - Test equivalence
   - Compare outputs
   - Verify behavior

5. Gradual Migration (2 min)
   - Migrate incrementally
   - Run in parallel
   - Feature flags
   - Rollback plan

**Code Examples:**
```typescript
// BEFORE: OpenAI SDK
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello!' },
  ],
  temperature: 0.7,
  max_tokens: 100,
});

console.log(completion.choices[0].message.content);

// AFTER: ai.matey.universal
import { Bridge, OpenAIBackendAdapter } from 'ai.matey.universal';

const bridge = new Bridge(
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY })
);

const response = await bridge.execute({
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'Hello!' }] },
  ],
  parameters: {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 100,
  },
  metadata: {
    requestId: 'migration-test-1',
    timestamp: Date.now(),
  },
});

console.log(response.message.content[0].text);
```

**Visual Aids:**
- Side-by-side code comparison
- Migration checklist
- Decision tree: Should I migrate?

---

## Quick Tips and Recipes Series (6 videos, 3-5 min each)

### 35-40: Short-Form Content

**35. Quick Start: 5 Minutes to Your First AI Request** (3 min)
- Install
- Basic code
- Run

**36. Smart Model Selection with 3 Lines of Code** (4 min)
- Enable capability routing
- Set optimization
- Done

**37. Stream Responses Like a Pro** (4 min)
- Enable streaming
- Handle chunks
- Display in UI

**38. Implement Fallbacks in 2 Minutes** (3 min)
- Register multiple backends
- Set fallback strategy
- Automatic failover

**39. Track Costs with One Line of Code** (3 min)
- Add cost tracking middleware
- View costs
- Set budget

**40. Debug Any Issue Fast** (5 min)
- Enable debug mode
- Read logs
- Fix common issues

---

## Bonus: Behind the Scenes (2 videos)

### 41. ai.matey.universal Architecture Deep Dive
**Duration:** 18-22 minutes
**Target Audience:** Contributors, advanced developers
**Difficulty:** Advanced

**Learning Objectives:**
- Understand internal architecture
- Explore codebase structure
- Learn design decisions
- Contribute to project

**Script Outline:**
1. High-Level Architecture (3 min)
2. IR System Design (3 min)
3. Adapter Architecture (3 min)
4. Router Implementation (3 min)
5. Middleware Pipeline (3 min)
6. Testing Strategy (2 min)
7. Contributing Guide (3 min)

---

### 42. Roadmap and Future Features
**Duration:** 10-12 minutes
**Target Audience:** All users
**Difficulty:** Beginner

**Learning Objectives:**
- Upcoming features in v0.4.0-v0.6.0
- Community feedback
- How to request features
- How to contribute

**Script Outline:**
1. v0.4.0 Preview (3 min)
   - Debug mode
   - Performance profiling
   - OpenTelemetry
   - Test helpers

2. v0.5.0 and Beyond (3 min)
   - Prompt templates
   - Built-in RAG
   - Vector store integration
   - Multi-modal support

3. Community Involvement (2 min)
   - Request features
   - Report bugs
   - Contribute code
   - Join Discord

4. Production Readiness (2 min)
   - Current status
   - Stability guarantees
   - Enterprise features

---

## Summary

**Total Videos:** 42
**Total Duration:** ~9-10 hours of content
**Target Audiences:** Beginners to Advanced
**Topics Covered:**
- Getting started (5 videos)
- Core features (10 videos)
- Advanced topics (8 videos)
- Integrations (6 videos)
- Optimization (5 videos)
- Quick tips (6 videos)
- Bonus (2 videos)

Each synopsis includes:
- Clear duration estimate
- Target audience
- Difficulty level
- Detailed learning objectives
- Complete script outline
- Code examples
- Visual aids suggestions

This comprehensive tutorial series will cover every aspect of ai.matey.universal from beginner basics to advanced production deployment patterns.
