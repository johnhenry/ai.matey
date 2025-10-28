/**
 * Bridge Implementation
 *
 * The Bridge connects frontend and backend adapters with middleware support.
 * It's the main entry point for making requests through the universal adapter system.
 *
 * @module
 */

import type {
  FrontendAdapter,
  BackendAdapter,
  InferFrontendRequest,
  InferFrontendResponse,
  InferFrontendStreamChunk,
} from '../types/adapters.js';
import type { IRChatRequest, IRChatResponse, IRMessage } from '../types/ir.js';
import type {
  BridgeConfig,
  RequestOptions,
  Bridge as IBridge,
} from '../types/bridge.js';
import type { Middleware } from '../types/middleware.js';
import type {
  ListModelsOptions,
  ListModelsResult,
} from '../types/models.js';
import type {
  ExtractionMode,
  GenerateObjectResult,
} from '../structured/types.js';
import { MiddlewareStack, createMiddlewareContext, createStreamingMiddlewareContext } from './middleware-stack.js';
import { AdapterError, ErrorCode, ValidationError } from '../errors/index.js';
import { validateIRChatRequest } from '../utils/validation.js';
import { extractMarkdownJSON, parsePartialJSON, deepMerge } from '../structured/json-parser.js';
import { isZodSchema } from '../structured/schema-converter.js';

// ============================================================================
// Bridge Implementation
// ============================================================================

/**
 * Bridge connects frontend and backend adapters.
 *
 * @template TFrontend Frontend adapter type
 */
export class Bridge<TFrontend extends FrontendAdapter = FrontendAdapter>
  implements IBridge<TFrontend>
{
  readonly frontend: TFrontend;
  readonly backend: BackendAdapter;
  readonly config: BridgeConfig;
  private middlewareStack: MiddlewareStack;

  /**
   * Create a new Bridge instance.
   *
   * @param frontend Frontend adapter
   * @param backend Backend adapter
   * @param config Bridge configuration
   */
  constructor(
    frontend: TFrontend,
    backend: BackendAdapter,
    config: Partial<BridgeConfig> = {}
  ) {
    this.frontend = frontend;
    this.backend = backend;
    this.config = {
      debug: config.debug ?? false,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 0,
      autoRequestId: config.autoRequestId ?? true,
      defaultModel: config.defaultModel,
      routerConfig: config.routerConfig,
      custom: config.custom,
    };
    this.middlewareStack = new MiddlewareStack();
  }

  /**
   * Safely get frontend name for error messages.
   * Returns 'none' if frontend is not set.
   */
  private getFrontendName(): string {
    return this.frontend?.metadata?.name ?? 'none';
  }

  // ==========================================================================
  // Core Request Methods
  // ==========================================================================

  /**
   * Execute a non-streaming chat completion request.
   */
  async chat(
    request: InferFrontendRequest<TFrontend>,
    options?: RequestOptions
  ): Promise<InferFrontendResponse<TFrontend>> {
    try {
      // Step 1: Convert frontend request to IR
      const irRequest = await this.frontend.toIR(request as any);

      // Step 2: Ensure metadata has requestId and timestamp
      const enrichedRequest = this.enrichRequest(irRequest, options);

      // Step 3: Validate IR request
      validateIRChatRequest(enrichedRequest, {
        frontend: this.getFrontendName(),
      });

      // Step 4: Create middleware context
      const context = createMiddlewareContext(
        enrichedRequest,
        this.config as Record<string, unknown>,
        options?.signal
      );

      // Step 5: Execute middleware stack + backend
      const irResponse = await this.middlewareStack.execute(context, async () => {
        // Call backend adapter
        return await this.backend.execute(enrichedRequest, options?.signal);
      });

      // Step 6: Enrich response with provenance
      const enrichedResponse = this.enrichResponse(irResponse, enrichedRequest);

      // Step 7: Convert IR response to frontend format
      const frontendResponse = await this.frontend.fromIR(enrichedResponse);

      return frontendResponse as InferFrontendResponse<TFrontend>;
    } catch (error) {
      // Re-throw adapter errors, wrap others
      if (error instanceof AdapterError) {
        throw error;
      }

      throw new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Bridge execution failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        cause: error instanceof Error ? error : undefined,
        provenance: {},
      });
    }
  }

  /**
   * Execute a streaming chat completion request.
   */
  async *chatStream(
    request: InferFrontendRequest<TFrontend>,
    options?: RequestOptions
  ): AsyncGenerator<InferFrontendStreamChunk<TFrontend>, void, undefined> {
    try {
      // Step 1: Convert frontend request to IR
      const irRequest = await this.frontend.toIR(request as any);

      // Step 2: Ensure streaming is enabled
      const streamingRequest: IRChatRequest = {
        ...irRequest,
        stream: true,
      };

      // Step 3: Ensure metadata has requestId and timestamp
      const enrichedRequest = this.enrichRequest(streamingRequest, options);

      // Step 4: Validate IR request
      validateIRChatRequest(enrichedRequest, {
        frontend: this.getFrontendName(),
      });

      // Step 5: Create streaming middleware context
      const context = createStreamingMiddlewareContext(
        enrichedRequest,
        this.config as Record<string, unknown>,
        options?.signal
      );

      // Step 6: Execute middleware stack + backend
      const irStream = await this.middlewareStack.executeStream(context, async () => {
        // Call backend adapter streaming
        return this.backend.executeStream(enrichedRequest, options?.signal);
      });

      // Step 7: Convert IR stream to frontend format
      const frontendStream = this.frontend.fromIRStream(irStream);

      // Step 8: Yield chunks to caller
      for await (const chunk of frontendStream) {
        yield chunk as InferFrontendStreamChunk<TFrontend>;
      }
    } catch (error) {
      // Re-throw adapter errors, wrap others
      if (error instanceof AdapterError) {
        throw error;
      }

      throw new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Bridge streaming failed: ${error instanceof Error ? error.message : String(error)}`,
        isRetryable: false,
        cause: error instanceof Error ? error : undefined,
        provenance: {},
      });
    }
  }

  // ==========================================================================
  // Structured Output (Zod Integration)
  // ==========================================================================

  /**
   * Generate a structured object with Zod validation via Bridge.
   *
   * This method provides a convenient way to get structured output
   * from the LLM with automatic schema validation. The schema flows
   * through the IR and is handled by the backend adapter.
   *
   * Works with routing and middleware - the schema is passed through
   * the IR pipeline.
   *
   * @param options Options for structured generation
   * @returns Promise resolving to validated object with metadata
   *
   * @example
   * ```typescript
   * import { z } from 'zod'
   *
   * const PersonSchema = z.object({
   *   name: z.string(),
   *   age: z.number(),
   *   email: z.string().email()
   * })
   *
   * const result = await bridge.generateObject({
   *   schema: PersonSchema,
   *   messages: [{ role: 'user', content: 'Extract info: John Doe, 30, john@example.com' }],
   *   mode: 'tools'
   * })
   *
   * console.log(result.data) // Fully typed as { name: string; age: number; email: string }
   * ```
   */
  async generateObject<T = any>(options: {
    schema: any;
    messages: readonly IRMessage[];
    model?: string;
    mode?: ExtractionMode;
    name?: string;
    description?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
    requestOptions?: RequestOptions;
  }): Promise<GenerateObjectResult<T>> {
    const {
      schema,
      messages,
      model,
      mode = 'tools',
      name = 'extract',
      description,
      temperature = 0.0,
      maxTokens,
      signal,
      requestOptions,
    } = options;

    const startTime = Date.now();

    try {
      // Validate schema is a Zod schema
      if (!isZodSchema(schema)) {
        throw new ValidationError({
          code: ErrorCode.INVALID_PARAMETERS,
          message: 'Invalid schema: expected Zod schema with .parse() and .safeParse() methods.\n' +
            'Make sure you are passing a Zod schema instance (e.g., z.object({...}))',
          validationDetails: [{
            field: 'schema',
            value: schema,
            reason: 'Expected Zod schema with .parse() and .safeParse() methods',
          }],
        });
      }

      // Build IR request with schema
      const irRequest: IRChatRequest = {
        messages,
        parameters: {
          model: model || this.config.defaultModel,
          temperature,
          maxTokens,
        },
        stream: false,
        schema: {
          type: 'zod',
          schema,
          mode,
          name,
          description,
          validate: true,
        },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: Date.now(),
          provenance: {},
        },
      };

      // Enrich request
      const enrichedRequest = this.enrichRequest(irRequest, requestOptions);

      // Validate IR request
      validateIRChatRequest(enrichedRequest, {
        frontend: this.getFrontendName(),
      });

      // Create middleware context
      const context = createMiddlewareContext(
        enrichedRequest,
        this.config as Record<string, unknown>,
        signal
      );

      // Execute middleware stack + backend
      const irResponse = await this.middlewareStack.execute(context, async () => {
        return await this.backend.execute(enrichedRequest, signal);
      });

      // Extract JSON content based on mode
      let jsonContent: string;
      const content = irResponse.message.content;

      // Validate content exists
      if (!content) {
        throw new ValidationError({
          code: ErrorCode.INVALID_MESSAGE_FORMAT,
          message: 'No content in response message. The model may not have generated any output.',
          validationDetails: [{
            field: 'content',
            value: content,
            reason: 'Response message has no content',
          }],
        });
      }

      if (mode === 'tools') {
        // Extract from tool call arguments, with fallback to content
        try {
          jsonContent = this.extractToolArguments(irResponse, name);
        } catch (toolError) {
          // Fallback: try to extract JSON from content if tool call failed
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          jsonContent = extractMarkdownJSON(contentStr);
        }
      } else if (mode === 'md_json') {
        // Extract from markdown code block
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        jsonContent = extractMarkdownJSON(contentStr);
      } else {
        // Direct JSON content (json or json_schema modes)
        jsonContent = typeof content === 'string' ? content : JSON.stringify(content);
      }

      // Parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (parseError) {
        throw new AdapterError({
          code: ErrorCode.INTERNAL_ERROR,
          message: `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}\nRaw content: ${jsonContent.substring(0, 200)}...`,
          provenance: {
            frontend: this.getFrontendName(),
            backend: this.backend.metadata.name,
          },
        });
      }

      // Validate with Zod schema
      let validated: T;
      const warnings: string[] = [];

      try {
        validated = schema.parse(parsed) as T;
      } catch (validationError: any) {
        // Collect validation errors
        if (validationError.errors) {
          for (const error of validationError.errors) {
            warnings.push(
              `Validation error at ${error.path.join('.')}: ${error.message}`
            );
          }
        }

        throw new ValidationError({
          code: ErrorCode.INVALID_REQUEST,
          message: `Schema validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
          validationDetails: warnings.map((w) => ({
            field: 'schema',
            value: parsed,
            reason: w,
            expected: 'Valid data matching schema',
          })),
          provenance: {
            frontend: this.getFrontendName(),
            backend: this.backend.metadata.name,
          },
        });
      }

      // Build result
      const result: GenerateObjectResult<T> = {
        data: validated,
        raw: jsonContent,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          model: irResponse.metadata.providerResponseId || model || 'unknown',
          finishReason: irResponse.finishReason,
          usage: irResponse.usage
            ? {
                promptTokens: irResponse.usage.promptTokens,
                completionTokens: irResponse.usage.completionTokens,
                totalTokens: irResponse.usage.totalTokens,
              }
            : undefined,
          responseId: irResponse.metadata.providerResponseId,
          latencyMs: Date.now() - startTime,
        },
      };

      return result;
    } catch (error) {
      // Re-throw adapter errors
      if (error instanceof AdapterError) {
        throw error;
      }

      throw new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `generateObject failed: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          frontend: this.getFrontendName(),
          backend: this.backend.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Generate a structured object with streaming and partial validation.
   *
   * Returns an async generator that yields progressively more complete
   * partial objects as the model generates the response.
   *
   * The final yield is the fully validated object.
   *
   * @param options Options for structured streaming generation
   * @returns Async generator yielding partial objects, final value is complete object
   *
   * @example
   * ```typescript
   * const stream = bridge.generateObjectStream({
   *   schema: RecipeSchema,
   *   messages: [{ role: 'user', content: 'Recipe for cookies' }],
   *   onPartial: (partial) => {
   *     console.log('Progress:', partial)
   *   }
   * })
   *
   * for await (const partial of stream) {
   *   updateUI(partial) // Update UI with progressive data
   * }
   * ```
   */
  async *generateObjectStream<T = any>(options: {
    schema: any;
    messages: readonly IRMessage[];
    model?: string;
    mode?: ExtractionMode;
    name?: string;
    description?: string;
    temperature?: number;
    maxTokens?: number;
    onPartial?: (partial: Partial<T>) => void;
    signal?: AbortSignal;
    requestOptions?: RequestOptions;
  }): AsyncGenerator<Partial<T>, T, undefined> {
    const {
      schema,
      messages,
      model,
      mode = 'tools',
      name = 'extract',
      description,
      temperature = 0.0,
      maxTokens,
      onPartial,
      signal,
      requestOptions,
    } = options;

    try {
      // Validate schema is a Zod schema
      if (!isZodSchema(schema)) {
        throw new ValidationError({
          code: ErrorCode.INVALID_PARAMETERS,
          message: 'Invalid schema: expected Zod schema with .parse() and .safeParse() methods.\n' +
            'Make sure you are passing a Zod schema instance (e.g., z.object({...}))',
          validationDetails: [{
            field: 'schema',
            value: schema,
            reason: 'Expected Zod schema with .parse() and .safeParse() methods',
          }],
        });
      }

      // Build streaming IR request with schema
      const irRequest: IRChatRequest = {
        messages,
        parameters: {
          model: model || this.config.defaultModel,
          temperature,
          maxTokens,
        },
        stream: true,
        schema: {
          type: 'zod',
          schema,
          mode,
          name,
          description,
          validate: true,
        },
        metadata: {
          requestId: this.generateRequestId(),
          timestamp: Date.now(),
          provenance: {},
        },
      };

      // Enrich request
      const enrichedRequest = this.enrichRequest(irRequest, requestOptions);

      // Validate IR request
      validateIRChatRequest(enrichedRequest, {
        frontend: this.getFrontendName(),
      });

      // Create streaming middleware context
      const context = createStreamingMiddlewareContext(
        enrichedRequest,
        this.config as Record<string, unknown>,
        signal
      );

      // Execute middleware stack + backend
      const irStream = await this.middlewareStack.executeStream(context, async () => {
        return this.backend.executeStream(enrichedRequest, signal);
      });

      let fullContent = '';
      let lastParsedObject: any = undefined;

      for await (const chunk of irStream) {
        // Handle abort signal
        if (signal?.aborted) {
          break;
        }

        if (chunk.type === 'content' && chunk.delta) {
          fullContent += chunk.delta;

          // Try to parse partial JSON
          const parsed = parsePartialJSON(fullContent);

          if (parsed !== null) {
            // Merge with previous object for progressive updates
            lastParsedObject = lastParsedObject ? deepMerge(lastParsedObject, parsed) : parsed;

            // Try partial validation (schema.partial() if available)
            let partialObject: Partial<T> = lastParsedObject;

            try {
              // If schema has partial() method, use it for lenient validation
              if (typeof schema.partial === 'function') {
                const partialSchema = schema.partial();
                partialObject = partialSchema.parse(lastParsedObject);
              }
            } catch {
              // Partial validation failed, use unvalidated object
            }

            // Yield partial object
            yield partialObject;

            // Call onPartial callback
            if (onPartial) {
              onPartial(partialObject);
            }
          }
        }

        if (chunk.type === 'done') {
          // Final validation with full schema
          let finalObject: T;

          try {
            finalObject = schema.parse(lastParsedObject) as T;
          } catch (validationError) {
            throw new ValidationError({
              code: ErrorCode.INVALID_REQUEST,
              message: `Final schema validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
              validationDetails: [
                {
                  field: 'schema',
                  value: lastParsedObject,
                  reason: 'Failed to validate complete object',
                  expected: 'Valid data matching schema',
                },
              ],
              provenance: {
                frontend: this.getFrontendName(),
                backend: this.backend.metadata.name,
              },
            });
          }

          return finalObject;
        }

        if (chunk.type === 'error') {
          throw new AdapterError({
            code: ErrorCode.INTERNAL_ERROR,
            message: `Stream error: ${chunk.error.message}`,
            provenance: {
              frontend: this.getFrontendName(),
              backend: this.backend.metadata.name,
            },
          });
        }
      }

      // Stream ended without done chunk - validate what we have
      if (lastParsedObject) {
        const finalObject = schema.parse(lastParsedObject) as T;
        return finalObject;
      }

      throw new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Stream ended without generating valid object',
        provenance: {
          frontend: this.getFrontendName(),
          backend: this.backend.metadata.name,
        },
      });
    } catch (error) {
      // Re-throw adapter errors
      if (error instanceof AdapterError) {
        throw error;
      }

      throw new AdapterError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `generateObjectStream failed: ${error instanceof Error ? error.message : String(error)}`,
        provenance: {
          frontend: this.getFrontendName(),
          backend: this.backend.metadata.name,
        },
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  // ==========================================================================
  // Model Listing
  // ==========================================================================

  /**
   * List available models from the backend.
   *
   * This delegates directly to the backend adapter's listModels() method.
   * Useful for discovering available models before making requests.
   *
   * @param options Options for listing models (filtering, cache control)
   * @returns List of available models, or null if backend doesn't support listing
   */
  async listModels(options?: ListModelsOptions): Promise<ListModelsResult | null> {
    if (!this.backend.listModels) {
      return null; // Backend doesn't support model listing
    }

    return await this.backend.listModels(options);
  }

  /**
   * Check if a specific model is available from the backend.
   *
   * @param modelId Model identifier to check
   * @returns true if model is available, false otherwise
   */
  async hasModel(modelId: string): Promise<boolean> {
    const result = await this.listModels();
    if (!result) return true; // Can't check, assume available

    return result.models.some((m) => m.id === modelId);
  }

  /**
   * Validate that a model is available (optional safety check).
   *
   * Note: This is an optional validation - the system doesn't automatically
   * validate models since cross-provider translation is supported.
   *
   * @param modelId Model identifier to validate
   * @throws {ValidationError} If model is not available
   */
  async validateModel(modelId: string): Promise<void> {
    const available = await this.hasModel(modelId);
    if (!available) {
      throw new ValidationError({
        code: ErrorCode.UNSUPPORTED_MODEL,
        message: `Model "${modelId}" is not available from backend "${this.backend.metadata.name}"`,
        validationDetails: [
          {
            field: 'model',
            value: modelId,
            reason: `Model not available from backend "${this.backend.metadata.name}"`,
            expected: 'Available model ID from backend',
          },
        ],
        provenance: {
          frontend: this.getFrontendName(),
          backend: this.backend.metadata.name,
        },
      });
    }
  }

  // ==========================================================================
  // Middleware Management
  // ==========================================================================

  /**
   * Add middleware to the bridge's middleware stack.
   */
  use(middleware: Middleware): Bridge<TFrontend> {
    this.middlewareStack.use(middleware);
    return this;
  }

  /**
   * Remove middleware from the stack (not implemented for locked stacks).
   */
  removeMiddleware(_middleware: Middleware): Bridge<TFrontend> {
    throw new Error('removeMiddleware not yet implemented');
  }

  /**
   * Clear all middleware from the stack.
   */
  clearMiddleware(): Bridge<TFrontend> {
    this.middlewareStack.clear();
    return this;
  }

  /**
   * Get all middleware in the stack.
   */
  getMiddleware(): readonly Middleware[] {
    return this.middlewareStack.getMiddleware();
  }

  // ==========================================================================
  // Event Handling (Stub implementations)
  // ==========================================================================

  on(): Bridge<TFrontend> {
    throw new Error('Event handling not yet implemented');
  }

  off(): Bridge<TFrontend> {
    throw new Error('Event handling not yet implemented');
  }

  once(): Bridge<TFrontend> {
    throw new Error('Event handling not yet implemented');
  }

  // ==========================================================================
  // Statistics & Monitoring (Stub implementations)
  // ==========================================================================

  getStats(): any {
    throw new Error('Statistics not yet implemented');
  }

  resetStats(): void {
    throw new Error('Statistics not yet implemented');
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get router instance (returns null for basic Bridge).
   */
  getRouter(): null {
    return null;
  }

  /**
   * Clone bridge with new configuration.
   */
  clone(config: Partial<BridgeConfig>): Bridge<TFrontend> {
    return new Bridge(this.frontend, this.backend, {
      ...this.config,
      ...config,
    });
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    // Cleanup logic if needed
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Enrich request with metadata (requestId, timestamp, provenance) and apply defaults.
   */
  private enrichRequest(
    request: IRChatRequest,
    options?: RequestOptions
  ): IRChatRequest {
    // Always generate requestId if missing (frontend adapters should provide it)
    const requestId = request.metadata?.requestId || this.generateRequestId();

    const timestamp = request.metadata?.timestamp ?? Date.now();

    // Apply default model if not specified in request
    const model = request.parameters?.model || this.config.defaultModel;

    return {
      ...request,
      parameters: {
        ...request.parameters,
        ...(model && { model }),
      },
      metadata: {
        ...request.metadata,
        requestId,
        timestamp,
        provenance: {
          ...request.metadata?.provenance,
          frontend: this.getFrontendName(),
        },
        custom: {
          ...request.metadata?.custom,
          ...options?.metadata,
        },
      },
    };
  }

  /**
   * Enrich response with provenance and timing.
   */
  private enrichResponse(
    response: IRChatResponse,
    request: IRChatRequest
  ): IRChatResponse {
    return {
      ...response,
      metadata: {
        ...response.metadata,
        requestId: request.metadata.requestId,
        provenance: {
          ...response.metadata.provenance,
          frontend: this.getFrontendName(),
          backend: this.backend.metadata.name,
        },
      },
    };
  }

  /**
   * Generate unique request ID.
   */
  private generateRequestId(): string {
    // Use standard UUID v4 for request IDs
    return crypto.randomUUID();
  }

  /**
   * Extract tool call arguments from IR response.
   */
  private extractToolArguments(response: IRChatResponse, toolName: string): string {
    // Check if response has tool use content
    const content = response.message.content;

    if (Array.isArray(content)) {
      // Look for tool_use content type
      for (const block of content) {
        if (
          typeof block === 'object' &&
          block !== null &&
          'type' in block &&
          block.type === 'tool_use' &&
          'name' in block &&
          block.name === toolName &&
          'input' in block
        ) {
          return typeof block.input === 'string'
            ? block.input
            : JSON.stringify(block.input);
        }
      }
    }

    // Fallback: try to parse entire content as JSON
    if (typeof content === 'string') {
      return content;
    }

    return JSON.stringify(content);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Bridge instance.
 *
 * @param frontend Frontend adapter
 * @param backend Backend adapter
 * @param config Bridge configuration
 * @returns Bridge instance
 */
export function createBridge<TFrontend extends FrontendAdapter>(
  frontend: TFrontend,
  backend: BackendAdapter,
  config?: Partial<BridgeConfig>
): Bridge<TFrontend> {
  return new Bridge(frontend, backend, config);
}
