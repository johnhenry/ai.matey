/**
 * React Integration - AI-Powered React Components
 *
 * Demonstrates:
 * - Using ai.matey with React hooks
 * - Server-side streaming to React components
 * - Real-time UI updates from AI responses
 * - Error handling and loading states
 * - Production-ready patterns
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in web.env.local.mjs
 * - React application set up
 * - @johnhenry/aimatey-react-hooks package (or custom hooks)
 *
 * Run:
 *   # This example shows the patterns - integrate into your React app
 *   npx tsx packages/ai.matey.docs/examples/07-advanced-patterns/05-react-integration.ts
 *
 * Expected Output:
 *   Code examples for React integration patterns.
 */

import { displayExampleInfo } from '../_shared/helpers.js';

function main() {
  displayExampleInfo(
    'React Integration Patterns',
    'Build AI-powered React applications with ai.matey',
    [
      'React application',
      '@johnhenry/aimatey-react-hooks package',
      'Understanding of React hooks'
    ]
  );

  console.log('\n═'.repeat(60));
  console.log('Pattern 1: useAIChat Hook');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// Custom hook for AI chat
import { useState, useCallback } from 'react';
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';

export function useAIChat(apiKey: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const bridge = useMemo(
    () =>
      new Bridge(
        new OpenAIFrontendAdapter(),
        new AnthropicBackendAdapter({ apiKey })
      ),
    [apiKey]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      setIsLoading(true);
      setError(null);

      const userMessage = { role: 'user', content };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await bridge.chat({
          model: 'gpt-4',
          messages: [...messages, userMessage],
        });

        const aiMessage = {
          role: 'assistant',
          content: response.choices[0].message.content,
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [bridge, messages]
  );

  return { messages, isLoading, error, sendMessage };
}
`);

  console.log('═'.repeat(60));
  console.log('Pattern 2: Streaming Component');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// Component with streaming responses
export function StreamingChat({ apiKey }: { apiKey: string }) {
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleStream = async (query: string) => {
    setIsStreaming(true);
    setStreamingText('');

    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey })
    );

    const stream = await bridge.chatStream({
      model: 'gpt-4',
      messages: [{ role: 'user', content: query }],
      stream: true,
    });

    for await (const chunk of stream) {
      if (chunk.choices?.[0]?.delta?.content) {
        setStreamingText((prev) => prev + chunk.choices[0].delta.content);
      }
    }

    setIsStreaming(false);
  };

  return (
    <div>
      {isStreaming && <div className="typing-indicator">AI is typing...</div>}
      <div className="response">{streamingText}</div>
    </div>
  );
}
`);

  console.log('═'.repeat(60));
  console.log('Pattern 3: Server Component (Next.js)');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// app/api/chat/route.ts - Next.js API Route
import { Bridge } from '@johnhenry/aimatey-core';
import { OpenAIFrontendAdapter } from '@johnhenry/aimatey-frontend/openai';
import { AnthropicBackendAdapter } from '@johnhenry/aimatey-backend/anthropic';

export async function POST(request: Request) {
  const { messages } = await request.json();

  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  );

  // Streaming response
  const stream = await bridge.chatStream({
    model: 'gpt-4',
    messages,
    stream: true,
  });

  // Convert to ReadableStream for Next.js
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          controller.enqueue(encoder.encode(content));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
`);

  console.log('═'.repeat(60));
  console.log('Pattern 4: Error Boundary');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// Error boundary for AI components
class AIErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>⚠️ AI Error</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
<AIErrorBoundary>
  <ChatComponent />
</AIErrorBoundary>
`);

  console.log('\n💡 React Best Practices:\n');
  console.log('   ✓ Use hooks for state management');
  console.log('   ✓ Implement loading and error states');
  console.log('   ✓ Stream responses for better UX');
  console.log('   ✓ Wrap in error boundaries');
  console.log('   ✓ Keep API keys server-side only');
  console.log('   ✓ Debounce user input');
  console.log('   ✓ Cache responses when possible\n');

  console.log('🎯 Production Patterns:\n');
  console.log('   • Server-side API routes (hide keys)');
  console.log('   • Streaming responses (better UX)');
  console.log('   • Optimistic UI updates');
  console.log('   • Request cancellation');
  console.log('   • Rate limiting on client');
  console.log('   • Retry with exponential backoff\n');
}

main();
