/**
 * IR Chat Client
 *
 * An IR-native chat client that wraps the Bridge/BackendAdapter
 * with conversation state management, streaming helpers, and tool support.
 *
 * @module
 */

import type {
  IRMessage,
  IRChatRequest,
  IRChatResponse,
  IRUsage,
  MessageContent,
  ToolUseContent,
} from 'ai.matey.types';

import type {
  ChatConfig,
  ChatBackend,
  SendOptions,
  StreamOptions,
  ChatResponse,
  ToolCall,
  StreamChunkEvent,
  ConversationState,
  ChatEventType,
  ChatEventListener,
  ChatEvents,
} from './types.js';

// ============================================================================
// Chat Class
// ============================================================================

/**
 * Headless chat client with conversation state management.
 *
 * @example
 * ```typescript
 * import { Chat } from 'ai.matey.wrapper.ir';
 * import { AnthropicBackend } from 'ai.matey.backend.anthropic';
 *
 * const chat = new Chat({
 *   backend: new AnthropicBackend({ apiKey: process.env.ANTHROPIC_API_KEY }),
 *   systemPrompt: 'You are a helpful assistant.',
 *   historyLimit: 50,
 * });
 *
 * // Non-streaming
 * const response = await chat.send('Hello!');
 * console.log(response.content);
 *
 * // Streaming
 * await chat.stream('Tell me a story', {
 *   onChunk: ({ delta }) => process.stdout.write(delta),
 *   onDone: (response) => console.log('\n[Done]'),
 * });
 *
 * // Access state
 * console.log(chat.messages);
 * console.log(chat.totalUsage);
 * ```
 */
export class Chat {
  private readonly config: Required<
    Pick<ChatConfig, 'historyLimit' | 'autoExecuteTools' | 'maxToolRounds'>
  > &
    ChatConfig;
  private readonly backend: ChatBackend;

  // Conversation state
  private _messages: IRMessage[] = [];
  private _isLoading = false;
  private _error: Error | null = null;
  private _totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  private _requestCount = 0;

  // Event listeners
  private _listeners: Map<ChatEventType, Set<ChatEventListener>> = new Map();

  // Request counter for generating IDs
  private _requestIdCounter = 0;

  /**
   * Create a new Chat instance.
   */
  constructor(config: ChatConfig) {
    this.config = {
      ...config,
      historyLimit: config.historyLimit ?? 100,
      autoExecuteTools: config.autoExecuteTools ?? false,
      maxToolRounds: config.maxToolRounds ?? 10,
    };
    this.backend = config.backend;
  }

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  /**
   * Get all messages in the conversation.
   */
  get messages(): readonly IRMessage[] {
    return this._messages;
  }

  /**
   * Get whether a request is in progress.
   */
  get isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Get the current error, if any.
   */
  get error(): Error | null {
    return this._error;
  }

  /**
   * Get cumulative token usage.
   */
  get totalUsage(): Readonly<typeof this._totalUsage> {
    return this._totalUsage;
  }

  /**
   * Get the number of requests made.
   */
  get requestCount(): number {
    return this._requestCount;
  }

  /**
   * Get a snapshot of the conversation state.
   */
  get state(): ConversationState {
    return {
      messages: this._messages,
      isLoading: this._isLoading,
      error: this._error,
      totalUsage: { ...this._totalUsage },
      requestCount: this._requestCount,
    };
  }

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * Send a message and get a response (non-streaming).
   *
   * @param content - The message content (string or structured content)
   * @param options - Request options
   * @returns The assistant's response
   */
  async send(
    content: string | readonly MessageContent[],
    options?: SendOptions
  ): Promise<ChatResponse> {
    this.setLoading(true);
    this.setError(null);

    try {
      // Add user message to history
      const userMessage = this.createUserMessage(content);
      this.addMessage(userMessage);

      // Execute request with potential tool loop
      const response = await this.executeWithToolLoop(options);

      this.setLoading(false);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setError(err);
      this.setLoading(false);
      throw err;
    }
  }

  /**
   * Send a message and stream the response.
   *
   * @param content - The message content
   * @param options - Streaming options with callbacks
   * @returns The final response after streaming completes
   */
  async stream(
    content: string | readonly MessageContent[],
    options?: StreamOptions
  ): Promise<ChatResponse> {
    this.setLoading(true);
    this.setError(null);

    try {
      // Add user message to history
      const userMessage = this.createUserMessage(content);
      this.addMessage(userMessage);

      // Execute streaming request with potential tool loop
      const response = await this.executeStreamWithToolLoop(options);

      this.setLoading(false);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.setError(err);
      this.setLoading(false);
      options?.onError?.(err);
      throw err;
    }
  }

  /**
   * Add a message to the conversation without sending a request.
   * Useful for restoring conversation history or injecting context.
   */
  addMessage(message: IRMessage): void {
    this._messages.push(message);
    this.trimHistory();
    this.emitStateChange();
  }

  /**
   * Clear the conversation history.
   */
  clear(): void {
    this._messages = [];
    this._error = null;
    this._totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    this._requestCount = 0;
    this.emitStateChange();
  }

  /**
   * Remove the last N messages from the conversation.
   */
  removeLastMessages(count: number = 1): IRMessage[] {
    const removed = this._messages.splice(-count, count);
    this.emitStateChange();
    return removed;
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Subscribe to chat events.
   */
  on<K extends ChatEventType>(event: K, listener: ChatEventListener<ChatEvents[K]>): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener as ChatEventListener);

    // Return unsubscribe function
    return () => {
      this._listeners.get(event)?.delete(listener as ChatEventListener);
    };
  }

  /**
   * Unsubscribe from chat events.
   */
  off<K extends ChatEventType>(event: K, listener: ChatEventListener<ChatEvents[K]>): void {
    this._listeners.get(event)?.delete(listener as ChatEventListener);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async executeWithToolLoop(options?: SendOptions): Promise<ChatResponse> {
    let rounds = 0;

    while (rounds < this.config.maxToolRounds) {
      rounds++;

      const request = await this.buildRequest(options);
      const irResponse = await this.backend.execute(request, options?.signal);
      const response = this.processResponse(irResponse);

      // Add assistant message to history
      this.addMessage(irResponse.message);
      this.emit('message', { message: irResponse.message, response });

      // Check for tool calls
      if (
        response.toolCalls &&
        response.toolCalls.length > 0 &&
        this.config.autoExecuteTools &&
        this.config.onToolCall
      ) {
        // Execute tools and add results to history
        await this.executeToolCalls(response.toolCalls);
        // Continue the loop to get the next response
        continue;
      }

      return response;
    }

    throw new Error(`Max tool rounds (${this.config.maxToolRounds}) exceeded`);
  }

  private async executeStreamWithToolLoop(options?: StreamOptions): Promise<ChatResponse> {
    let rounds = 0;

    while (rounds < this.config.maxToolRounds) {
      rounds++;

      const request = await this.buildRequest(options);

      // Check if backend supports streaming
      if (!this.backend.executeStream) {
        // Fall back to non-streaming
        const irResponse = await this.backend.execute(request, options?.signal);
        const response = this.processResponse(irResponse);
        this.addMessage(irResponse.message);
        options?.onDone?.(response);
        return response;
      }

      const requestId = request.metadata.requestId;
      options?.onStart?.({ requestId });
      this.emit('stream-start', { requestId });

      let accumulated = '';
      let sequence = 0;
      let finalResponse: ChatResponse | null = null;
      const toolInputs: Map<string, string> = new Map();

      const stream = this.backend.executeStream(request, options?.signal);

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'content': {
            accumulated += chunk.delta;
            sequence = chunk.sequence;
            const event: StreamChunkEvent = {
              delta: chunk.delta,
              accumulated,
              sequence,
            };
            options?.onChunk?.(event);
            this.emit('stream-chunk', event);
            break;
          }

          case 'tool_use': {
            if (chunk.inputDelta) {
              const current = toolInputs.get(chunk.id) ?? '';
              toolInputs.set(chunk.id, current + chunk.inputDelta);
            }
            options?.onToolUse?.({
              id: chunk.id,
              name: chunk.name,
              input: toolInputs.get(chunk.id) ?? '',
            });
            break;
          }

          case 'done': {
            const message = chunk.message ?? {
              role: 'assistant' as const,
              content: accumulated,
            };

            finalResponse = {
              content: accumulated,
              message,
              finishReason: chunk.finishReason,
              usage: chunk.usage,
              toolCalls: this.extractToolCalls(message),
              requestId,
            };

            if (chunk.usage) {
              this.updateUsage(chunk.usage);
            }
            break;
          }

          case 'error': {
            throw new Error(chunk.error.message);
          }
        }
      }

      if (!finalResponse) {
        // Stream ended without done chunk - construct response from accumulated
        finalResponse = {
          content: accumulated,
          message: { role: 'assistant', content: accumulated },
          finishReason: 'stop',
          requestId,
        };
      }

      // Add assistant message to history
      this.addMessage(finalResponse.message);
      options?.onDone?.(finalResponse);
      this.emit('stream-done', { response: finalResponse });
      this.emit('message', { message: finalResponse.message, response: finalResponse });

      // Check for tool calls
      if (
        finalResponse.toolCalls &&
        finalResponse.toolCalls.length > 0 &&
        this.config.autoExecuteTools &&
        this.config.onToolCall
      ) {
        await this.executeToolCalls(finalResponse.toolCalls);
        continue;
      }

      return finalResponse;
    }

    throw new Error(`Max tool rounds (${this.config.maxToolRounds}) exceeded`);
  }

  private async executeToolCalls(toolCalls: readonly ToolCall[]): Promise<void> {
    if (!this.config.onToolCall) {
      return;
    }

    for (const tool of toolCalls) {
      const result = await this.config.onToolCall(tool.name, tool.input, tool.id);
      const content = typeof result === 'string' ? result : result.content;
      const isError = typeof result === 'object' ? result.isError : false;

      // Add tool result message
      const toolResultMessage: IRMessage = {
        role: 'tool',
        content: [
          {
            type: 'tool_result',
            toolUseId: tool.id,
            content,
            isError,
          },
        ],
      };

      this.addMessage(toolResultMessage);
    }
  }

  private async buildRequest(options?: SendOptions): Promise<IRChatRequest> {
    const messages = await this.getMessagesWithSystem();

    return {
      messages,
      parameters: {
        ...this.config.defaultParameters,
        ...options?.parameters,
      },
      tools: this.config.tools,
      metadata: {
        requestId: this.generateRequestId(),
        timestamp: Date.now(),
        custom: options?.metadata,
        provenance: {},
      },
    };
  }

  private async getMessagesWithSystem(): Promise<IRMessage[]> {
    const messages = [...this._messages];

    if (this.config.systemPrompt) {
      const systemContent =
        typeof this.config.systemPrompt === 'function'
          ? await this.config.systemPrompt()
          : this.config.systemPrompt;

      // Prepend system message if not already present
      const firstMessage = messages[0];
      if (firstMessage?.role !== 'system') {
        messages.unshift({
          role: 'system',
          content: systemContent,
        });
      }
    }

    return messages;
  }

  private processResponse(irResponse: IRChatResponse): ChatResponse {
    this._requestCount++;

    if (irResponse.usage) {
      this.updateUsage(irResponse.usage);
    }

    const content = this.extractTextContent(irResponse.message);
    const toolCalls = this.extractToolCalls(irResponse.message);

    return {
      content,
      message: irResponse.message,
      finishReason: irResponse.finishReason,
      usage: irResponse.usage,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      requestId: irResponse.metadata.requestId,
    };
  }

  private extractTextContent(message: IRMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    return message.content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('');
  }

  private extractToolCalls(message: IRMessage): ToolCall[] {
    if (typeof message.content === 'string') {
      return [];
    }

    return message.content
      .filter((c): c is ToolUseContent => c.type === 'tool_use')
      .map((c) => ({
        id: c.id,
        name: c.name,
        input: c.input,
      }));
  }

  private createUserMessage(content: string | readonly MessageContent[]): IRMessage {
    return {
      role: 'user',
      content: typeof content === 'string' ? content : [...content],
    };
  }

  private updateUsage(usage: IRUsage): void {
    this._totalUsage.promptTokens += usage.promptTokens;
    this._totalUsage.completionTokens += usage.completionTokens;
    this._totalUsage.totalTokens += usage.totalTokens;
  }

  private trimHistory(): void {
    const limit = this.config.historyLimit;
    if (this._messages.length > limit) {
      // Keep system message if present
      const systemMessage = this._messages[0]?.role === 'system' ? this._messages[0] : null;
      const excess = this._messages.length - limit;

      if (systemMessage) {
        // Remove messages after system, keeping system
        this._messages.splice(1, excess);
      } else {
        this._messages.splice(0, excess);
      }
    }
  }

  private generateRequestId(): string {
    return `chat_${Date.now()}_${++this._requestIdCounter}`;
  }

  private setLoading(loading: boolean): void {
    this._isLoading = loading;
    this.emitStateChange();
  }

  private setError(error: Error | null): void {
    this._error = error;
    if (error) {
      this.emit('error', { error });
    }
    this.emitStateChange();
  }

  private emit<K extends ChatEventType>(event: K, data: ChatEvents[K]): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch {
          // Ignore listener errors
        }
      }
    }
  }

  private emitStateChange(): void {
    this.emit('state-change', { state: this.state });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Chat instance.
 *
 * @example
 * ```typescript
 * const chat = createChat({
 *   backend: myBackend,
 *   systemPrompt: 'You are helpful.',
 * });
 * ```
 */
export function createChat(config: ChatConfig): Chat {
  return new Chat(config);
}
