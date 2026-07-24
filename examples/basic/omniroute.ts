/**
 * OmniRoute Example
 *
 * OmniRoute (https://github.com/diegosouzapw/OmniRoute) is a self-hosted AI
 * gateway fronting 290+ providers (90+ free) behind one OpenAI-compatible
 * endpoint, with its own quota-aware auto-fallback across subscription/
 * API-key/cheap/free provider tiers. Unlike ai.matey's other aggregators
 * (OpenRouter, Fireworks), it's normally run locally with no API key
 * required - `auto` already works on a fresh install.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { OmniRouteBackendAdapter } from 'ai.matey.backend/omniroute';

async function main() {
  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new OmniRouteBackendAdapter({
      baseURL: 'http://localhost:20128/v1', // default OmniRoute port
      // OmniRoute doesn't check this for keyless local/free-provider usage -
      // any placeholder string works; BackendAdapterConfig just requires one.
      apiKey: 'not-needed',
    })
  );

  const response = await bridge.chat({
    model: 'auto', // let OmniRoute pick a healthy provider from your configured pool
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
