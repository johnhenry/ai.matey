/**
 * Retry Middleware Example
 *
 * Shows how to add automatic retry logic for failed requests.
 */

import {
  Bridge,
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter,
  createRetryMiddleware,
  isRateLimitError,
  isNetworkError,
} from 'ai.matey';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY || 'sk-ant-...',
    })
  );

  // Add retry middleware with custom configuration
  bridge.use(
    createRetryMiddleware({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      shouldRetry: (error, attempt) => {
        console.log(`Retry attempt ${attempt} for error:`, error.message);
        return isRateLimitError(error) || isNetworkError(error);
      },
      onRetry: (error, attempt) => {
        console.log(`Retrying after error (attempt ${attempt}):`, error.message);
      },
    })
  );

  console.log('Making request with retry middleware...\n');

  try {
    const response = await bridge.chat({
      model: 'gpt-4',
      messages: [
        {
          role: 'user',
          content: 'Explain the concept of middleware.',
        },
      ],
    });

    console.log('Success!');
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('Request failed after retries:', error);
  }
}

main().catch(console.error);
