/**
 * Edge Deployment - Serverless & Edge Runtime
 *
 * Demonstrates:
 * - Deploying to edge runtimes (Cloudflare Workers, Vercel Edge)
 * - Optimizing for cold starts
 * - Global distribution
 * - Minimal bundle size
 * - Edge-compatible patterns
 *
 * Prerequisites:
 * - Edge runtime compatible code
 * - Understanding of serverless platforms
 *
 * Run:
 *   npx tsx examples/07-advanced-patterns/08-edge-deployment.ts
 *
 * Expected Output:
 *   Deployment patterns for edge and serverless platforms.
 */

import { displayExampleInfo } from '../_shared/helpers.js';

function main() {
  displayExampleInfo(
    'Edge Deployment Patterns',
    'Deploy AI applications to edge runtimes globally',
    [
      'Cloudflare Workers / Vercel Edge Functions',
      'Understanding of serverless architecture',
      'Edge runtime limitations'
    ]
  );

  console.log('\n═'.repeat(60));
  console.log('Pattern 1: Cloudflare Workers');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// worker.ts - Cloudflare Workers
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      const { messages } = await request.json();

      // Create bridge (reuse if possible)
      const bridge = new Bridge(
        new OpenAIFrontendAdapter(),
        new AnthropicBackendAdapter({
          apiKey: env.ANTHROPIC_API_KEY, // From Workers secrets
        })
      );

      // Stream response
      const stream = await bridge.chatStream({
        model: 'gpt-4',
        messages,
        stream: true,
      });

      // Convert to ReadableStream
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      (async () => {
        for await (const chunk of stream) {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            await writer.write(encoder.encode(content));
          }
        }
        await writer.close();
      })();

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

// wrangler.toml
/*
name = "ai-matey-edge"
main = "worker.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

# Deploy: wrangler deploy
# Secrets: wrangler secret put ANTHROPIC_API_KEY
*/
`);

  console.log('═'.repeat(60));
  console.log('Pattern 2: Vercel Edge Functions');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// app/api/chat/route.ts - Vercel Edge Runtime
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

export const runtime = 'edge'; // Enable Edge Runtime

export async function POST(request: Request) {
  const { messages } = await request.json();

  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  );

  const stream = await bridge.chatStream({
    model: 'gpt-4',
    messages,
    stream: true,
  });

  // Streaming response for Next.js
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          controller.enqueue(encoder.encode(\`data: \${content}\\n\\n\`));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
`);

  console.log('═'.repeat(60));
  console.log('Pattern 3: Deno Deploy');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// main.ts - Deno Deploy
import { serve } from "https://deno.land/std/http/server.ts";
import { Bridge } from "npm:ai.matey.core";
import { OpenAIFrontendAdapter } from "npm:ai.matey.frontend/openai";
import { AnthropicBackendAdapter } from "npm:ai.matey.backend/anthropic";

serve(async (request: Request) => {
  if (request.method === "POST" && new URL(request.url).pathname === "/chat") {
    const { messages } = await request.json();

    const bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({
        apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
      })
    );

    const response = await bridge.chat({
      model: "gpt-4",
      messages,
    });

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Not Found", { status: 404 });
});

// Deploy: deployctl deploy --project=ai-matey main.ts
`);

  console.log('═'.repeat(60));
  console.log('Pattern 4: AWS Lambda@Edge');
  console.log('═'.repeat(60) + '\n');

  console.log(`
// lambda-edge.ts
import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';

export const handler = async (event: any) => {
  const body = JSON.parse(event.body);

  const bridge = new Bridge(
    new OpenAIFrontendAdapter(),
    new AnthropicBackendAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  );

  const response = await bridge.chat({
    model: 'gpt-4',
    messages: body.messages,
  });

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(response),
  };
};
`);

  console.log('\n💡 Edge Deployment Benefits:\n');
  console.log('   ✓ Global distribution (low latency)');
  console.log('   ✓ Auto-scaling (handle any load)');
  console.log('   ✓ Pay per request (cost-effective)');
  console.log('   ✓ Zero maintenance');
  console.log('   ✓ Built-in DDoS protection\n');

  console.log('⚠️  Edge Runtime Limitations:\n');
  console.log('   • Limited execution time (10-30s)');
  console.log('   • No file system access');
  console.log('   • Smaller bundle sizes');
  console.log('   • Cold start latency');
  console.log('   • Limited Node.js APIs\n');

  console.log('🎯 Optimization Strategies:\n');
  console.log('   • Minimize bundle size (tree-shaking)');
  console.log('   • Use streaming for long responses');
  console.log('   • Cache at CDN edge');
  console.log('   • Warm up with scheduled requests');
  console.log('   • Use edge-native APIs only\n');

  console.log('📊 Performance Characteristics:\n');
  console.log('   Platform          Cold Start    Max Duration    Regions');
  console.log('   ────────────────  ───────────  ──────────────  ────────');
  console.log('   Cloudflare        <50ms        30s (paid)      300+');
  console.log('   Vercel Edge       <100ms       25s             Global');
  console.log('   Deno Deploy       <100ms       Unlimited       35+');
  console.log('   AWS Lambda@Edge   ~300ms       5s              Global\n');

  console.log('🚀 Deployment Commands:\n');
  console.log('   # Cloudflare Workers');
  console.log('   wrangler deploy\n');
  console.log('   # Vercel');
  console.log('   vercel --prod\n');
  console.log('   # Deno Deploy');
  console.log('   deployctl deploy --project=ai-matey main.ts\n');
  console.log('   # AWS Lambda');
  console.log('   cdk deploy\n');
}

main();
