/**
 * useAssistant Hook
 *
 * React hook for OpenAI Assistants API compatible interfaces.
 *
 * @module
 */

import { useState, useCallback, useRef } from 'react';
import type { Message } from 'ai.matey.react.core';

/**
 * Assistant message with additional metadata.
 */
export interface AssistantMessage extends Message {
  /** Thread ID */
  threadId?: string;
  /** Run ID */
  runId?: string;
  /** File annotations */
  annotations?: Annotation[];
}

/**
 * File annotation.
 */
export interface Annotation {
  /** Annotation type */
  type: 'file_citation' | 'file_path';
  /** Text content */
  text: string;
  /** File citation details */
  file_citation?: {
    file_id: string;
    quote?: string;
  };
  /** File path details */
  file_path?: {
    file_id: string;
  };
  /** Start index */
  start_index: number;
  /** End index */
  end_index: number;
}

/**
 * Assistant run status.
 */
export type AssistantStatus =
  | 'awaiting_message'
  | 'in_progress'
  | 'requires_action'
  | 'cancelling'
  | 'cancelled'
  | 'failed'
  | 'completed'
  | 'expired';

/**
 * Assistant hook options.
 */
export interface UseAssistantOptions {
  /** API endpoint */
  api?: string;
  /** Assistant ID */
  assistantId?: string;
  /** Thread ID for continuing a conversation */
  threadId?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body extras */
  body?: Record<string, unknown>;
  /** Called when status changes */
  onStatus?: (status: AssistantStatus) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Assistant hook return value.
 */
export interface UseAssistantReturn {
  /** Chat messages */
  messages: AssistantMessage[];
  /** Current input value */
  input: string;
  /** Set input value */
  setInput: (input: string) => void;
  /** Handle input change */
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Handle form submit */
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
  /** Submit message programmatically */
  append: (message: string | Message) => Promise<void>;
  /** Thread ID */
  threadId: string | undefined;
  /** Current status */
  status: AssistantStatus;
  /** Stop the current run */
  stop: () => void;
  /** Set messages */
  setMessages: (messages: AssistantMessage[]) => void;
  /** Error if any */
  error: Error | undefined;
}

/**
 * useAssistant - React hook for OpenAI Assistants API.
 *
 * Provides state management for conversations with OpenAI Assistants,
 * including thread management and run status tracking.
 *
 * @example
 * ```tsx
 * import { useAssistant } from 'ai.matey.react.hooks';
 *
 * function AssistantChat() {
 *   const { messages, input, handleInputChange, handleSubmit, status } = useAssistant({
 *     api: '/api/assistant',
 *     assistantId: 'asst_xxx',
 *   });
 *
 *   return (
 *     <div>
 *       {messages.map((m) => (
 *         <div key={m.id}>{m.role}: {m.content}</div>
 *       ))}
 *       <form onSubmit={handleSubmit}>
 *         <input value={input} onChange={handleInputChange} />
 *         <button type="submit" disabled={status === 'in_progress'}>Send</button>
 *       </form>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAssistant(options: UseAssistantOptions = {}): UseAssistantReturn {
  const {
    api = '/api/assistant',
    assistantId,
    threadId: initialThreadId,
    headers = {},
    body = {},
    onStatus,
    onError,
  } = options;

  // State
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId);
  const [status, setStatus] = useState<AssistantStatus>('awaiting_message');
  const [error, setError] = useState<Error | undefined>(undefined);

  // Refs for abort control
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Update status and call callback.
   */
  const updateStatus = useCallback(
    (newStatus: AssistantStatus) => {
      setStatus(newStatus);
      onStatus?.(newStatus);
    },
    [onStatus]
  );

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
   * Stop current run.
   */
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      updateStatus('cancelled');
    }
  }, [updateStatus]);

  /**
   * Generate unique ID.
   */
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  /**
   * Send a message to the assistant.
   */
  const append = useCallback(
    async (message: string | Message): Promise<void> => {
      try {
        setError(undefined);
        updateStatus('in_progress');

        // Create abort controller
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Create user message
        const userMessage: AssistantMessage =
          typeof message === 'string'
            ? {
                id: generateId(),
                role: 'user',
                content: message,
                createdAt: new Date(),
              }
            : { ...message, id: message.id ?? generateId() };

        setMessages((prev) => [...prev, userMessage]);

        // Prepare request body
        const requestBody = {
          message: typeof message === 'string' ? message : message.content,
          assistantId,
          threadId,
          ...body,
        };

        // Make request
        const response = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(requestBody),
          signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update thread ID if new
        if (data.threadId && !threadId) {
          setThreadId(data.threadId);
        }

        // Add assistant message
        if (data.message) {
          const assistantMessage: AssistantMessage = {
            id: data.message.id ?? generateId(),
            role: 'assistant',
            content: data.message.content ?? '',
            createdAt: new Date(),
            threadId: data.threadId,
            runId: data.runId,
            annotations: data.message.annotations,
          };

          setMessages((prev) => [...prev, assistantMessage]);
        }

        updateStatus('completed');
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        updateStatus('failed');
      } finally {
        abortControllerRef.current = null;
      }
    },
    [api, assistantId, body, generateId, headers, onError, threadId, updateStatus]
  );

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(
    (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();

      if (!input.trim() || status === 'in_progress') {
        return;
      }

      const message = input;
      setInput('');
      append(message);
    },
    [append, input, status]
  );

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    append,
    threadId,
    status,
    stop,
    setMessages,
    error,
  };
}
