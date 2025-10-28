/**
 * Structured Output Example
 *
 * Demonstrates using Zod schemas to extract structured data from LLM responses.
 *
 * This example shows three approaches:
 * 1. Standalone generateObject() function (works directly with backend adapter)
 * 2. Bridge.generateObject() method (works with routing and middleware)
 * 3. Streaming with generateObjectStream() (progressive validation)
 *
 * Prerequisites:
 * - npm install zod zod-to-json-schema
 * - Set OPENAI_API_KEY environment variable
 *
 * Run:
 * - tsx examples/structured-output.ts
 */

import { z } from 'zod';
import { createOpenAIBackendAdapter } from '../src/adapters/backend/index.js';
import { createOpenAIFrontendAdapter } from '../src/adapters/frontend/index.js';
import { createBridge } from '../src/core/bridge.js';
import { generateObject, generateObjectStream } from '../src/structured/index.js';

// ============================================================================
// Define Schemas
// ============================================================================

/**
 * Person schema with validation rules.
 */
const PersonSchema = z.object({
  name: z.string().min(1).describe('Full name of the person'),
  age: z.number().int().min(0).max(150).describe('Age in years'),
  email: z.string().email().describe('Email address'),
  occupation: z.string().optional().describe('Current occupation'),
});

/**
 * Recipe schema with nested structure.
 */
const RecipeSchema = z.object({
  name: z.string().describe('Name of the recipe'),
  servings: z.number().int().positive().describe('Number of servings'),
  prepTime: z.number().int().positive().describe('Preparation time in minutes'),
  cookTime: z.number().int().positive().describe('Cooking time in minutes'),
  difficulty: z.enum(['easy', 'medium', 'hard']).describe('Difficulty level'),
  ingredients: z.array(
    z.object({
      name: z.string(),
      amount: z.string(),
    })
  ).describe('List of ingredients'),
  instructions: z.array(z.string()).describe('Step-by-step instructions'),
  tags: z.array(z.string()).optional().describe('Recipe tags (e.g., vegetarian, gluten-free)'),
});

// Infer TypeScript types from schemas
type Person = z.infer<typeof PersonSchema>;
type Recipe = z.infer<typeof RecipeSchema>;

// ============================================================================
// Example 1: Standalone generateObject()
// ============================================================================

async function exampleStandalone() {
  console.log('\n=== Example 1: Standalone generateObject() ===\n');

  // Create backend adapter
  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  try {
    // Extract person data using tool calling
    const result = await generateObject<Person>({
      backend,
      schema: PersonSchema,
      messages: [
        {
          role: 'user',
          content: 'Extract person info: John Doe is a 30-year-old software engineer. His email is john.doe@example.com',
        },
      ],
      mode: 'tools', // Use function/tool calling (most reliable)
      name: 'extract_person',
      description: 'Extract person information from text',
    });

    console.log('Extracted data:', result.data);
    console.log('Validation warnings:', result.warnings || 'None');
    console.log('Metadata:', {
      model: result.metadata.model,
      latency: `${result.metadata.latencyMs}ms`,
      tokens: result.metadata.usage,
    });
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

// ============================================================================
// Example 2: Bridge.generateObject()
// ============================================================================

async function exampleBridge() {
  console.log('\n=== Example 2: Bridge.generateObject() ===\n');

  // Create adapters
  const frontend = createOpenAIFrontendAdapter();
  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  // Create bridge (works with routing and middleware)
  const bridge = createBridge(frontend, backend, {
    defaultModel: 'gpt-4o-mini',
  });

  try {
    // Extract person data via Bridge
    const result = await bridge.generateObject<Person>({
      schema: PersonSchema,
      messages: [
        {
          role: 'user',
          content: 'Extract: Sarah Johnson, age 28, sarah.j@company.com, data scientist',
        },
      ],
      mode: 'json_schema', // Use OpenAI's json_schema mode
    });

    console.log('Extracted data:', result.data);
    console.log('✓ Name:', result.data.name);
    console.log('✓ Age:', result.data.age);
    console.log('✓ Email:', result.data.email);
    console.log('✓ Occupation:', result.data.occupation || 'Not specified');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
  }
}

// ============================================================================
// Example 3: Streaming with Progressive Validation
// ============================================================================

async function exampleStreaming() {
  console.log('\n=== Example 3: Streaming with generateObjectStream() ===\n');

  // Create backend adapter
  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  try {
    console.log('Requesting chocolate chip cookie recipe...\n');

    const stream = generateObjectStream<Recipe>({
      backend,
      schema: RecipeSchema,
      messages: [
        {
          role: 'user',
          content: 'Give me a simple chocolate chip cookie recipe',
        },
      ],
      mode: 'tools',
      onPartial: (partial) => {
        // Called for each progressive update
        if (partial.name) {
          process.stdout.write('\r' + `Recipe: ${partial.name}...`);
        }
      },
    });

    let finalRecipe: Recipe | undefined;

    for await (const partial of stream) {
      // You can use partial data to update UI progressively
      finalRecipe = partial as Recipe;
    }

    if (finalRecipe) {
      console.log('\n\n✓ Final Recipe:');
      console.log(`  Name: ${finalRecipe.name}`);
      console.log(`  Servings: ${finalRecipe.servings}`);
      console.log(`  Prep: ${finalRecipe.prepTime}min, Cook: ${finalRecipe.cookTime}min`);
      console.log(`  Difficulty: ${finalRecipe.difficulty}`);
      console.log(`  Ingredients (${finalRecipe.ingredients.length}):`);
      finalRecipe.ingredients.forEach((ing, i) => {
        console.log(`    ${i + 1}. ${ing.amount} ${ing.name}`);
      });
      console.log(`  Steps: ${finalRecipe.instructions.length}`);
      if (finalRecipe.tags) {
        console.log(`  Tags: ${finalRecipe.tags.join(', ')}`);
      }
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error);
  }
}

// ============================================================================
// Example 4: Different Extraction Modes
// ============================================================================

async function exampleModes() {
  console.log('\n=== Example 4: Different Extraction Modes ===\n');

  const backend = createOpenAIBackendAdapter({
    apiKey: process.env.OPENAI_API_KEY || '',
  });

  const testData = 'Bob Smith, 45, bob@example.com, teacher';

  // Try different modes
  const modes = ['tools', 'json_schema', 'json', 'md_json'] as const;

  for (const mode of modes) {
    try {
      console.log(`\nMode: ${mode}`);
      const result = await generateObject<Person>({
        backend,
        schema: PersonSchema,
        messages: [{ role: 'user', content: `Extract: ${testData}` }],
        mode,
      });
      console.log(`  ✓ Extracted: ${result.data.name}, ${result.data.age}y, ${result.data.email}`);
    } catch (error) {
      console.log(`  ✗ Failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  console.log('Structured Output Examples');
  console.log('==========================');

  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('\n❌ Error: OPENAI_API_KEY environment variable not set');
    console.log('Set it with: export OPENAI_API_KEY=your-key-here\n');
    process.exit(1);
  }

  try {
    // Run examples
    await exampleStandalone();
    await exampleBridge();
    await exampleStreaming();
    await exampleModes();

    console.log('\n✓ All examples completed!\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
