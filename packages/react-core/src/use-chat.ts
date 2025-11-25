/**
 * useChat Hook
 *
 * React hook for building chat interfaces with streaming support.
 *
 * @module
 */

import { useState, useCallback, useRef, useId } from 'react';
import type {
  Message,
  UseChatOptions,
  UseChatReturn,
  ChatRequestOptions,
} from './types.js';

/**
 * Generate a unique ID.
 */
function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * useChat - React hook for chat interfaces.
 *
 * Provides state management, streaming, and utilities for building
 * chat applications with AI backends.
 *
 * @example
 * ```tsx
 * import { useChat } from 'ai.matey.react.core';
 *
 * function ChatComponent() {
 *   const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
 *     api: '/api/chat',
 *   });
 *
 *   return (
 *     <div>
 *       {messages.map((m) => (
 *         <div key={m.id}>
 *           {m.role}: {m.content}
 *         </div>
 *       ))}
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={handleInputChange} />
 *         <button type="submit" disabled={isLoading}>Send</button>
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    initialMessages = [],
    initialInput = '',
    id,
    api = '/api/chat',
    headers = {},
    body = {},
    generateId = generateUniqueId,
    onFinish,
    onError,
    onResponse,
    keepLastMessageOnError = true,
    // maxToolRoundtrips for future tool calling support
    maxToolRoundtrips: _maxToolRoundtrips = 0,
    sendExtraMessageFields = false,
    streamProtocol = 'data',
  } = options;

  // Generate a stable ID for this chat instance
  const hookId = useId();
  const chatId = id ?? hookId;

  // State
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState<string>(initialInput);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [data, _setData] = useState<unknown[] | undefined>(undefined);

  // Refs for abort control
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Handle input change from form elements.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  /**
   * Stop current streaming request.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * Send a chat request and handle streaming response.
   */
  const sendRequest = useCallback(
    async (
      messagesToSend: Message[],
      requestOptions?: ChatRequestOptions
    ): Promise<string | null | undefined> => {
      try {
        setIsLoading(true);
        setError(undefined);

        // Create abort controller
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Prepare request body
        const requestBody = {
          messages: sendExtraMessageFields
            ? messagesToSend
            : messagesToSend.map(({ role, content }) => ({ role, content })),
          id: chatId,
          ...body,
          ...requestOptions?.body,
        };

        // Make request
        const response = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
            ...requestOptions?.headers,
          },
          body: JSON.stringify(requestBody),
          signal,
        });

        // Call onResponse callback
        onResponse?.(response);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';
        const assistantId = generateId();

        // Add placeholder message
        const assistantMessage: Message = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Read stream
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });

          if (streamProtocol === 'data') {
            // Parse SSE data format
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  break;
                }
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    assistantContent += parsed.content;
                  } else if (parsed.choices?.[0]?.delta?.content) {
                    assistantContent += parsed.choices[0].delta.content;
                  }
                } catch {
                  // Ignore parse errors for incomplete JSON
                }
              }
            }
          } else {
            // Raw text protocol
            assistantContent += chunk;
          }

          // Update message content
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
        }

        // Finalize message
        const finalMessage: Message = {
          id: assistantId,
          role: 'assistant',
          content: assistantContent,
          createdAt: new Date(),
        };

        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantId ? finalMessage : msg))
        );

        onFinish?.(finalMessage);

        return assistantContent;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, not an error
          return null;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);

        if (!keepLastMessageOnError) {
          // Remove the last user message on error
          setMessages((prev) => prev.slice(0, -1));
        }

        return undefined;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      api,
      body,
      chatId,
      generateId,
      headers,
      keepLastMessageOnError,
      onError,
      onFinish,
      onResponse,
      sendExtraMessageFields,
      streamProtocol,
    ]
  );

  /**
   * Append a message and send.
   */
  const append = useCallback(
    async (
      message: Message | string,
      options?: ChatRequestOptions
    ): Promise<string | null | undefined> => {
      const newMessage: Message =
        typeof message === 'string'
          ? {
              id: generateId(),
              role: 'user',
              content: message,
              createdAt: new Date(),
            }
          : message;

      const newMessages = [...messages, newMessage];
      setMessages(newMessages);

      return sendRequest(newMessages, options);
    },
    [generateId, messages, sendRequest]
  );

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(
    (e?: React.FormEvent<HTMLFormElement>, options?: ChatRequestOptions) => {
      e?.preventDefault();

      if (!input.trim()) {
        return;
      }

      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: input,
        createdAt: new Date(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      setInput('');

      sendRequest(newMessages, options);
    },
    [generateId, input, messages, sendRequest]
  );

  /**
   * Reload the last assistant message.
   */
  const reload = useCallback(
    async (options?: ChatRequestOptions): Promise<string | null | undefined> => {
      if (messages.length === 0) {
        return null;
      }

      // Find messages up to the last user message
      const lastUserIndex = messages.findLastIndex((m: Message) => m.role === 'user');
      if (lastUserIndex === -1) {
        return null;
      }

      const messagesToReload = messages.slice(0, lastUserIndex + 1);
      setMessages(messagesToReload);

      return sendRequest(messagesToReload, options);
    },
    [messages, sendRequest]
  );

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    append,
    reload,
    stop,
    setMessages,
    isLoading,
    error,
    data,
  };
}
