/**
 * Embeddings: generate vectors through the provider-agnostic Bridge.
 *
 * Run: npx tsx examples/embeddings/basic.ts (requires OPENAI_API_KEY)
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend';
import { OpenAIBackendAdapter } from 'ai.matey.backend';
import { cosineSimilarity } from 'ai.matey.utils';
import { createEmbeddingCachingMiddleware } from 'ai.matey.middleware';

const bridge = new Bridge(
  new OpenAIFrontendAdapter(),
  new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! })
);

// Cache repeated embeddings (they are deterministic per model)
bridge.useEmbed(createEmbeddingCachingMiddleware({ ttl: 24 * 3600 * 1000 }));

const response = await bridge.embed(
  ['The cat sat on the mat.', 'A feline rested on the rug.', 'Quarterly revenue grew 12%.'],
  { model: 'text-embedding-3-small' }
);

const [cat, feline, revenue] = response.embeddings.map((e) => [...e.vector]);
console.log('cat ~ feline:', cosineSimilarity(cat!, feline!).toFixed(3));
console.log('cat ~ revenue:', cosineSimilarity(cat!, revenue!).toFixed(3));
console.log('tokens used:', response.usage?.promptTokens);
