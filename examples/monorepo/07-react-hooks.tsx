/**
 * React Hooks Example - Using React Packages
 *
 * Shows how to use the React-specific packages:
 * - ai.matey.react.core - Core hooks (useChat, useCompletion)
 * - ai.matey.react.hooks - Additional hooks (useAssistant, useTokenCount)
 * - ai.matey.react.stream - Stream components (StreamText, TypeWriter)
 */

import React from 'react';

// Core React hooks
import { useChat, useCompletion, useObject } from 'ai.matey.react.core';

// Additional hooks
import { useTokenCount } from 'ai.matey.react.hooks';

// Stream components
import { StreamProvider, StreamText, TypeWriter } from 'ai.matey.react.stream';

// Types
import type { IRMessage } from 'ai.matey.types';

/**
 * Basic Chat Component using useChat hook
 */
export function ChatExample() {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    error,
  } = useChat({
    api: '/api/chat',
    initialMessages: [
      { role: 'system', content: 'You are a helpful assistant.' },
    ],
  });

  return (
    <div className="chat-container">
      <h2>Chat Example</h2>

      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>

      {error && <div className="error">{error.message}</div>}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}

/**
 * Completion Component using useCompletion hook
 */
export function CompletionExample() {
  const {
    completion,
    input,
    setInput,
    handleSubmit,
    isLoading,
  } = useCompletion({
    api: '/api/completion',
  });

  return (
    <div className="completion-container">
      <h2>Completion Example</h2>

      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a prompt..."
          rows={4}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate'}
        </button>
      </form>

      {completion && (
        <div className="completion">
          <h3>Completion:</h3>
          <p>{completion}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Structured Output Component using useObject hook
 */
interface Recipe {
  name: string;
  ingredients: string[];
  steps: string[];
  prepTime: number;
}

export function StructuredOutputExample() {
  const {
    object,
    submit,
    isLoading,
    error,
  } = useObject<Recipe>({
    api: '/api/object',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        ingredients: { type: 'array', items: { type: 'string' } },
        steps: { type: 'array', items: { type: 'string' } },
        prepTime: { type: 'number' },
      },
      required: ['name', 'ingredients', 'steps', 'prepTime'],
    },
  });

  return (
    <div className="object-container">
      <h2>Structured Output Example</h2>

      <button
        onClick={() => submit({ prompt: 'Generate a recipe for chocolate chip cookies' })}
        disabled={isLoading}
      >
        {isLoading ? 'Generating...' : 'Generate Recipe'}
      </button>

      {error && <div className="error">{error.message}</div>}

      {object && (
        <div className="recipe">
          <h3>{object.name}</h3>
          <p>Prep time: {object.prepTime} minutes</p>

          <h4>Ingredients:</h4>
          <ul>
            {object.ingredients.map((ing, i) => (
              <li key={i}>{ing}</li>
            ))}
          </ul>

          <h4>Steps:</h4>
          <ol>
            {object.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * Token Counter Component using useTokenCount hook
 */
export function TokenCounterExample() {
  const [text, setText] = React.useState('');
  const { tokenCount, isLoading } = useTokenCount(text, {
    model: 'gpt-4',
    debounceMs: 300,
  });

  return (
    <div className="token-counter">
      <h2>Token Counter Example</h2>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type to count tokens..."
        rows={6}
      />

      <div className="count">
        {isLoading ? (
          'Counting...'
        ) : (
          `Tokens: ${tokenCount} / 8192 (${((tokenCount / 8192) * 100).toFixed(1)}%)`
        )}
      </div>
    </div>
  );
}

/**
 * Streaming Text Component using StreamProvider
 */
export function StreamingExample() {
  return (
    <StreamProvider endpoint="/api/stream">
      <div className="streaming-container">
        <h2>Streaming Text Example</h2>

        {/* Basic streaming text */}
        <StreamText
          prompt="Tell me a short story about a robot learning to paint."
          className="stream-output"
        />

        {/* Typewriter effect */}
        <h3>With Typewriter Effect:</h3>
        <TypeWriter
          text="This text appears character by character with a typewriter effect."
          speed={50}
          className="typewriter"
        />
      </div>
    </StreamProvider>
  );
}

/**
 * Complete App showing all examples
 */
export function App() {
  return (
    <div className="app">
      <h1>ai.matey React Examples</h1>

      <section>
        <ChatExample />
      </section>

      <section>
        <CompletionExample />
      </section>

      <section>
        <StructuredOutputExample />
      </section>

      <section>
        <TokenCounterExample />
      </section>

      <section>
        <StreamingExample />
      </section>
    </div>
  );
}

export default App;
