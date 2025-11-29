# Cloud AI Providers - Comprehensive API Research
## Research Date: October 26, 2025

This document contains comprehensive API information for 14 cloud AI providers to facilitate backend adapter creation.

---

## 1. Cohere

### API Documentation URL
- V2 API (Current): https://docs.cohere.com/v2/docs/chat-api
- API Reference: https://docs.cohere.com/reference/chat

### Base URL
```
https://api.cohere.ai
```

### Authentication Method
- Bearer token in Authorization header
- Header format: `Authorization: Bearer {api_key}`

### Chat Endpoint Path
```
POST /v2/chat
```

### Request Format
- Custom format (not OpenAI-compatible)
- Messages array with role-based structure
- Roles: `user`, `assistant`, `system`, `tool`

### Response Format
- Custom JSON format
- Finish reasons: `complete`, `max_tokens`, `stop_sequence`, `tool_call`

### Streaming Format
- Server-Sent Events (SSE)
- Accept header: `text/event-stream`
- Default delimiter: `\n`
- Events have `type` field, filter for `content-delta` events

### System Message Handling
- In-messages (V2 API)
- Pass as message object with `role: "system"` in messages array
- System message provides instructions model will prioritize over other roles

### Supported Parameters
- `messages` (required)
- `model` (required)
- `temperature` (0-2)
- `max_tokens`
- `stop_sequences`
- `frequency_penalty`
- `presence_penalty`
- `top_p`
- `top_k`
- `response_format` (supports `{"type": "json_object"}`)
- `stream` (boolean)

### Default Models Available
- `command-r-08-2024`
- `command-r-plus-08-2024`
- `command-a-03-2025` (strongest performing, latest)

### Pricing (per 1M tokens)
- **Command R**: $0.15 input / $0.60 output
- **Command R Fine-tuned**: $0.30 input / $1.20 output
- **Training**: $3.00 per 1M tokens

### Special Features/Quirks
- Built for long-context scenarios (RAG, API calling, chaining)
- Native tool calling support
- Up to 30% more text per token than other providers
- Forced JSON output via response_format

---

## 2. AI21 Labs

### API Documentation URL
- Main Docs: https://docs.ai21.com/home
- Jamba API: https://docs.ai21.com/docs/jamba-api

### Base URL
```
https://api.ai21.com/studio/v1
```

### Authentication Method
- API Key in header
- Header format: `Authorization: Bearer {api_key}`
- Can also use environment variable: `AI21_API_KEY`

### Chat Endpoint Path
```
POST /v1/chat/completions
```

### Request Format
- OpenAI-compatible
- Messages array with role/content structure

### Response Format
- OpenAI-compatible JSON
- Similar structure to OpenAI's chat completions

### Streaming Format
- Server-Sent Events (SSE)
- Set `stream: true` in request
- Final message: `data: [DONE]`
- Usage field null until last chunk

### System Message Handling
- In-messages
- Standard OpenAI format with `role: "system"`

### Supported Parameters
- `model` (required)
- `messages` (required)
- `temperature`
- `max_tokens`
- `top_p`
- `stop`
- `stream`
- `presence_penalty`
- `frequency_penalty`

### Default Models Available
- `jamba-1.5-mini`
- `jamba-1.5-large`
- `jamba-1.6-mini`

### Pricing (per 1M tokens)
- **Jamba 1.5 Mini**: $0.20 input / $0.40 output
- **Jamba 1.6 Mini**: $0.25 blended (3:1 ratio)
- **Jamba 1.5 Large**: $2.00 input / $8.00 output
- Blended (3:1): $3.50/1M tokens

### Special Features/Quirks
- Tokens are ~30% more text per token than competitors
- Potential 30% cost savings due to tokenization
- Available via Azure, AWS, Google Cloud with different pricing

---

## 3. Together AI

### API Documentation URL
- OpenAI Compatibility: https://docs.together.ai/docs/openai-api-compatibility
- Main Docs: https://docs.together.ai

### Base URL
```
https://api.together.xyz/v1
```

### Authentication Method
- API Key parameter
- Environment variable: `TOGETHER_API_KEY`
- Passed to OpenAI client as `api_key`

### Chat Endpoint Path
```
POST /v1/chat/completions
```

### Request Format
- OpenAI-compatible
- Drop-in replacement for OpenAI SDK

### Response Format
- OpenAI-compatible
- Identical structure to OpenAI responses

### Streaming Format
- Server-Sent Events (SSE)
- Set `stream: True` (Python) or `stream: true` (TypeScript)
- Identical to OpenAI streaming implementation

### System Message Handling
- In-messages
- Standard OpenAI format with system role

### Supported Parameters
- All OpenAI parameters supported:
  - `model`, `messages`, `temperature`, `max_tokens`
  - `top_p`, `frequency_penalty`, `presence_penalty`
  - `stop`, `stream`, `n`
- Extended features:
  - Vision models (image_url content)
  - Function calling with tools
  - Structured outputs (JSON schema)

### Default Models Available
- `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`
- `meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo`
- 200+ open-source models
- DeepSeek-R1
- Llama 4 variants
- Vision: Llama-4-Maverick
- Image gen: FLUX.1-dev
- TTS: Cartesia models

### Pricing (per 1M tokens)
- **Llama 3 8B Lite**: $0.10 per 1M tokens
- **DeepSeek-R1**: $3.00 input / $7.00 output
- **Budget tier**: Starting at $0.06 per 1M tokens
- Varies by model tier: Reference, Turbo, Lite

### Special Features/Quirks
- Drop-in OpenAI replacement
- 200+ models available
- Supports multimodal (vision, audio, images)
- Community-built OpenAI library compatible
- Three endpoint tiers with different pricing

---

## 4. Replicate

### API Documentation URL
- Main Docs: https://replicate.com/docs
- HTTP API: https://replicate.com/docs/reference/http

### Base URL
```
https://api.replicate.com/v1
```

### Authentication Method
- Bearer token in Authorization header
- Header format: `Authorization: Bearer {token}`
- Environment variable: `REPLICATE_API_TOKEN`

### Chat Endpoint Path
```
POST /v1/predictions
POST /v1/models/{owner}/{name}/predictions
```

### Request Format
- Custom (NOT OpenAI-compatible)
- Format:
  ```json
  {
    "version": "model-version-id",
    "input": {
      "prompt": "...",
      "other_params": "..."
    },
    "stream": true/false
  }
  ```

### Response Format
- Custom JSON prediction object
- Fields: `id`, `status`, `input`, `output`, `error`
- Timestamps: `created_at`, `started_at`, `completed_at`
- `urls` object with convenience links
- `metrics` for completed predictions

### Streaming Format
- Server-Sent Events (SSE)
- If model supports streaming, response includes `stream` URL in `urls` property
- 30 second timeout on event stream
- Timeout returns: "408: 408 Request Timeout"

### System Message Handling
- Model-dependent
- Passed as part of `input` object
- Not standardized across models

### Supported Parameters
- Model-specific via `input` object
- Common: `prompt`, `max_tokens`, `temperature`, `top_p`, `top_k`
- Optional: `webhook`, `webhook_events_filter`, `stream`
- Can use `Prefer: wait` header for synchronous mode (up to 60s)

### Default Models Available
- Meta Llama variants (2, 3, 3.1, 3.2, 4)
- Claude models (via Anthropic)
- Falcon, Vicuna, StableLM
- Many community fine-tuned models
- Access via owner/model-name format

### Pricing (per 1M tokens)
**Token-based models:**
- **Llama 3 70B**: $0.65 input / $2.75 output
- **Claude 3.7 Sonnet**: $3.00 input / $15.00 output
- **DeepSeek V3**: $1.45 input/output (combined)

**Time-based models:**
- T4 GPU: $0.000225 per second
- A100 GPU: $0.00115 per second

### Special Features/Quirks
- Hybrid pricing: some models by token, others by GPU time
- Predictions expire after 1 hour
- Interactive API playground for most models
- Deployment support for dedicated instances
- Custom model hosting available
- WebSocket alternative to SSE
- No standardized interface across models

---

## 5. AWS Bedrock

### API Documentation URL
- Converse API: https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html
- API Reference: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html
- ConverseStream: https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html

### Base URL
- Regional endpoints (varies by AWS region)
- Format: `https://bedrock-runtime.{region}.amazonaws.com`

### Authentication Method
- AWS Signature Version 4 (SigV4)
- Requires AWS credentials (access key, secret key, session token)
- Can use IAM roles, managed identities

### Chat Endpoint Path
```
POST /model/{modelId}/converse
POST /model/{modelId}/converse-stream
```

### Request Format
- AWS Bedrock custom format (NOT OpenAI-compatible)
- Unified interface across all Bedrock models
- Parameters:
  - `modelId` (required, in URL)
  - `messages` (required)
  - `system` (optional, separate parameter)
  - `inferenceConfig` (optional)
  - `additionalModelRequestFields` (optional, model-specific)

### Response Format
- AWS Bedrock custom JSON format
- Contains: `output`, `stopReason`, `usage`, `metrics`

### Streaming Format
- AWS event stream protocol
- Use ConverseStream endpoint
- Different from standard SSE
- Event-based chunks

### System Message Handling
- Separate parameter (NOT in messages array)
- `system` parameter accepts array of system prompts
- Distinct from user/assistant messages

### Supported Parameters
**inferenceConfig:**
- `temperature`
- `maxTokens`
- `topP`
- `stopSequences`

**Model-specific via additionalModelRequestFields**

### Default Models Available
- **Anthropic Claude**: 3 Haiku, 3 Sonnet, 3 Opus, 3.5 Sonnet
- **Meta Llama**: 3.1 (8B, 70B, 405B), 3.2, 3.3, 4 Maverick
- **Amazon Titan**
- **Cohere Command**
- **AI21 Jamba**
- **Mistral models**

### Pricing (per 1M tokens)
- **Claude 3 Haiku**: $0.25 input / $1.25 output
- **Llama 3.3 (70B)**: $0.72 input / $0.72 output
- **Llama 4 Maverick (17B)**: $0.24 input / $0.97 output
- **Batch inference**: Up to 50% discount
- **Provisioned Throughput**: Hourly pricing, 1-month or 6-month commitments

### Special Features/Quirks
- Unified API across all models
- Model-specific prompt templates auto-applied (Mistral, Meta)
- Supports tool use/function calling
- Guardrails integration
- Batch inference mode
- Provisioned throughput for consistent workloads
- Knowledge bases integration
- Agents framework

---

## 6. Azure OpenAI

### API Documentation URL
- REST API Reference: https://learn.microsoft.com/en-us/azure/ai-services/openai/reference
- Azure-specific docs: https://learn.microsoft.com/en-us/azure/api-management/api-management-authenticate-authorize-azure-openai

### Base URL
```
https://{your-resource-name}.openai.azure.com
```

### Authentication Method
**Two options:**

1. **API Key**: `api-key` HTTP header
2. **Microsoft Entra ID**: `Authorization: Bearer {token}` header

### Chat Endpoint Path
```
POST /openai/deployments/{deployment-id}/chat/completions?api-version={version}
```

### Request Format
- OpenAI-compatible with Azure extensions
- Use `deployment-id` instead of `model` parameter
- Required query parameter: `api-version`

### Response Format
- OpenAI-compatible
- Identical structure to OpenAI

### Streaming Format
- Server-Sent Events (SSE)
- Identical to OpenAI streaming
- Set `stream: true`

### System Message Handling
- In-messages
- Standard OpenAI format with system role

### Supported Parameters
- All standard OpenAI parameters
- Azure-specific extensions:
  - `data_sources` (for retrieval augmentation)
  - Azure-specific features for content filtering

### Default Models Available
- Deployment-based (not model-based)
- Available models for deployment:
  - GPT-4, GPT-4 Turbo
  - GPT-4o, GPT-4o mini
  - GPT-3.5 Turbo
  - GPT-4 Vision

### Pricing (per 1M tokens)
- **GPT-4 (Standard)**: $5 input / $15 output
- **GPT-4o mini**: $0.15 input / $0.60 output
- **Batch service**: 50% discount
- **Provisioned Throughput (PTUs)**: Monthly/annual reservations

### Special Features/Quirks
- Deployment-based model access (must create deployments)
- Resource-specific endpoints (not global)
- API version required in every request (YYYY-MM-DD format)
- Current GA: `2024-10-21`
- Microsoft Entra ID native support
- Content filtering built-in
- Azure-specific data residency guarantees
- Three separate API surfaces: control, authoring, inference

---

## 7. Cloudflare Workers AI

### API Documentation URL
- OpenAI Compatibility: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- Main Docs: https://developers.cloudflare.com/workers-ai/
- Pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/

### Base URL
```
https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1
```

**Via AI Gateway:**
```
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/workers-ai/v1
```

### Authentication Method
- Cloudflare API token as `apiKey`
- Account ID in base URL path

### Chat Endpoint Path
```
POST /v1/chat/completions
```

### Request Format
- OpenAI-compatible
- Just change base URL and model names

### Response Format
- OpenAI-compatible

### Streaming Format
- Server-Sent Events (SSE)
- Standard OpenAI streaming format

### System Message Handling
- In-messages
- Standard OpenAI format

### Supported Parameters
- All standard OpenAI parameters:
  - `temperature`, `max_tokens`, `top_p`
  - `frequency_penalty`, `presence_penalty`
- Function calling support
- Batch processing
- Multimodal inputs (vision models)

### Default Models Available
- `@cf/meta/llama-3.1-8b-instruct`
- `@cf/meta/llama-3.2-1b-instruct`
- `@cf/meta/llama-3.2-3b-instruct`
- `@cf/meta/llama-3.1-70b-instruct-fp8-fast`
- `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- `@cf/openai/gpt-oss-120b`
- Vision: `@cf/meta/llama-3.2-11b-vision-instruct`

### Pricing (per 1M tokens)
**Neuron-based pricing: $0.011 per 1,000 Neurons**
**Free tier: 10,000 Neurons/day**

**Token pricing examples:**
- **Llama 3.2 1B**: $0.027 input / $0.201 output
- **Llama 3.2 3B**: $0.051 input / $0.335 output
- **Llama 3.1 8B (fp8)**: $0.045 input / $0.384 output
- **Llama 3.2 11B Vision**: $0.049 input / $0.676 output
- **Llama 3.1 70B (fp8)**: $0.293 input / $2.253 output
- **Llama 3.3 70B (fp8)**: $0.293 input / $2.253 output

### Special Features/Quirks
- OpenAI-compatible with model name changes
- AI Gateway integration for routing/management
- Neuron-based pricing system (unique)
- Free tier available
- Model size-based pricing
- Workers integration (run on edge)
- Extremely low latency (edge deployment)

---

## 8. xAI (Grok)

### API Documentation URL
- Overview: https://docs.x.ai/docs/overview
- API Reference: https://docs.x.ai/docs/api-reference
- Models: https://docs.x.ai/docs/models

### Base URL
```
https://api.x.ai/v1
```

### Authentication Method
- Bearer token in Authorization header
- Header format: `Authorization: Bearer {api_key}`

### Chat Endpoint Path
```
POST /v1/chat/completions
```

### Request Format
- OpenAI-compatible
- Full REST API compatibility with OpenAI

### Response Format
- OpenAI-compatible

### Streaming Format
- Server-Sent Events (SSE)
- Standard OpenAI streaming format

### System Message Handling
- In-messages
- Standard OpenAI format

### Supported Parameters
- All standard OpenAI parameters
- Extended features:
  - Native tool use
  - Real-time search integration
  - Web search and X search
  - Code execution
  - 2M token context window

### Default Models Available
- `grok-4` (flagship, most intelligent)
- `grok-4-fast` (cost-efficient reasoning)
- `grok-4-fast-reasoning` (with reasoning mode)
- `grok-4-fast-non-reasoning`
- `grok-3` (enterprise-focused)
- `grok-3-mini` (speed & cost optimized)
- Knowledge cutoff: November 2024 (live search available)

### Pricing (per 1M tokens)
**Grok 4 & Grok 3:**
- Input: $3.00
- Output: $15.00
- Cached input: $0.75

**Grok 3 Mini:**
- Input: $0.30
- Output: $0.50

**Grok 4 Fast (New Oct 2025):**
- Input: $0.20
- Output: $0.50
- Cached input: $0.05

**Live Search API:**
- $25 per 1,000 sources (deprecated Dec 15, 2025)

### Special Features/Quirks
- OpenAI SDK compatible (just change baseURL)
- Real-time search integration (web + X/Twitter)
- Agentic server-side tools (web_search, x_search, code_execution)
- Trained on 200,000 GPU cluster (Colossus)
- 6x compute efficiency improvement
- Unified reasoning/non-reasoning architecture
- Native live search capabilities
- Access to X platform data

---

## 9. Perplexity AI

### API Documentation URL
- Chat Completions: https://docs.perplexity.ai/api-reference/chat-completions-post
- Reference: https://docs.perplexity.ai/reference/post_chat_completions
- Pricing: https://docs.perplexity.ai/getting-started/pricing

### Base URL
```
https://api.perplexity.ai
```

### Authentication Method
- HTTPBearer token
- Header format: `Authorization: Bearer {api_key}`

### Chat Endpoint Path
```
POST /chat/completions
```

### Request Format
- OpenAI-compatible with extensions
- Additional search-specific parameters

### Response Format
- OpenAI-compatible with extensions
- Additional fields:
  - `search_results` array
  - `videos` array
  - Citation tokens in usage

### Streaming Format
- Server-Sent Events (SSE)
- Set `stream: true`
- Incremental responses

### System Message Handling
- In-messages
- Standard role-based format

### Supported Parameters
**Standard:**
- `model`, `messages`, `temperature` (0-2, default 0.2)
- `top_p` (0-1, default 0.9), `top_k`
- `max_tokens`, `presence_penalty`, `frequency_penalty`
- `stream`

**Search-specific:**
- `search_mode`: "academic", "sec", "web" (default)
- `disable_search`: Boolean
- `enable_search_classifier`: Boolean (let model decide)
- `search_domain_filter`: Array (max 20, "-" prefix for deny)
- `search_recency_filter`: "week", "day", etc.
- `search_after_date_filter`, `search_before_date_filter`
- `last_updated_after_filter`, `last_updated_before_filter`
- Date format: %m/%d/%Y

**Media:**
- `return_images`, `return_related_questions`
- `media_response.overrides`: videos/images config
- `language_preference`: Response language

**Reasoning:**
- `reasoning_effort`: low/medium/high (for deep-research)

**Web search options:**
- `search_context_size`: low/medium/high
- User location: latitude, longitude, country, region, city

### Default Models Available
- `sonar` (base search model)
- `sonar-pro` (detailed answers, more citations)
- `sonar-reasoning`
- `sonar-reasoning-pro`
- `sonar-deep-research`

### Pricing (per 1M tokens)
**Sonar (Base):**
- $1 input / $1 output
- Plus $5 per 1,000 searches

**Sonar Pro:**
- $3 input / $15 output
- Plus $5 per 1,000 searches

**Sonar Reasoning:**
- $1 input / $5 output
- Plus $5-12 per 1,000 requests

**Sonar Reasoning Pro:**
- $2 input / $8 output
- Plus $6-14 per 1,000 requests

**Sonar Deep Research:**
- $2 input / $8 output
- Plus $5 per 1,000 searches
- Plus $3 per 1M reasoning tokens

**Pro subscribers:** $5 monthly API credit

### Special Features/Quirks
- Real-time web search with citations
- Search mode specialization (academic, SEC filings)
- Domain filtering (allow/deny lists)
- Temporal filtering (date ranges, recency)
- Media responses (videos, images)
- Search classifier (auto-detect when search needed)
- Related questions generation
- Geolocation-aware search
- Lowest-cost AI search API claim
- Citation tracking in token usage

---

## 10. Cerebras

### API Documentation URL
- Chat Completions: https://inference-docs.cerebras.ai/api-reference/chat-completions
- Main Docs: https://inference-docs.cerebras.ai

### Base URL
```
https://api.cerebras.ai/v1
```

### Authentication Method
- Bearer token in Authorization header
- Environment variable: `CEREBRAS_API_KEY`

### Chat Endpoint Path
```
POST /v1/chat/completions
```

### Request Format
- OpenAI-compatible

### Response Format
- OpenAI-compatible

### Streaming Format
- Server-Sent Events (SSE)
- Set `stream: true`
- Partial message deltas
- Note: Streaming incompatible with JSON mode

### System Message Handling
- In-messages
- Standard OpenAI format

### Supported Parameters
- `messages` (required)
- `model` (required)
- `max_completion_tokens`
- `response_format`: JSON schema or JSON object
- `reasoning_effort`: low/medium/high (gpt-oss-120b only)
- `seed`: Deterministic sampling
- `temperature`, `top_p`
- `tools`, `tool_choice`: Function calling
- `stream`
- `logprobs`, `top_logprobs`
- `user`: End-user identifier

### Default Models Available
- `llama-4-scout-17b-16e-instruct`
- `llama3.1-8b`
- `llama-3.3-70b`
- `qwen-3-32b`
- `qwen-3-235b-a22b-instruct-2507` (preview)
- `qwen-3-235b-a22b-thinking-2507` (preview)
- `qwen-3-coder-480b` (preview)
- `gpt-oss-120b`

### Pricing (per 1M tokens)
**Generally Available:**
- **Llama 3.1 8B**: $0.10 per 1M tokens
- **Llama 3.1 70B**: $0.60 per 1M tokens

**Llama 3.1 405B (Q1 2025 GA):**
- $6 input / $12 output

**Pricing Tiers:**
- Free Tier: Free API access with generous limits
- Developer Tier: Serverless, pay-as-you-go (prices above)
- Enterprise Tier: Custom pricing

### Special Features/Quirks
- World's fastest inference speeds (claimed)
- Built on specialized AI hardware (not GPU-based)
- Structured outputs with JSON schema
- Reasoning effort control
- Deterministic sampling via seed
- Token probability outputs (logprobs)
- Free tier available
- 969 tokens/s for Llama 405B
- Function calling support
- Incompatibility: streaming + JSON mode

---

## 11. OpenRouter

### API Documentation URL
- API Reference: https://openrouter.ai/docs/api-reference/overview
- Authentication: https://openrouter.ai/docs/api-reference/authentication
- Quickstart: https://openrouter.ai/docs/quickstart

### Base URL
```
https://openrouter.ai/api/v1
```

### Authentication Method
- Bearer token in Authorization header
- Header format: `Authorization: Bearer {api_key}`

### Chat Endpoint Path
```
POST /api/v1/chat/completions
```

### Request Format
- OpenAI-compatible
- Schema normalized across models

### Response Format
- OpenAI-compatible
- Normalized across providers

### Streaming Format
- Server-Sent Events (SSE)
- Set `stream: true`
- All models support streaming

### System Message Handling
- In-messages
- Standard OpenAI format
- Assistant prefill: Add assistant message at end of messages array

### Supported Parameters
**Required:**
- `messages` or `prompt`

**Optional:**
- `model` (uses user default if unspecified)
- `max_tokens`, `temperature`, `stop`, `stream`
- `response_format` (JSON, limited model support)
- `tools`, `tool_choice` (function calling)
- `top_p`, `top_k`
- `frequency_penalty`, `presence_penalty`
- `seed`, `logit_bias`
- Provider routing parameters
- Model preference parameters

### Default Models Available
- 100+ models from multiple providers
- OpenAI: GPT-4, GPT-3.5
- Anthropic: Claude variants
- Meta: Llama variants
- Google: Gemini, PaLM
- Mistral, Cohere, and many more

### Pricing (per 1M tokens)
- **Pass-through pricing**: No markup on model costs
- **Credit purchase fee**: 5.5% ($0.80 minimum)
- **Crypto payment fee**: 5%
- Model-specific examples:
  - Qwen3 Max: $1.60 input / $6.40 output
  - Range: Free to $100+ per 1M tokens
- Output typically 2-5x more than input
- Billing based on native token counts

### Special Features/Quirks
- Unified interface to 100+ models
- Automatic model routing and fallbacks
- No markup on provider pricing (just credit purchase fee)
- Schema normalization across providers
- Provider preference specification
- Assistant prefill support
- Cost tracking via /api/v1/generation endpoint
- API keys with credit limits
- OAuth flows supported
- GitHub secret scanning partner

---

## 12. Fireworks AI

### API Documentation URL
- Chat Completions: https://docs.fireworks.ai/api-reference/post-chatcompletions
- OpenAI Compatibility: https://fireworks.ai/docs/tools-sdks/openai-compatibility
- Pricing: https://fireworks.ai/pricing

### Base URL
```
https://api.fireworks.ai/inference/v1
```

### Authentication Method
- Bearer token in Authorization header
- Header format: `Authorization: Bearer {token}`

### Chat Endpoint Path
```
POST /inference/v1/chat/completions
```

### Request Format
- OpenAI-compatible
- Drop-in replacement for OpenAI SDK

### Response Format
- OpenAI-compatible
- Usage stats in both streaming and non-streaming
- Streaming: usage in last chunk with finish_reason

### Streaming Format
- Server-Sent Events (SSE)
- Set `stream: true`
- Terminated with `[DONE]`

### System Message Handling
- In-messages
- Standard OpenAI format

### Supported Parameters
**Core:**
- `model` (required)
- `messages` (required)
- `max_tokens` (default: 2000)
- `temperature` (0-2, default: 1)
- `top_p` (0-1, default: 1)
- `top_k` (0-100)
- `stop` (up to 4 sequences)
- `stream`

**Advanced:**
- `tools`, `tool_choice` (function calling)
- `response_format`: JSON mode or JSON schema
- `min_p`, `typical_p`, `top_logprobs`
- `frequency_penalty`, `presence_penalty`, `repetition_penalty`
- `logprobs` (boolean or 0-5 integer)
- `reasoning_effort`: none/low/medium/high (for reasoning models)

### Default Models Available
- `accounts/fireworks/models/llama-v3p1-8b-instruct`
- Llama variants (many sizes)
- DeepSeek v3
- Qwen models
- Stable Diffusion (image generation)
- 100+ open-source models

### Pricing (per 1M tokens)
**Llama 4 Maverick:**
- $0.27 input / $0.85 output

**General structure:**
- Small models (<4B params): Starting at $0.10
- Large/specialized: Up to $3.00

**Batch inference:** 50% of serverless pricing

### Special Features/Quirks
- OpenAI-compatible
- Fastest model APIs (claimed)
- 100+ open-source models
- Function calling support
- JSON schema validation
- Reasoning effort control
- Usage stats always returned (even streaming)
- Batch inference 50% discount
- Image generation support
- Fine-tuning available

---

## 13. Anyscale

### API Documentation URL
- Main Docs: https://docs.anyscale.com
- Endpoints: https://www.anyscale.com/endpoints
- OpenAI Integration: https://docs.anyscale.com/examples/work-with-openai

### Base URL
```
https://api.endpoints.anyscale.com/v1
```

### Authentication Method
- API token
- Environment variable: `ANYSCALE_ENDPOINT_TOKEN`
- Passed to OpenAI client as `api_key`

### Chat Endpoint Path
```
POST /v1/chat/completions
```

### Request Format
- OpenAI-compatible
- Use OpenAI SDK with different base_url

### Response Format
- OpenAI-compatible

### Streaming Format
- Server-Sent Events (SSE)
- Set `stream: True`
- Standard OpenAI streaming format

### System Message Handling
- In-messages
- Standard OpenAI format with system role

### Supported Parameters
- All standard OpenAI parameters
- `model`, `messages`, `temperature`
- `max_tokens`, `top_p`, `stream`
- `response_format` (JSON mode with optional schema)
- `tools`, `tool_choice` (function calling)

### Default Models Available
- `meta-llama/Llama-2-70b-chat-hf`
- `meta-llama/Meta-Llama-3-70B-Instruct`
- Various Llama variants
- Open-source LLMs

### Pricing (per 1M tokens)
- **Llama-2 70B and similar**: ~$1.00 per 1M tokens
- **~50% lower cost than OpenAI GPT-3.5**
- As of June 2024: Integrated into Anyscale Platform

### Special Features/Quirks
- **Important**: As of August 1, 2024, exclusively available through fully Hosted Anyscale Platform
- Multi-tenant access removed
- OpenAI-compatible SDK
- JSON mode with schema support
- Function calling support
- Fine-tuning capabilities
- Private endpoints (self-hosted LLMs)
- Deployment in customer's own cloud (AWS/GCP)
- Built on Ray framework
- High availability and fault tolerance

**Status Note:** Service transitioned from standalone endpoints to platform-only access in mid-2024

---

## 14. DeepInfra

### API Documentation URL
- OpenAI API: https://deepinfra.com/docs/openai_api
- Main Docs: https://deepinfra.com/docs/inference
- API Reference: https://deepinfra.com/docs/deep_infra_api

### Base URL
```
https://api.deepinfra.com/v1/openai
```

### Authentication Method
- API key parameter
- Set when initializing client as `api_key`
- DeepInfra token required

### Chat Endpoint Path
```
POST /v1/openai/chat/completions
```

### Request Format
- OpenAI-compatible
- "The easiest to use" (per docs)

### Response Format
- OpenAI-compatible
- Includes `estimated_cost` field in usage

### Streaming Format
- Server-Sent Events (SSE)
- Fully supported
- Token usage tracking in streamed responses

### System Message Handling
- In-messages
- Standard OpenAI format (system, user, assistant roles)

### Supported Parameters
- `model` (including version/deploy_id)
- `messages`
- `max_tokens`, `temperature`, `top_p`
- `stream`, `stop`, `n`
- `presence_penalty`, `frequency_penalty`
- `response_format` (JSON mode)
- `tools`, `tool_choice`

### Default Models Available
- All LLM models available
- Meta-Llama variants
- DeepSeek models
- OpenChat
- GLM models
- Embedding models

### Pricing (per 1M tokens)
**Examples:**
- **DeepSeek models**: $0.40-$1.00 output
- **deepseek-chat-v3.1**: $0.30 input / $1.00 output
- **DeepSeek V3**: $1.45 input/output

**Structure:**
- Pay-as-you-go
- No long-term contracts
- No upfront fees
- Output: $0.40-$3.00 per 1M tokens (varies by model)
- Per-token pricing
- `estimated_cost` returned in responses

### Special Features/Quirks
- OpenAI-compatible
- "Change model and it continues working"
- Low pay-as-you-go pricing
- Cost estimation in response
- Supports HTTP/cURL, Python, JavaScript
- Token usage tracking in streams
- All LLM models accessible via one API
- Embedding models included
- No minimum commitments

---

## Summary Comparison Table

| Provider | Base URL | Auth Method | OpenAI Compatible | Streaming | Price Range (per 1M tokens) |
|----------|----------|-------------|-------------------|-----------|----------------------------|
| Cohere | api.cohere.ai | Bearer | No (Custom) | SSE | $0.15-$0.60 |
| AI21 Labs | api.ai21.com | Bearer | Yes | SSE | $0.20-$8.00 |
| Together AI | api.together.xyz | API Key | Yes | SSE | $0.06-$7.00 |
| Replicate | api.replicate.com | Bearer | No (Custom) | SSE | $0.65-$15.00 or time-based |
| AWS Bedrock | Regional endpoints | AWS SigV4 | No (Custom) | AWS Events | $0.24-$1.25 |
| Azure OpenAI | {resource}.openai.azure.com | API Key or Entra | Yes | SSE | $0.15-$15.00 |
| Cloudflare | api.cloudflare.com | API Token | Yes | SSE | $0.027-$2.253 |
| xAI | api.x.ai | Bearer | Yes | SSE | $0.20-$15.00 |
| Perplexity | api.perplexity.ai | Bearer | Yes + Extensions | SSE | $1-$15 + search fees |
| Cerebras | api.cerebras.ai | Bearer | Yes | SSE | $0.10-$12.00 |
| OpenRouter | openrouter.ai | Bearer | Yes | SSE | Pass-through + 5.5% fee |
| Fireworks | api.fireworks.ai | Bearer | Yes | SSE | $0.10-$3.00 |
| Anyscale | api.endpoints.anyscale.com | API Token | Yes | SSE | ~$1.00 (Platform only) |
| DeepInfra | api.deepinfra.com | API Key | Yes | SSE | $0.40-$3.00 |

---

## Implementation Priority Recommendations

### Tier 1 (Highest Priority - OpenAI Compatible)
1. **Together AI** - Drop-in OpenAI replacement, 200+ models
2. **Fireworks AI** - Fast, OpenAI compatible, wide model selection
3. **DeepInfra** - Simple, cost-effective, OpenAI compatible
4. **xAI** - Premium models, OpenAI compatible, unique features
5. **Cerebras** - Ultra-fast inference, OpenAI compatible

### Tier 2 (Medium Priority - Mostly Compatible)
6. **Azure OpenAI** - Enterprise-grade, deployment-based
7. **Cloudflare Workers AI** - Edge deployment, low latency
8. **Perplexity** - Unique search capabilities, OpenAI + extensions
9. **OpenRouter** - Meta-provider, unified access to 100+ models
10. **AI21 Labs** - OpenAI compatible, unique tokenization

### Tier 3 (Lower Priority - Custom Integration)
11. **Cohere** - Custom API, unique features, good documentation
12. **AWS Bedrock** - Enterprise, unified API, requires AWS SDK
13. **Anyscale** - Platform access only, limited availability
14. **Replicate** - Highly custom, per-model variability

---

## Common Adapter Patterns

### Pattern 1: Pure OpenAI Compatible
**Providers**: Together AI, Fireworks, DeepInfra, Cerebras, xAI, AI21 Labs, Cloudflare

**Implementation**:
- Use OpenAI SDK with different `base_url`
- Simple credential swap
- Minimal transformation needed

### Pattern 2: OpenAI + Extensions
**Providers**: Azure OpenAI, Perplexity, OpenRouter

**Implementation**:
- Base on OpenAI format
- Add provider-specific parameters
- Handle additional response fields

### Pattern 3: Custom API
**Providers**: Cohere, AWS Bedrock, Replicate

**Implementation**:
- Full custom request/response mapping
- Provider-specific authentication
- Model-specific handling

---

## Notes on Implementation

1. **Streaming**: All providers support SSE except AWS Bedrock (uses AWS event stream)
2. **System Messages**: Most use in-message format, except AWS Bedrock (separate parameter)
3. **Authentication**: Mostly Bearer tokens, except AWS (SigV4) and Cloudflare (API token)
4. **Pricing**: Varies dramatically (100x difference between cheapest and most expensive)
5. **Context Windows**: Not detailed here but varies significantly by model
6. **Rate Limits**: Not researched but important for production

---

## Research Methodology

This research was conducted on October 26, 2025 using:
- Official provider documentation
- Web searches for current pricing
- API reference pages
- Community resources and third-party integrations

All information is subject to change. Verify current details before implementation.
