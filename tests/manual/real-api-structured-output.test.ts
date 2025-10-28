/**
 * Real API Integration Tests for Structured Output
 *
 * These tests require actual API keys and make real API calls.
 * Run with: npm run test:manual
 *
 * Required environment variables:
 * - OPENAI_API_KEY
 * - ANTHROPIC_API_KEY
 * - GOOGLE_API_KEY (for Gemini)
 *
 * @group manual
 * @group integration
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { generateObject, generateObjectStream } from '../../src/structured/generate-object.js';
import { OpenAIBackendAdapter } from '../../src/adapters/backend/openai.js';
import { AnthropicBackendAdapter } from '../../src/adapters/backend/anthropic.js';
import { GeminiBackendAdapter } from '../../src/adapters/backend/gemini.js';

// Skip if no API keys are provided
const skipIfNoKeys = () => {
  const hasKeys = process.env.OPENAI_API_KEY ||
                  process.env.ANTHROPIC_API_KEY ||
                  process.env.GOOGLE_API_KEY;
  if (!hasKeys) {
    console.warn('⚠️  Skipping real API tests - no API keys found in environment');
    return true;
  }
  return false;
};

// Test schemas
const UserSchema = z.object({
  name: z.string().describe('Full name of the person'),
  age: z.number().describe('Age in years'),
  email: z.string().email().describe('Email address'),
  occupation: z.string().describe('Current occupation'),
});

const ExtractedDataSchema = z.object({
  entities: z.array(z.string()).describe('Named entities found in text'),
  sentiment: z.enum(['positive', 'negative', 'neutral']).describe('Overall sentiment'),
  keyPoints: z.array(z.string()).describe('Key points or takeaways'),
});

// ============================================================================
// OpenAI Real API Tests
// ============================================================================

describe.skipIf(skipIfNoKeys())('OpenAI Real API - Structured Output', () => {
  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  it('should extract user data with tools mode', async () => {
    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [
        {
          role: 'user',
          content: 'Extract information: John Smith is a 35-year-old software engineer. His email is john.smith@example.com',
        },
      ],
      mode: 'tools',
      model: 'gpt-4o-mini',
    });

    expect(result.data).toBeDefined();
    expect(result.data.name).toContain('John');
    expect(result.data.age).toBe(35);
    expect(result.data.email).toContain('example.com');
    expect(result.data.occupation).toContain('engineer');
    expect(result.metadata.usage).toBeDefined();
    expect(result.metadata.usage?.totalTokens).toBeGreaterThan(0);
  }, 30000);

  it('should extract user data with json_schema mode', async () => {
    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [
        {
          role: 'user',
          content: 'Create a profile for Alice Johnson, age 28, email alice.j@company.io, data analyst',
        },
      ],
      mode: 'json_schema',
      model: 'gpt-4o-mini',
    });

    expect(result.data).toBeDefined();
    expect(result.data.name).toContain('Alice');
    expect(result.data.age).toBe(28);
    expect(result.metadata.finishReason).toBe('stop');
  }, 30000);

  it('should stream structured output progressively', async () => {
    const partials: any[] = [];
    let finalObject: any;

    const stream = generateObjectStream({
      backend,
      schema: ExtractedDataSchema,
      messages: [
        {
          role: 'user',
          content: `Analyze this text: "The new product launch was incredibly successful!
          We saw record sales and amazing customer feedback. Key achievements include
          hitting our Q1 targets, expanding to 5 new markets, and winning Best Product Award."`,
        },
      ],
      mode: 'tools',
      model: 'gpt-4o-mini',
      onPartial: (partial) => {
        partials.push(partial);
      },
    });

    for await (const partial of stream) {
      finalObject = partial;
    }

    expect(finalObject).toBeDefined();
    expect(finalObject.sentiment).toBe('positive');
    expect(Array.isArray(finalObject.entities)).toBe(true);
    expect(Array.isArray(finalObject.keyPoints)).toBe(true);
    expect(partials.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle complex nested schemas', async () => {
    const ComplexSchema = z.object({
      company: z.object({
        name: z.string(),
        founded: z.number(),
        employees: z.number(),
      }),
      products: z.array(z.object({
        name: z.string(),
        price: z.number(),
      })),
      revenue: z.object({
        q1: z.number(),
        q2: z.number(),
        total: z.number(),
      }),
    });

    const result = await generateObject({
      backend,
      schema: ComplexSchema,
      messages: [
        {
          role: 'user',
          content: `Create data for TechCorp, founded 2020, 150 employees.
          Products: Widget Pro ($99), Super Widget ($199).
          Q1 revenue $500k, Q2 $750k, total $1.25M`,
        },
      ],
      mode: 'tools',
      model: 'gpt-4o-mini',
    });

    expect(result.data.company.name).toContain('Tech');
    expect(result.data.company.founded).toBe(2020);
    expect(result.data.products.length).toBe(2);
    expect(result.data.revenue.total).toBe(1250000);
  }, 30000);
});

// ============================================================================
// Anthropic Real API Tests
// ============================================================================

describe.skipIf(skipIfNoKeys())('Anthropic Real API - Structured Output', () => {
  const backend = new AnthropicBackendAdapter({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  });

  it('should extract user data with tools mode', async () => {
    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [
        {
          role: 'user',
          content: 'Extract: Sarah Williams, 42 years old, doctor, email: s.williams@hospital.org',
        },
      ],
      mode: 'tools',
      model: 'claude-3-5-sonnet-20241022',
    });

    expect(result.data).toBeDefined();
    expect(result.data.name).toContain('Sarah');
    expect(result.data.age).toBe(42);
    expect(result.data.occupation).toContain('doctor');
    expect(result.metadata.usage).toBeDefined();
  }, 30000);

  it('should handle md_json mode as fallback', async () => {
    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [
        {
          role: 'user',
          content: 'Create profile: Bob Lee, 31, teacher, bob.lee@school.edu',
        },
      ],
      mode: 'md_json',
      model: 'claude-3-5-haiku-20241022',
    });

    expect(result.data).toBeDefined();
    expect(result.data.name).toContain('Bob');
    expect(result.data.age).toBe(31);
  }, 30000);

  it('should stream with proper tool call handling', async () => {
    let finalObject: any;

    const stream = generateObjectStream({
      backend,
      schema: ExtractedDataSchema,
      messages: [
        {
          role: 'user',
          content: 'Analyze: "The service was terrible. Long wait times, rude staff, and poor quality. Completely disappointed."',
        },
      ],
      mode: 'tools',
      model: 'claude-3-5-sonnet-20241022',
    });

    for await (const partial of stream) {
      finalObject = partial;
    }

    expect(finalObject).toBeDefined();
    expect(finalObject.sentiment).toBe('negative');
  }, 30000);
});

// ============================================================================
// Gemini Real API Tests
// ============================================================================

describe.skipIf(skipIfNoKeys())('Gemini Real API - Structured Output', () => {
  const backend = new GeminiBackendAdapter({
    apiKey: process.env.GOOGLE_API_KEY!,
  });

  it('should extract user data with tools mode', async () => {
    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [
        {
          role: 'user',
          content: 'Extract: Maria Garcia, 29, graphic designer, maria.g@creative.com',
        },
      ],
      mode: 'tools',
      model: 'gemini-1.5-flash',
    });

    expect(result.data).toBeDefined();
    expect(result.data.name).toContain('Maria');
    expect(result.data.age).toBe(29);
    expect(result.data.occupation).toContain('designer');
  }, 30000);

  it('should handle json mode fallback', async () => {
    const result = await generateObject({
      backend,
      schema: UserSchema,
      messages: [
        {
          role: 'user',
          content: 'Create: David Kim, 38, accountant, d.kim@finance.com',
        },
      ],
      mode: 'json',
      model: 'gemini-1.5-flash',
    });

    expect(result.data).toBeDefined();
    expect(result.data.age).toBe(38);
  }, 30000);
});

// ============================================================================
// Cross-Provider Consistency Tests
// ============================================================================

describe.skipIf(skipIfNoKeys())('Cross-Provider Consistency', () => {
  const prompt = 'Extract: Test User, 25, developer, test@example.com';
  const providers = [
    { name: 'OpenAI', backend: new OpenAIBackendAdapter({ apiKey: process.env.OPENAI_API_KEY! }), model: 'gpt-4o-mini' },
    { name: 'Anthropic', backend: new AnthropicBackendAdapter({ apiKey: process.env.ANTHROPIC_API_KEY! }), model: 'claude-3-5-haiku-20241022' },
    { name: 'Gemini', backend: new GeminiBackendAdapter({ apiKey: process.env.GOOGLE_API_KEY! }), model: 'gemini-1.5-flash' },
  ].filter(p => {
    // Only test providers with valid API keys
    if (p.name === 'OpenAI' && !process.env.OPENAI_API_KEY) return false;
    if (p.name === 'Anthropic' && !process.env.ANTHROPIC_API_KEY) return false;
    if (p.name === 'Gemini' && !process.env.GOOGLE_API_KEY) return false;
    return true;
  });

  it('should produce consistent results across providers', async () => {
    const results = await Promise.all(
      providers.map(async ({ name, backend, model }) => {
        const result = await generateObject({
          backend,
          schema: UserSchema,
          messages: [{ role: 'user', content: prompt }],
          mode: 'tools',
          model,
        });
        return { name, data: result.data };
      })
    );

    // All providers should extract the same basic information
    for (const { data } of results) {
      expect(data.name).toContain('Test');
      expect(data.age).toBe(25);
      expect(data.occupation).toContain('developer');
      expect(data.email).toContain('example.com');
    }

    console.log('✅ Cross-provider consistency verified:', results.map(r => r.name).join(', '));
  }, 60000);
});

// ============================================================================
// Error Handling and Edge Cases
// ============================================================================

describe.skipIf(skipIfNoKeys())('Real API Error Handling', () => {
  const backend = new OpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY!,
  });

  it('should handle invalid model gracefully', async () => {
    await expect(async () => {
      await generateObject({
        backend,
        schema: UserSchema,
        messages: [{ role: 'user', content: 'Extract: John, 30, dev, john@test.com' }],
        mode: 'tools',
        model: 'gpt-invalid-model-xyz',
      });
    }).rejects.toThrow();
  }, 15000);

  it('should handle abort signal', async () => {
    const controller = new AbortController();

    const promise = generateObject({
      backend,
      schema: UserSchema,
      messages: [{ role: 'user', content: 'Extract: Jane, 25, engineer, jane@test.com' }],
      mode: 'tools',
      model: 'gpt-4o-mini',
      signal: controller.signal,
    });

    // Abort after a short delay
    setTimeout(() => controller.abort(), 100);

    await expect(promise).rejects.toThrow();
  }, 15000);

  it('should handle schema validation failures', async () => {
    const StrictSchema = z.object({
      age: z.number().min(0).max(120),
      email: z.string().email(),
    });

    // This should fail validation if the model produces invalid data
    try {
      const result = await generateObject({
        backend,
        schema: StrictSchema,
        messages: [{ role: 'user', content: 'Age: 999, Email: not-an-email' }],
        mode: 'tools',
        model: 'gpt-4o-mini',
      });
      // If it succeeds, model corrected the input
      expect(result.data.age).toBeLessThanOrEqual(120);
    } catch (error) {
      // Validation failure is expected
      expect(error).toBeDefined();
    }
  }, 30000);
});
