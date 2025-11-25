/**
 * Property-based testing utilities - generate random valid inputs
 */

import type {
  IRChatRequest,
  IRMessage,
  MessageContent,
  IRParameters,
} from 'ai.matey.types';

/**
 * Random seed generator for deterministic randomness
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  /**
   * Generate next random number between 0 and 1
   */
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Pick random element from array
   */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return array[this.nextInt(0, array.length - 1)]!;
  }

  /**
   * Generate random boolean
   */
  nextBool(probability: number = 0.5): boolean {
    return this.next() < probability;
  }
}

/**
 * Generate random text content
 */
export function generateTextContent(random: SeededRandom): MessageContent {
  const texts = [
    'Hello, how are you?',
    'What is the weather today?',
    'Explain quantum computing',
    'Write a haiku about programming',
    'What is 2 + 2?',
    'Tell me a joke',
    'Summarize the main points',
    'Translate this to French',
    'Help me debug this code',
    'What are the benefits?',
  ];

  return {
    type: 'text',
    text: random.pick(texts),
  };
}

/**
 * Generate random user message
 */
export function generateUserMessage(random: SeededRandom): IRMessage {
  const contentCount = random.nextInt(1, 3);
  const content: MessageContent[] = [];

  for (let i = 0; i < contentCount; i++) {
    content.push(generateTextContent(random));
  }

  return {
    role: 'user',
    content,
  };
}

/**
 * Generate random assistant message
 */
export function generateAssistantMessage(random: SeededRandom): IRMessage {
  return {
    role: 'assistant',
    content: [generateTextContent(random)],
  };
}

/**
 * Generate random system message
 */
export function generateSystemMessage(random: SeededRandom): IRMessage {
  const systemPrompts = [
    'You are a helpful assistant',
    'You are an expert programmer',
    'You speak like a pirate',
    'You are a teacher',
    'You provide concise answers',
  ];

  return {
    role: 'system',
    content: [{
      type: 'text',
      text: random.pick(systemPrompts),
    }],
  };
}

/**
 * Generate random parameters
 */
export function generateParameters(random: SeededRandom): IRParameters {
  const models = [
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307',
    'gemini-1.5-pro',
    'llama3.2:1b',
  ];

  return {
    model: random.pick(models),
    temperature: Math.round(random.next() * 20) / 20, // 0.0 to 1.0 in 0.05 increments
    maxTokens: random.nextInt(50, 500),
    topP: random.nextBool() ? Math.round(random.next() * 20) / 20 : undefined,
  };
}

/**
 * Generate random chat request
 */
export function generateChatRequest(
  random: SeededRandom,
  options?: {
    includeSystem?: boolean;
    multiTurn?: boolean;
    minMessages?: number;
    maxMessages?: number;
  }
): IRChatRequest {
  const messages: IRMessage[] = [];

  // Add system message if requested
  if (options?.includeSystem && random.nextBool(0.5)) {
    messages.push(generateSystemMessage(random));
  }

  // Add conversation turns
  const minMessages = options?.minMessages ?? 1;
  const maxMessages = options?.maxMessages ?? 5;
  const messageCount = random.nextInt(minMessages, maxMessages);

  if (options?.multiTurn) {
    // Multi-turn conversation
    const turns = Math.floor(messageCount / 2);
    for (let i = 0; i < turns; i++) {
      messages.push(generateUserMessage(random));
      messages.push(generateAssistantMessage(random));
    }
  }

  // Always end with user message
  messages.push(generateUserMessage(random));

  return {
    messages,
    parameters: generateParameters(random),
    metadata: {
      requestId: `gen-${random.nextInt(1000, 9999)}`,
      timestamp: Date.now(),
    },
  };
}

/**
 * Property test: run test with multiple generated inputs
 */
export async function forAll<T>(
  generator: (random: SeededRandom) => T,
  test: (value: T) => void | Promise<void>,
  options?: {
    runs?: number;
    seed?: number;
  }
): Promise<void> {
  const runs = options?.runs ?? 100;
  const seed = options?.seed ?? Date.now();
  const random = new SeededRandom(seed);

  const failures: Array<{ run: number; value: T; error: Error }> = [];

  for (let i = 0; i < runs; i++) {
    const value = generator(random);

    try {
      await test(value);
    } catch (error) {
      failures.push({
        run: i,
        value,
        error: error as Error,
      });
    }
  }

  if (failures.length > 0) {
    const firstFailure = failures[0]!;
    throw new Error(
      `Property test failed on run ${firstFailure.run + 1}/${runs}\n` +
      `Seed: ${seed}\n` +
      `Value: ${JSON.stringify(firstFailure.value, null, 2)}\n` +
      `Error: ${firstFailure.error.message}\n` +
      `Total failures: ${failures.length}/${runs}`
    );
  }
}

/**
 * Shrink a failing value to find minimal failing case
 */
export function shrinkChatRequest(request: IRChatRequest): IRChatRequest[] {
  const shrunk: IRChatRequest[] = [];

  // Try removing messages
  if (request.messages.length > 1) {
    shrunk.push({
      ...request,
      messages: request.messages.slice(0, -1),
    });
  }

  // Try simplifying parameters
  shrunk.push({
    ...request,
    parameters: {
      ...request.parameters,
      temperature: 0.7,
      maxTokens: 100,
      topP: undefined,
    },
  });

  // Try removing content from messages
  for (let i = 0; i < request.messages.length; i++) {
    const message = request.messages[i]!;
    if (Array.isArray(message.content) && message.content.length > 1) {
      const newMessages = [...request.messages];
      newMessages[i] = {
        ...message,
        content: [message.content[0]!],
      };
      shrunk.push({
        ...request,
        messages: newMessages,
      });
    }
  }

  return shrunk;
}

/**
 * Example property tests
 */

/**
 * Property: All generated requests should be valid
 */
export async function propertyValidRequest(): Promise<void> {
  await forAll(
    (random) => generateChatRequest(random),
    (request) => {
      // Request should have messages
      if (request.messages.length === 0) {
        throw new Error('Request must have at least one message');
      }

      // Last message should be from user
      const lastMessage = request.messages[request.messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Last message must be from user');
      }

      // Parameters should be in valid ranges
      if (request.parameters?.temperature !== undefined) {
        if (request.parameters.temperature < 0 || request.parameters.temperature > 2) {
          throw new Error('Temperature must be between 0 and 2');
        }
      }

      if (request.parameters?.maxTokens !== undefined) {
        if (request.parameters.maxTokens < 1) {
          throw new Error('maxTokens must be positive');
        }
      }
    },
    { runs: 100 }
  );
}

/**
 * Property: Multi-turn conversations should alternate user/assistant
 */
export async function propertyMultiTurnAlternates(): Promise<void> {
  await forAll(
    (random) => generateChatRequest(random, { multiTurn: true }),
    (request) => {
      const nonSystemMessages = request.messages.filter(m => m.role !== 'system');

      for (let i = 0; i < nonSystemMessages.length - 1; i++) {
        const current = nonSystemMessages[i]!;
        const next = nonSystemMessages[i + 1]!;

        if (current.role === 'user' && next.role !== 'assistant') {
          throw new Error('User message must be followed by assistant message');
        }
        if (current.role === 'assistant' && next.role !== 'user') {
          throw new Error('Assistant message must be followed by user message');
        }
      }
    },
    { runs: 100 }
  );
}
