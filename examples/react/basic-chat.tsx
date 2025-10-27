/**
 * Basic Chat Example with ai.matey React Hooks
 *
 * Demonstrates useChat hook for building a chat interface.
 *
 * Setup:
 * ```bash
 * npm install react react-dom
 * npm install ai.matey
 * ```
 *
 * This example shows:
 * - Basic chat UI with streaming
 * - Message history management
 * - Form handling
 * - Loading states
 */

import React from 'react';
import { useChat } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

export default function ChatExample() {
  // Create backend adapter
  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  // Initialize useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
  } = useChat({
    backend,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 500,
    onFinish: (message) => {
      console.log('Chat response completed:', message);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>AI Chat Demo</h1>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
        }}>
          Error: {error.message}
        </div>
      )}

      {/* Messages */}
      <div style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px',
        minHeight: '400px',
        maxHeight: '600px',
        overflowY: 'auto',
        backgroundColor: '#fafafa',
      }}>
        {messages.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center' }}>
            No messages yet. Start a conversation!
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              marginBottom: '15px',
              padding: '10px 15px',
              borderRadius: '8px',
              backgroundColor: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
              border: message.role === 'user' ? '1px solid #2196f3' : '1px solid #ddd',
            }}
          >
            <div style={{
              fontWeight: 'bold',
              marginBottom: '5px',
              color: message.role === 'user' ? '#1976d2' : '#333',
            }}>
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{
            padding: '10px',
            color: '#666',
            fontStyle: 'italic',
          }}>
            Assistant is typing...
          </div>
        )}
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              style={{
                padding: '12px 24px',
                backgroundColor: input.trim() ? '#2196f3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              Send
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
