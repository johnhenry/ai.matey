/**
 * useChat Hook
 *
 * React hook for building chat interfaces with streaming support.
 * Supports both HTTP API mode and direct backend mode.
 *
 * @module
 */

import { useState, useCallback, useRef, useId, useEffect } from 'react';
import { Chat, createChat } from 'ai.matey.wrapper';
import type { IRMessage } from 'ai.matey.types';
import type { Message, UseChatOptions, UseChatReturn, ChatRequestOptions } from './types.js';

/**
 * Generate a unique ID.
 */
function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Convert React Message to IR message format.
 */
function messageToIR(message: Message): IRMessage {
  return {
    role: message.role,
    content: message.content,
  };
}

/**
 * useChat - React hook for chat interfaces.
 *
 * Provides state management, streaming, and utilities for building
 * chat applications with AI backends.
 *
 * Supports two modes:
 * 1. HTTP Mode (default): Uses `api` endpoint with fetch
 * 2. Direct Mode: Uses `direct.backend` for direct backend access
 *
 * @example HTTP Mode
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
 *         <div key={m.id}>{m.role}: {m.content}</div>
 *       ))}
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={handleInputChange} />
 *         <button type="submit" disabled={isLoading}>Send</button>
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Direct Mode
 * ```tsx
 * import { useChat } from 'ai.matey.react.core';
 * import { AnthropicBackend } from 'ai.matey.backend/anthropic';
 *
 * const backend = new AnthropicBackend({ apiKey: process.env.ANTHROPIC_API_KEY });
 *
 * function ChatComponent() {
 *   const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
 *     direct: {
 *       backend,
 *       systemPrompt: 'You are a helpful assistant.',
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       {messages.map((m) => (
 *         <div key={m.id}>{m.role}: {m.content}</div>
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
    // HTTP mode options
    api = '/api/chat',
    headers = {},
    body = {},
    streamProtocol = 'data',
    onResponse,
    // Direct mode options
    direct,
    // Common options
    generateId = generateUniqueId,
    onFinish,
    onError,
    keepLastMessageOnError = true,
    maxToolRoundtrips = 0,
    sendExtraMessageFields = false,
  } = options;

  // Determine mode
  const isDirectMode = !!direct;

  // Generate a stable ID for this chat instance
  const hookId = useId();
  const chatId = id ?? hookId;

  // State
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState<string>(initialInput);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [data, _setData] = useState<unknown[] | undefined>(undefined);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatRef = useRef<Chat | null>(null);

  // Create Chat instance for direct mode
  useEffect(() => {
    if (isDirectMode && direct) {
      chatRef.current = createChat({
        backend: direct.backend,
        systemPrompt: direct.systemPrompt,
        defaultParameters: direct.defaultParameters,
        tools: direct.tools,
        onToolCall: direct.onToolCall,
        autoExecuteTools: direct.autoExecuteTools,
        maxToolRounds: direct.maxToolRounds ?? maxToolRoundtrips,
      });
    }

    return () => {
      chatRef.current = null;
    };
  }, [isDirectMode, direct, maxToolRoundtrips]);

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
   * Send request in direct mode using wrapper-ir Chat.
   */
  const sendDirectRequest = useCallback(
    async (
      messagesToSend: Message[],
      _requestOptions?: ChatRequestOptions
    ): Promise<string | null | undefined> => {
      const chat = chatRef.current;
      if (!chat) {
        throw new Error('Chat instance not initialized');
      }

      try {
        setIsLoading(true);
        setError(undefined);

        // Create abort controller
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Clear chat and restore messages
        chat.clear();
        for (const msg of messagesToSend.slice(0, -1)) {
          chat.addMessage(messageToIR(msg));
        }

        // Get the last user message content
        const lastMessage = messagesToSend[messagesToSend.length - 1];
        if (!lastMessage || lastMessage.role !== 'user') {
          throw new Error('Last message must be a user message');
        }

        // Add placeholder assistant message
        const assistantId = generateId();
        const assistantMessage: Message = {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Stream the response
        const response = await chat.stream(lastMessage.content, {
          signal,
          onChunk: ({ accumulated }: { accumulated: string; delta: string; sequence: number }) => {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === assistantId ? { ...msg, content: accumulated } : msg))
            );
          },
        });

        // Finalize message
        const finalMessage: Message = {
          id: assistantId,
          role: 'assistant',
          content: response.content,
          createdAt: new Date(),
        };

        setMessages((prev) => prev.map((msg) => (msg.id === assistantId ? finalMessage : msg)));

        onFinish?.(finalMessage);
        return response.content;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);

        if (!keepLastMessageOnError) {
          setMessages((prev) => prev.slice(0, -1));
        }

        return undefined;
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [generateId, onFinish, onError, keepLastMessageOnError]
  );

  /**
   * Send request in HTTP mode using fetch.
   */
  const sendHttpRequest = useCallback(
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
              msg.id === assistantId ? { ...msg, content: assistantContent } : msg
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

        setMessages((prev) => prev.map((msg) => (msg.id === assistantId ? finalMessage : msg)));

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
   * Send request using the appropriate mode.
   */
  const sendRequest = useCallback(
    async (
      messagesToSend: Message[],
      requestOptions?: ChatRequestOptions
    ): Promise<string | null | undefined> => {
      return isDirectMode
        ? sendDirectRequest(messagesToSend, requestOptions)
        : sendHttpRequest(messagesToSend, requestOptions);
    },
    [isDirectMode, sendDirectRequest, sendHttpRequest]
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
