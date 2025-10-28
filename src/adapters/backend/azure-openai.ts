/**
 * Azure OpenAI Backend Adapter
 *
 * Adapts Universal IR to Azure OpenAI Chat Completions API.
 * Azure OpenAI is OpenAI-compatible with enterprise features and deployment-based routing.
 *
 * @module
 */

import type { BackendAdapter, BackendAdapterConfig, AdapterMetadata } from '../../types/adapters.js';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRMessage,
  IRStreamChunk,
  FinishReason,
  MessageContent,
} from '../../types/ir.js';
import {
  AdapterConversionError,
  NetworkError,
  ProviderError,
  StreamError,
  ErrorCode,
  createErrorFromHttpResponse,
} from '../../errors/index.js';
import { normalizeSystemMessages } from '../../utils/system-message.js';
import {
  getEffectiveStreamMode,
  mergeStreamingConfig,
} from '../../utils/streaming-modes.js';
import { convertZodToJsonSchema } from '../../structured/schema-converter.js';

// ============================================================================
// Azure OpenAI API Types (OpenAI-compatible with Azure extensions)
// ============================================================================

export type AzureOpenAIMessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
    >;

export interface AzureOpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: AzureOpenAIMessageContent;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface AzureOpenAIRequest {
  messages: AzureOpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
  seed?: number;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
  tool_choice?: { type: 'function'; function: { name: string } } | 'auto' | 'none';
  response_format?: { type: 'json_object' } | { type: 'json_schema'; json_schema: { name: string; schema: any; strict?: boolean } };
  // Note: model is NOT sent in Azure OpenAI requests (deployment is in URL)
}

export interface AzureOpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: AzureOpenAIMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
    content_filter_results?: any;  // Azure content filtering
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AzureOpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
    content_filter_results?: any;
  }>;
}

export interface AzureOpenAIConfig extends BackendAdapterConfig {
  resourceName?: string;      // Azure resource name
  deploymentId?: string;       // Azure deployment ID
  apiVersion?: string;         // Azure API version (default: '2024-02-15-preview')
}

// ============================================================================
// Azure OpenAI Backend Adapter
// ============================================================================

/**
 * Backend adapter for Azure OpenAI Chat Completions API.
 *
 * Features:
 * - OpenAI-compatible with deployment-based routing
 * - Enterprise features (SLA, private endpoints, VNet)
 * - Content filtering (configurable)
 * - Vision model support
 * - Function calling support
 * - Seed support for reproducibility
 * - Enterprise pricing with consumption-based billing
 */
export class AzureOpenAIBackendAdapter implements BackendAdapter<AzureOpenAIRequest, AzureOpenAIResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: AzureOpenAIConfig;
  private readonly resourceName: string;
  private readonly deploymentId: string;
  private readonly apiVersion: string;
  private readonly baseURL: string;

  constructor(config: AzureOpenAIConfig) {
    this.config = config;

    // Extract Azure-specific config
    this.resourceName = config.resourceName || '';
    this.deploymentId = config.deploymentId || config.defaultModel || 'gpt-4o';
    this.apiVersion = config.apiVersion || '2024-02-15-preview';

    // Construct base URL from resource name or use provided baseURL
    if (config.baseURL) {
      this.baseURL = config.baseURL;
    } else if (this.resourceName) {
      this.baseURL = `https://${this.resourceName}.openai.azure.com`;
    } else {
      throw new AdapterConversionError({
        code: ErrorCode.ADAPTER_CONVERSION_ERROR,
        message: 'Azure OpenAI requires either baseURL or resourceName in config',
        provenance: { backend: 'azure-openai-backend' },
      });
    }

    this.metadata = {
      name: 'azure-openai-backend',
      version: '1.0.0',
      provider: 'Azure OpenAI',
      capabilities: {
        streaming: true,
        multiModal: true,  // Vision models available
        tools: true,       // Function calling
        maxContextTokens: 128000,
        systemMessageStrategy: 'in-messages',
        supportsMultipleSystemMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: true,
        supportsFrequencyPenalty: true,
        supportsPresencePenalty: true,
        maxStopSequences: 4,
      },
      config: {
        baseURL: this.baseURL,
        resourceName: this.resourceName,
        deploymentId: this.deploymentId,
        apiVersion: this.apiVersion,
      },
    };
  }

  /**
   * Get deployment ID from request or config.
   */
  private getDeploymentId(request: IRChatRequest): string {
    return request.parameters?.model || this.deploymentId;
  }

  /**
   * Build endpoint URL for a specific deployment.
   */
  private buildEndpointURL(deploymentId: string, endpoint: string): string {
    return `${this.baseURL}/openai/deployments/${deploymentId}${endpoint}?api-version=${this.apiVersion}`;
  }

  /**
   * Convert IR to Azure OpenAI format.
   */
  public fromIR(request: IRChatRequest): AzureOpenAIRequest {
    const { messages } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    const azureMessages: AzureOpenAIMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((block) => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text };
            } else if (block.type === 'image') {
              return {
                type: 'image_url',
                image_url: {
                  url: block.source.type === 'url'
                    ? block.source.url
                    : `data:${block.source.mediaType};base64,${block.source.data}`,
                  detail: 'auto'
                }
              };
            }
            return { type: 'text', text: JSON.stringify(block) };
          }),
    }));

    const azureRequest: AzureOpenAIRequest = {
      messages: azureMessages,
      temperature: request.parameters?.temperature,
      max_tokens: request.parameters?.maxTokens,
      top_p: request.parameters?.topP,
      frequency_penalty: request.parameters?.frequencyPenalty,
      presence_penalty: request.parameters?.presencePenalty,
      stop: request.parameters?.stopSequences ? [...request.parameters.stopSequences] : undefined,
      stream: request.stream || false,
    };

    // Add seed if provided
    if (request.parameters?.seed !== undefined) {
      azureRequest.seed = request.parameters.seed;
    }

    // Handle schema-based structured output
    if (request.schema) {
      const schema = request.schema;
      const mode = schema.mode || 'tools';
      const name = schema.name || 'extract';
      const description = schema.description || `Extract structured data matching the ${name} schema`;

      // Convert Zod schema to JSON Schema
      let jsonSchema: any;
      if (schema.type === 'zod') {
        jsonSchema = convertZodToJsonSchema(schema.schema);
      } else {
        jsonSchema = schema.schema;
      }

      if (mode === 'tools') {
        // Use Azure OpenAI's tool calling (same as OpenAI)
        azureRequest.tools = [{
          type: 'function',
          function: {
            name,
            description,
            parameters: jsonSchema,
          },
        }];
        // Force tool use
        azureRequest.tool_choice = { type: 'function', function: { name } };
      } else if (mode === 'json_schema') {
        // Use Azure OpenAI's strict JSON schema mode
        azureRequest.response_format = {
          type: 'json_schema',
          json_schema: {
            name,
            schema: jsonSchema,
            strict: true,
          },
        };
      } else if (mode === 'json') {
        // Use Azure OpenAI's JSON object mode
        azureRequest.response_format = { type: 'json_object' };

        // Add schema to system message for context
        const schemaMessage: AzureOpenAIMessage = {
          role: 'system',
          content: `You must respond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`,
        };
        azureRequest.messages.unshift(schemaMessage);
      } else if (mode === 'md_json') {
        // Add markdown JSON instruction to system message
        const mdJsonMessage: AzureOpenAIMessage = {
          role: 'system',
          content: `Respond with JSON in a markdown code block:\n\`\`\`json\n...\n\`\`\`\n\nThe JSON must match this schema:\n${JSON.stringify(jsonSchema, null, 2)}`,
        };
        azureRequest.messages.unshift(mdJsonMessage);
      }
    }

    return azureRequest;
  }

  /**
   * Convert Azure OpenAI response to IR.
   */
  public toIR(response: AzureOpenAIResponse, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: 'No choices returned in response',
        isRetryable: false,
        provenance: { backend: this.metadata.name },
      });
    }

    const message: IRMessage = {
      role: choice.message.role === 'assistant' ? 'assistant' : 'user',
      content: typeof choice.message.content === 'string'
        ? choice.message.content
        : choice.message.content.map((c: any) => c.type === 'text' ? c.text : '').join(''),
    };

    const finishReasonMap: Record<string, FinishReason> = {
      'stop': 'stop',
      'length': 'length',
      'tool_calls': 'tool_calls',
      'content_filter': 'stop',  // Map content_filter to stop
    };

    return {
      message,
      finishReason: finishReasonMap[choice.finish_reason || 'stop'] || 'stop',
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      metadata: {
        ...originalRequest.metadata,
        providerResponseId: response.id,
        provenance: {
          ...originalRequest.metadata.provenance,
          backend: this.metadata.name,
        },
        custom: {
          ...originalRequest.metadata.custom,
          latencyMs,
          ...(choice.content_filter_results ? { azure_content_filter: choice.content_filter_results } : {}),
        },
      },
      raw: response as unknown as Record<string, unknown>,
    };
  }

  /**
   * Execute non-streaming request.
   */
  async execute(request: IRChatRequest, signal?: AbortSignal): Promise<IRChatResponse> {
    try {
      const azureRequest = this.fromIR(request);
      azureRequest.stream = false;

      const deploymentId = this.getDeploymentId(request);
      const url = this.buildEndpointURL(deploymentId, '/chat/completions');

      const startTime = Date.now();
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(azureRequest),
        signal,
      });

      if (!response.ok) {
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          await response.text(),
          { backend: this.metadata.name }
        );
      }

      const data = (await response.json()) as AzureOpenAIResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `Azure OpenAI request failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Execute streaming request.
   */
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      const azureRequest = this.fromIR(request);
      azureRequest.stream = true;

      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      const deploymentId = this.getDeploymentId(request);
      const url = this.buildEndpointURL(deploymentId, '/chat/completions');

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(azureRequest),
        signal,
      });

      if (!response.ok) {
        throw createErrorFromHttpResponse(
          response.status,
          response.statusText,
          await response.text(),
          { backend: this.metadata.name }
        );
      }

      if (!response.body) {
        throw new StreamError({
          code: ErrorCode.STREAM_ERROR,
          message: 'No response body',
          provenance: { backend: this.metadata.name },
        });
      }

      let sequence = 0;
      let contentBuffer = '';

      // Tool call buffering for structured output
      const toolCallsBuffer = new Map<number, {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>();
      const toolCallsYieldedLength = new Map<number, number>();
      let doneEmitted = false; // Prevent multiple done chunks

      yield {
        type: 'start',
        sequence: sequence++,
        metadata: {
          ...request.metadata,
          provenance: {
            ...request.metadata.provenance,
            backend: this.metadata.name,
          },
        },
      } as IRStreamChunk;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;

            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const chunk = JSON.parse(data) as AzureOpenAIStreamChunk;
              const choice = chunk.choices[0];
              if (!choice) continue;

              // Handle content delta
              const delta = choice.delta?.content;
              if (delta) {
                contentBuffer += delta;

                const contentChunk: IRStreamChunk = {
                  type: 'content',
                  sequence: sequence++,
                  delta: delta,
                  role: 'assistant',
                };

                if (includeBoth) {
                  (contentChunk as any).accumulated = contentBuffer;
                }

                yield contentChunk;
              }

              // Handle tool call deltas for structured output
              if (choice.delta?.tool_calls) {
                for (const toolCallDelta of choice.delta.tool_calls) {
                  const index = toolCallDelta.index;
                  const existingCall = toolCallsBuffer.get(index);
                  const argumentsDelta = toolCallDelta.function?.arguments || '';

                  if (!existingCall) {
                    // Initialize new tool call
                    toolCallsBuffer.set(index, {
                      id: toolCallDelta.id || '',
                      type: 'function',
                      function: {
                        name: toolCallDelta.function?.name || '',
                        arguments: argumentsDelta,
                      },
                    });
                    toolCallsYieldedLength.set(index, 0);
                  } else {
                    // Accumulate deltas
                    if (argumentsDelta) {
                      existingCall.function.arguments += argumentsDelta;
                    }
                    if (toolCallDelta.function?.name) {
                      existingCall.function.name += toolCallDelta.function.name;
                    }
                  }

                  // Yield only new delta as content (for structured output parsing)
                  if (argumentsDelta) { // Process ALL tool calls
                    const toolCall = toolCallsBuffer.get(index)!;
                    const previousLength = toolCallsYieldedLength.get(index) || 0;
                    const currentLength = toolCall.function.arguments.length;
                    const newDelta = toolCall.function.arguments.substring(previousLength);

                    if (newDelta) {
                      toolCallsYieldedLength.set(index, currentLength);
                      yield {
                        type: 'content',
                        sequence: sequence++,
                        delta: newDelta,
                        role: 'assistant',
                      };
                    }
                  }
                }
              }

              if (choice.finish_reason && !doneEmitted) {
                doneEmitted = true;
                const finishReasonMap: Record<string, FinishReason> = {
                  'stop': 'stop',
                  'length': 'length',
                  'tool_calls': 'tool_calls',
                  'content_filter': 'stop',
                };

                // Build final message content
                let messageContent: string | MessageContent[];
                if (toolCallsBuffer.size > 0) {
                  // Include tool calls in message
                  const contentBlocks: MessageContent[] = [];

                  for (const [_index, toolCall] of toolCallsBuffer.entries()) {
                    try {
                      const input = JSON.parse(toolCall.function.arguments);
                      contentBlocks.push({
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall.function.name,
                        input,
                      });
                    } catch {
                      // If JSON parse fails, use raw string
                      contentBlocks.push({
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall.function.name,
                        input: { raw: toolCall.function.arguments },
                      });
                    }
                  }

                  messageContent = contentBlocks;
                } else {
                  messageContent = contentBuffer;
                }

                const doneChunk: IRStreamChunk = {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: finishReasonMap[choice.finish_reason] || 'stop',
                  message: { role: 'assistant', content: messageContent },
                };

                // Include content filter results if present
                if (choice.content_filter_results) {
                  (doneChunk as any).azure_content_filter = choice.content_filter_results;
                }

                yield doneChunk;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE chunk:', data, parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
        // Clear buffers to prevent memory leaks
        contentBuffer = '';
        toolCallsBuffer.clear();
        toolCallsYieldedLength.clear();
      }
    } catch (error) {
      yield {
        type: 'error',
        sequence: 0,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      } as IRStreamChunk;
    }
  }

  /**
   * Get HTTP headers.
   * Azure uses api-key header instead of Authorization Bearer.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.config.apiKey,  // Azure-specific header
    };

    return { ...headers, ...this.config.headers };
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Azure doesn't have a /models endpoint; we'll check a specific deployment
      const url = this.buildEndpointURL(this.deploymentId, '/chat/completions');

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost.
   * Azure pricing varies by region and deployment.
   * These are approximate US East costs.
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 2.50, output: 10.00 },
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-35-turbo': { input: 0.50, output: 1.50 },
    };

    const deploymentId = this.getDeploymentId(request);
    const modelPricing = pricing[deploymentId];

    if (!modelPricing) {
      return null;
    }

    const inputTokens = request.messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return sum + Math.ceil(content.length / 4);
    }, 0);

    const outputTokens = request.parameters?.maxTokens || 1024;

    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return inputCost + outputCost;
  }
}
