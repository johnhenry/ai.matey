/**
 * Next.js App Router Example with ai.matey React Hooks
 *
 * Demonstrates integration with Next.js 13+ App Router.
 *
 * Setup:
 * ```bash
 * npm install react react-dom next
 * npm install ai.matey
 * ```
 *
 * File structure:
 * ```
 * app/
 *   chat/
 *     page.tsx  (this file - client component)
 *   layout.tsx
 * ```
 *
 * This example shows:
 * - Client component with "use client" directive
 * - Backend adapter initialization
 * - Full chat interface with Next.js
 * - Environment variable handling
 */

'use client';

import React from 'react';
import { useChat } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

export default function ChatPage() {
  // Initialize backend adapter (memoized to prevent recreating on each render)
  const backend = React.useMemo(() => {
    return createOpenAIBackendAdapter({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
    });
  }, []);

  // Initialize useChat hook
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    stop,
  } = useChat({
    backend,
    model: 'gpt-4',
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! How can I help you today?',
        createdAt: new Date(),
      },
    ],
    onFinish: (message) => {
      console.log('Response complete:', message);
    },
  });

  return (
    <div className="container">
      <header className="header">
        <h1>AI Chat - Next.js App Router</h1>
        <p className="subtitle">Powered by ai.matey</p>
      </header>

      <main className="main">
        {/* Error banner */}
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error.message}
            <button onClick={reload} className="retry-button">
              Retry
            </button>
          </div>
        )}

        {/* Messages container */}
        <div className="messages-container">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
            >
              <div className="message-header">
                {message.role === 'user' ? '👤 You' : '🤖 Assistant'}
              </div>
              <div className="message-content">
                {message.content}
              </div>
              <div className="message-timestamp">
                {message.createdAt?.toLocaleTimeString() || ''}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="loading-indicator">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              Assistant is typing...
            </div>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            disabled={isLoading}
            className="chat-input"
          />
          <div className="button-group">
            {isLoading ? (
              <button
                type="button"
                onClick={stop}
                className="stop-button"
              >
                ⏹ Stop
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="send-button"
                >
                  📤 Send
                </button>
                {messages.length > 1 && (
                  <button
                    type="button"
                    onClick={reload}
                    className="reload-button"
                  >
                    🔄 Regenerate
                  </button>
                )}
              </>
            )}
          </div>
        </form>
      </main>

      <style jsx>{`
        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
          height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .header {
          text-align: center;
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e0e0e0;
        }

        .header h1 {
          margin: 0;
          font-size: 28px;
          color: #333;
        }

        .subtitle {
          margin: 5px 0 0;
          font-size: 14px;
          color: #666;
        }

        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .error-banner {
          padding: 12px 16px;
          margin-bottom: 16px;
          background-color: #fee;
          border: 1px solid #fcc;
          border-radius: 8px;
          color: #c00;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .retry-button {
          padding: 6px 12px;
          background-color: #f44336;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background-color: #fafafa;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .message {
          margin-bottom: 20px;
          padding: 16px;
          border-radius: 12px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .user-message {
          background-color: #e3f2fd;
          border-left: 4px solid #2196f3;
          margin-left: 40px;
        }

        .assistant-message {
          background-color: white;
          border-left: 4px solid #4caf50;
          margin-right: 40px;
        }

        .message-header {
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .message-content {
          white-space: pre-wrap;
          line-height: 1.6;
        }

        .message-timestamp {
          margin-top: 8px;
          font-size: 11px;
          color: #999;
          text-align: right;
        }

        .loading-indicator {
          padding: 16px;
          color: #666;
          font-style: italic;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .typing-dots {
          display: flex;
          gap: 4px;
        }

        .typing-dots span {
          width: 8px;
          height: 8px;
          background-color: #999;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }

        .typing-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .typing-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        .input-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .chat-input {
          width: 100%;
          padding: 14px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 15px;
          font-family: inherit;
          transition: border-color 0.2s;
        }

        .chat-input:focus {
          outline: none;
          border-color: #2196f3;
        }

        .chat-input:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .button-group {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }

        .send-button,
        .stop-button,
        .reload-button {
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .send-button {
          background-color: #2196f3;
          color: white;
        }

        .send-button:hover:not(:disabled) {
          background-color: #1976d2;
        }

        .send-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }

        .stop-button {
          background-color: #f44336;
          color: white;
        }

        .stop-button:hover {
          background-color: #d32f2f;
        }

        .reload-button {
          background-color: #ff9800;
          color: white;
        }

        .reload-button:hover {
          background-color: #f57c00;
        }
      `}</style>
    </div>
  );
}
