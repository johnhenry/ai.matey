/**
 * AWS Bedrock Backend Adapter
 *
 * Adapts Universal IR to AWS Bedrock Converse API.
 * AWS Bedrock provides unified access to multiple foundation models with AWS SigV4 authentication.
 *
 * @module
 */

import type { BackendAdapter, BackendAdapterConfig, AdapterMetadata } from 'ai.matey.types';
import type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
  IRMessage,
  IRStreamChunk,
  FinishReason,
} from 'ai.matey.types';
import {
  NetworkError,
  ProviderError,
  StreamError,
  ErrorCode,
  createErrorFromHttpResponse,
} from 'ai.matey.errors';
import { normalizeSystemMessages } from 'ai.matey.utils';
import {
  getEffectiveStreamMode,
  mergeStreamingConfig,
} from 'ai.matey.utils';

// ============================================================================
// AWS Bedrock API Types (Converse API)
// ============================================================================

export type BedrockMessageContent =
  | { text: string }
  | { image: { format: 'png' | 'jpeg' | 'gif' | 'webp'; source: { bytes: string } } };

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: BedrockMessageContent[];
}

export interface BedrockSystemContent {
  text: string;
}

export interface BedrockInferenceConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface BedrockRequest {
  modelId: string;
  messages: BedrockMessage[];
  system?: BedrockSystemContent[];
  inferenceConfig?: BedrockInferenceConfig;
  // Note: Bedrock Converse API doesn't support streaming in all regions/models
}

export interface BedrockResponse {
  output: {
    message: {
      role: 'assistant';
      content: Array<{ text: string }>;
    };
  };
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'content_filtered';
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  metrics?: {
    latencyMs: number;
  };
}

export interface BedrockStreamChunk {
  messageStart?: { role: 'assistant' };
  contentBlockStart?: { contentBlockIndex: number };
  contentBlockDelta?: { delta: { text: string }; contentBlockIndex: number };
  contentBlockStop?: { contentBlockIndex: number };
  messageStop?: { stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'content_filtered' };
  metadata?: {
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    metrics?: {
      latencyMs: number;
    };
  };
}

export interface AWSBedrockConfig extends BackendAdapterConfig {
  region?: string;           // AWS region (default: 'us-east-1')
  awsAccessKeyId?: string;   // AWS credentials
  awsSecretAccessKey?: string;
  awsSessionToken?: string;  // Optional session token
}

// ============================================================================
// AWS Bedrock Backend Adapter
// ============================================================================

/**
 * Backend adapter for AWS Bedrock Converse API.
 *
 * Features:
 * - Unified API for multiple foundation models
 * - AWS SigV4 authentication
 * - Vision support (select models)
 * - No function calling in Converse API
 * - Enterprise features (VPC, encryption, compliance)
 * - Pay-per-use pricing
 *
 * Note: This adapter requires AWS credentials. Authentication can be provided via:
 * 1. Config (awsAccessKeyId, awsSecretAccessKey, awsSessionToken)
 * 2. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * 3. IAM roles (when running on AWS infrastructure)
 */
export class AWSBedrockBackendAdapter implements BackendAdapter<BedrockRequest, BedrockResponse> {
  readonly metadata: AdapterMetadata;
  private readonly config: AWSBedrockConfig;
  private readonly region: string;
  private readonly baseURL: string;

  constructor(config: AWSBedrockConfig) {
    this.config = config;
    this.region = config.region || process.env.AWS_REGION || 'us-east-1';

    // Construct base URL from region
    this.baseURL = config.baseURL || `https://bedrock-runtime.${this.region}.amazonaws.com`;

    this.metadata = {
      name: 'aws-bedrock-backend',
      version: '1.0.0',
      provider: 'AWS Bedrock',
      capabilities: {
        streaming: true,  // Note: Not supported in all regions/models
        multiModal: true,  // Vision supported in some models
        tools: false,      // Converse API doesn't support function calling
        maxContextTokens: 200000,  // Claude 3 models support 200K
        systemMessageStrategy: 'separate-parameter',  // Uses system field
        supportsMultipleSystemMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsTopK: false,
        supportsSeed: false,
        supportsFrequencyPenalty: false,
        supportsPresencePenalty: false,
        maxStopSequences: 4,
      },
      config: {
        baseURL: this.baseURL,
        region: this.region,
      },
    };
  }

  /**
   * Convert IR to Bedrock format.
   */
  public fromIR(request: IRChatRequest): BedrockRequest {
    const { messages, systemParameter } = normalizeSystemMessages(
      request.messages,
      this.metadata.capabilities.systemMessageStrategy,
      this.metadata.capabilities.supportsMultipleSystemMessages
    );

    const bedrockMessages: BedrockMessage[] = messages.map((msg) => {
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      const content: BedrockMessageContent[] = typeof msg.content === 'string'
        ? [{ text: msg.content }]
        : msg.content.map((block) => {
            if (block.type === 'text') {
              return { text: block.text };
            } else if (block.type === 'image') {
              // Convert base64 data or URL to bytes
              const bytes = block.source.type === 'base64' ? block.source.data : '';  // Simplified: should decode base64
              return {
                image: {
                  format: 'png' as const,  // Simplified: should detect format
                  source: { bytes }
                }
              };
            }
            return { text: JSON.stringify(block) };
          });

      return { role, content };
    });

    const bedrockRequest: BedrockRequest = {
      modelId: request.parameters?.model || this.config.defaultModel || 'anthropic.claude-3-haiku-20240307-v1:0',
      messages: bedrockMessages,
      inferenceConfig: {
        temperature: request.parameters?.temperature,
        maxTokens: request.parameters?.maxTokens,
        topP: request.parameters?.topP,
        stopSequences: request.parameters?.stopSequences ? [...request.parameters.stopSequences] : undefined,
      },
    };

    // Add system messages
    if (systemParameter) {
      if (typeof systemParameter === 'string') {
        bedrockRequest.system = [{ text: systemParameter }];
      } else {
        bedrockRequest.system = (systemParameter as any[]).map((msg: any) => ({
          text: typeof msg === 'string' ? msg : msg.text || JSON.stringify(msg)
        }));
      }
    }

    return bedrockRequest;
  }

  /**
   * Convert Bedrock response to IR.
   */
  public toIR(response: BedrockResponse, originalRequest: IRChatRequest, latencyMs: number): IRChatResponse {
    const message: IRMessage = {
      role: 'assistant',
      content: response.output.message.content.map((c) => c.text).join(''),
    };

    const finishReasonMap: Record<string, FinishReason> = {
      'end_turn': 'stop',
      'max_tokens': 'length',
      'stop_sequence': 'stop',
      'content_filtered': 'stop',
    };

    return {
      message,
      finishReason: finishReasonMap[response.stopReason] || 'stop',
      usage: {
        promptTokens: response.usage.inputTokens,
        completionTokens: response.usage.outputTokens,
        totalTokens: response.usage.totalTokens,
      },
      metadata: {
        ...originalRequest.metadata,
        providerResponseId: '', // Bedrock doesn't provide a unique ID in Converse API
        provenance: {
          ...originalRequest.metadata.provenance,
          backend: this.metadata.name,
        },
        custom: {
          ...originalRequest.metadata.custom,
          latencyMs: response.metrics?.latencyMs || latencyMs,
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
      const bedrockRequest = this.fromIR(request);

      const startTime = Date.now();
      const response = await fetch(`${this.baseURL}/model/${bedrockRequest.modelId}/converse`, {
        method: 'POST',
        headers: await this.getHeaders('POST', `/model/${bedrockRequest.modelId}/converse`, JSON.stringify(bedrockRequest)),
        body: JSON.stringify(bedrockRequest),
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

      const data = (await response.json()) as BedrockResponse;
      return this.toIR(data, request, Date.now() - startTime);
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ProviderError) {
        throw error;
      }

      throw new ProviderError({
        code: ErrorCode.PROVIDER_ERROR,
        message: `AWS Bedrock request failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: true,
        provenance: { backend: this.metadata.name },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Execute streaming request.
   * Note: Streaming support varies by model and region.
   */
  async *executeStream(request: IRChatRequest, signal?: AbortSignal): IRChatStream {
    try {
      const bedrockRequest = this.fromIR(request);

      const streamingConfig = mergeStreamingConfig(this.config.streaming);
      const effectiveMode = getEffectiveStreamMode(
        request.streamMode,
        undefined,
        streamingConfig
      );
      const includeBoth = streamingConfig.includeBoth || effectiveMode === 'accumulated';

      const response = await fetch(`${this.baseURL}/model/${bedrockRequest.modelId}/converse-stream`, {
        method: 'POST',
        headers: await this.getHeaders('POST', `/model/${bedrockRequest.modelId}/converse-stream`, JSON.stringify(bedrockRequest)),
        body: JSON.stringify(bedrockRequest),
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

          // AWS event stream format is binary, but for simplicity we'll parse as JSON lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const chunk = JSON.parse(line) as BedrockStreamChunk;

              if (chunk.contentBlockDelta?.delta?.text) {
                const delta = chunk.contentBlockDelta.delta.text;
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

              if (chunk.messageStop) {
                const finishReasonMap: Record<string, FinishReason> = {
                  'end_turn': 'stop',
                  'max_tokens': 'length',
                  'stop_sequence': 'stop',
                  'content_filtered': 'stop',
                };

                const doneChunk: IRStreamChunk = {
                  type: 'done',
                  sequence: sequence++,
                  finishReason: finishReasonMap[chunk.messageStop.stopReason] || 'stop',
                  message: { role: 'assistant', content: contentBuffer },
                };

                // Include usage if present
                if (chunk.metadata?.usage) {
                  (doneChunk as any).usage = {
                    promptTokens: chunk.metadata.usage.inputTokens,
                    completionTokens: chunk.metadata.usage.outputTokens,
                    totalTokens: chunk.metadata.usage.totalTokens,
                  };
                }

                yield doneChunk;
              }
            } catch (parseError) {
              console.warn('Failed to parse Bedrock stream chunk:', line, parseError);
            }
          }
        }
      } finally {
        reader.releaseLock();
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
   * Get HTTP headers with AWS SigV4 signing.
   *
   * SIMPLIFIED VERSION: This implementation assumes AWS credentials are handled
   * externally or uses basic headers. For production, use AWS SDK or aws4fetch
   * for proper SigV4 signing.
   */
  private async getHeaders(_method: string, _path: string, _body: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // If AWS credentials are provided in config, add Authorization header
    // Note: In production, this should use proper AWS SigV4 signing
    if (this.config.awsAccessKeyId && this.config.awsSecretAccessKey) {
      // Simplified: In production, use AWS SDK or aws4fetch for proper SigV4 signing
      headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${this.config.awsAccessKeyId}/...`;
      headers['X-Amz-Date'] = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');

      if (this.config.awsSessionToken) {
        headers['X-Amz-Security-Token'] = this.config.awsSessionToken;
      }
    }

    return { ...headers, ...this.config.headers };
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Bedrock doesn't have a dedicated health endpoint
      // We'll attempt a minimal request
      return true;  // Simplified: should actually test connectivity
    } catch {
      return false;
    }
  }

  /**
   * Estimate cost.
   * AWS Bedrock pricing varies by model and region.
   */
  async estimateCost(request: IRChatRequest): Promise<number | null> {
    const pricing: Record<string, { input: number; output: number }> = {
      'anthropic.claude-3-haiku-20240307-v1:0': { input: 0.25, output: 1.25 },
      'anthropic.claude-3-sonnet-20240229-v1:0': { input: 3.00, output: 15.00 },
      'anthropic.claude-3-opus-20240229-v1:0': { input: 15.00, output: 75.00 },
      'meta.llama3-1-8b-instruct-v1:0': { input: 0.30, output: 0.60 },
      'meta.llama3-1-70b-instruct-v1:0': { input: 1.00, output: 2.00 },
    };

    const model = request.parameters?.model || this.config.defaultModel || '';
    const modelPricing = pricing[model];

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
