/**
 * Basic Completion Example with ai.matey React Hooks
 *
 * Demonstrates useCompletion hook for text generation.
 *
 * Setup:
 * ```bash
 * npm install react react-dom
 * npm install ai.matey
 * ```
 *
 * This example shows:
 * - Text completion/generation UI
 * - Streaming responses
 * - Form handling
 * - Loading states and controls
 */

import React from 'react';
import { useCompletion } from 'ai.matey/react';
import { createOpenAIBackendAdapter } from 'ai.matey/adapters/backend';

export default function CompletionExample() {
  // Create backend adapter
  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  // Initialize useCompletion hook
  const {
    completion,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    setInput,
  } = useCompletion({
    backend,
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 500,
    onFinish: (prompt, completion) => {
      console.log('Completion finished:', { prompt, completion });
    },
    onError: (error) => {
      console.error('Completion error:', error);
    },
  });

  // Example prompts for quick testing
  const examplePrompts = [
    'Write a haiku about programming',
    'Explain quantum computing in simple terms',
    'Create a short story about a robot learning to paint',
    'List 5 tips for better code reviews',
  ];

  const loadExample = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>AI Text Generation Demo</h1>

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

      {/* Example prompts */}
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
          Try an example:
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {examplePrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => loadExample(prompt)}
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              {prompt.length > 40 ? prompt.slice(0, 40) + '...' : prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label
            htmlFor="prompt-input"
            style={{
              display: 'block',
              marginBottom: '5px',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            Your Prompt:
          </label>
          <textarea
            id="prompt-input"
            value={input}
            onChange={handleInputChange}
            placeholder="Enter your prompt here..."
            disabled={isLoading}
            rows={3}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
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
              Stop Generation
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
              Generate
            </button>
          )}
        </div>
      </form>

      {/* Completion result */}
      <div>
        <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>
          Generated Text:
        </h3>
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '20px',
          minHeight: '200px',
          backgroundColor: '#fafafa',
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          fontSize: '14px',
          lineHeight: '1.6',
        }}>
          {completion || (
            <span style={{ color: '#999', fontStyle: 'italic' }}>
              {isLoading
                ? 'Generating...'
                : 'Your generated text will appear here'}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {completion && (
        <div style={{
          marginTop: '10px',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#666',
        }}>
          <strong>Characters:</strong> {completion.length} |{' '}
          <strong>Words:</strong> {completion.split(/\s+/).filter(w => w).length}
        </div>
      )}
    </div>
  );
}
