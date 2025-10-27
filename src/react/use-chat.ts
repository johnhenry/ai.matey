/**
 * useChat Hook
 *
 * React hook for chat interfaces with streaming support.
 * Compatible with Vercel AI SDK API.
 *
 * @module
 */

import type { UseChatOptions, UseChatHelpers, UIMessage, ChatStatus } from './types.js';
import type { IRMessage, IRChatRequest } from '../types/ir.js';
import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// Message Conversion Utilities
// ============================================================================

/**
 * Convert UIMessage to IRMessage.
 */
function toIRMessage(message: UIMessage): IRMessage {
  return {
    role: message.role === 'function' || message.role === 'tool' ? 'assistant' : message.role,
    content: message.content,
  };
}

/**
 * Generate unique message ID.
 */
function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================================
// useChat Hook
// ============================================================================

/**
 * React hook for chat interfaces.
 *
 * Provides state management, streaming, and UI helpers for chat applications.
 *
 * **Note:** This hook requires React as an optional peer dependency.
 *
 * Install with:
 * ```bash
 * npm install react react-dom
 * ```
 *
 * @param options Chat configuration
 * @returns Chat helpers and state
 *
 * **Note:** Requires React. Module import will fail if React is not installed.
 *
 * @example
 * ```tsx
 * import { useChat } from 'ai.matey/react';
 * import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';
 *
 * function ChatComponent() {
 *   const backend = createOpenAIBackendAdapter({
 *     apiKey: process.env.OPENAI_API_KEY
 *   });
 *
 *   const { messages, input, handleInputChange, handleSubmit } = useChat({
 *     backend,
 *     model: 'gpt-4',
 *   });
 *
 *   return (
 *     <div>
 *       {messages.map(m => (
 *         <div key={m.id}>
 *           <strong>{m.role}:</strong> {m.content}
 *         </div>
 *       ))}
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={handleInputChange} />
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChat(options: UseChatOptions): UseChatHelpers {
  const {
    initialMessages = [],
    backend,
    model = 'gpt-4',
    maxTokens,
    temperature,
    onFinish,
    onError,
    onResponse,
    streaming = true,
  } = options;

  // State
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<Error | undefined>(undefined);

  // Mounted flag to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Abort controller ref for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Send a message and get response.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || status === 'streaming') {
        return;
      }

      // Clear previous error
      setError(undefined);
      setStatus('streaming');

      // Create user message
      const userMessage: UIMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        createdAt: new Date(),
      };

      // Create assistant message placeholder
      const assistantMessageId = generateId();
      const assistantMessage: UIMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        createdAt: new Date(),
      };

      // Capture current messages for building request
      let capturedMessages: UIMessage[] = [];

      // Add user message and placeholder to state, capturing current messages
      setMessages((prev: UIMessage[]) => {
        capturedMessages = prev; // Capture before adding new messages
        return [...prev, userMessage, assistantMessage];
      });

      try {
        // Create abort controller
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Build request using captured messages + user message
        const allMessages = [...capturedMessages, userMessage];
        const irMessages: IRMessage[] = allMessages.map(toIRMessage);

        const request: IRChatRequest = {
          messages: irMessages,
          parameters: {
            model,
            ...(maxTokens && { maxTokens }),
            ...(temperature !== undefined && { temperature }),
          },
          stream: streaming,
          metadata: {
            requestId: generateId(),
            timestamp: Date.now(),
            provenance: {},
          },
        };

        if (streaming) {
          // Streaming response
          const stream = backend.executeStream(request);
          let fullContent = '';

          for await (const chunk of stream) {
            // Check if aborted or unmounted
            if (controller.signal.aborted || !isMountedRef.current) {
              break;
            }

            if (chunk.type === 'content' && chunk.delta) {
              fullContent += chunk.delta;

              // Update assistant message (only if still mounted)
              if (isMountedRef.current) {
                setMessages((prev: UIMessage[]) =>
                  prev.map((msg: UIMessage) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: fullContent }
                      : msg
                  )
                );
              }

              // Call onResponse
              if (onResponse) {
                onResponse(fullContent);
              }
            }

            if (chunk.type === 'done') {
              const finalMessage: UIMessage = {
                id: assistantMessageId,
                role: 'assistant',
                content: fullContent,
                createdAt: new Date(),
              };

              // Call onFinish
              if (onFinish) {
                await onFinish(finalMessage);
              }
            }
          }
        } else {
          // Non-streaming response
          const response = await backend.execute(request);

          const finalMessage: UIMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: typeof response.message.content === 'string' ? response.message.content : '',
            createdAt: new Date(),
          };

          if (isMountedRef.current) {
            setMessages((prev: UIMessage[]) =>
              prev.map((msg: UIMessage) =>
                msg.id === assistantMessageId ? finalMessage : msg
              )
            );
          }

          if (onResponse) {
            onResponse(typeof response.message.content === 'string' ? response.message.content : '');
          }

          if (onFinish) {
            await onFinish(finalMessage);
          }
        }

        if (isMountedRef.current) {
          setStatus('idle');
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (isMountedRef.current) {
          setError(error);
          setStatus('error');

          // Remove failed assistant message
          setMessages((prev: UIMessage[]) => prev.filter((msg: UIMessage) => msg.id !== assistantMessageId));
        }

        if (onError) {
          onError(error);
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [
      // Removed 'messages' from deps - using functional state updates instead
      backend,
      model,
      maxTokens,
      temperature,
      streaming,
      status,
      onFinish,
      onError,
      onResponse,
    ]
  );

  /**
   * Handle input change event.
   */
  const handleInputChange = useCallback(
    (event: { target: { value: string } }) => {
      setInput(event.target.value);
    },
    []
  );

  /**
   * Handle form submit event.
   */
  const handleSubmit = useCallback(
    async (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();

      if (!input.trim()) {
        return;
      }

      const message = input;
      setInput(''); // Clear input immediately

      await sendMessage(message);
    },
    [input, sendMessage]
  );

  /**
   * Append a message to the chat.
   */
  const append = useCallback(
    async (message: UIMessage | Omit<UIMessage, 'id'>) => {
      const fullMessage: UIMessage = {
        ...message,
        id: 'id' in message ? message.id : generateId(),
        createdAt: message.createdAt || new Date(),
      } as UIMessage;

      if (fullMessage.role === 'user') {
        await sendMessage(fullMessage.content);
      } else {
        setMessages((prev: UIMessage[]) => [...prev, fullMessage]);
      }
    },
    [sendMessage]
  );

  /**
   * Stop the current stream.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatus('idle');
    }
  }, []);

  /**
   * Reload/regenerate the last assistant response.
   */
  const reload = useCallback(async () => {
    // Stop any in-flight request first
    stop();

    // Use functional update to get current messages
    let lastUserMessageContent: string | null = null;

    setMessages((prev: UIMessage[]) => {
      if (prev.length === 0) {
        return prev;
      }

      // Find last user message
      const lastUserMessage = [...prev]
        .reverse()
        .find((m: UIMessage) => m.role === 'user');

      if (!lastUserMessage) {
        return prev;
      }

      // Capture content for re-sending
      lastUserMessageContent = lastUserMessage.content;

      // Remove all messages after the last user message
      const indexOfLastUser = prev.findIndex((m) => m.id === lastUserMessage.id);
      return prev.slice(0, indexOfLastUser + 1);
    });

    // Re-send the user message if we found one
    if (lastUserMessageContent) {
      await sendMessage(lastUserMessageContent);
    }
  }, [sendMessage, stop]);

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    sendMessage,
    append,
    reload,
    stop,
    setMessages,
    status,
    isLoading: status === 'streaming',
    error,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if React is available.
 *
 * Since React is imported at module load time, this function will only
 * be callable if React is installed. It always returns true.
 *
 * @returns Promise that resolves to true
 *
 * @example
 * ```typescript
 * import { isReactAvailable } from 'ai.matey/react';
 *
 * if (await isReactAvailable()) {
 *   // Use React hooks
 * }
 * ```
 */
export async function isReactAvailable(): Promise<boolean> {
  // If this module loaded, React is available
  return true;
}
