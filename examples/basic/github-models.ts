/**
 * GitHub Models Example
 *
 * GitHub Models is free to any GitHub account (rate limits scale with your
 * Copilot subscription tier) and fronts models from OpenAI, Meta, DeepSeek,
 * Mistral, and Microsoft behind one OpenAI-compatible API.
 *
 * Auth: a GitHub personal access token with the `models: read` permission.
 * https://github.com/settings/tokens
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { GitHubModelsBackendAdapter } from 'ai.matey.backend/github-models';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new GitHubModelsBackendAdapter({
      apiKey: process.env.GITHUB_TOKEN || 'ghp_...',
    })
  );

  const response = await bridge.chat({
    // GitHub Models uses `publisher/model-name` IDs - the OpenAI frontend
    // forwards `model` verbatim, so pass a real catalog ID directly rather
    // than relying on the adapter's defaultModel (see
    // https://models.github.ai/catalog/models for the full list).
    model: 'openai/gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: 'What is the capital of France?',
      },
    ],
  });

  console.log('Response:', response);
}

main().catch(console.error);
