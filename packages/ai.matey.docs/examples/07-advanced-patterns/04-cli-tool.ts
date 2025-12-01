/**
 * CLI Tool - Interactive AI Assistant
 *
 * Demonstrates:
 * - Building production CLI tools with ai.matey
 * - Interactive prompts and streaming output
 * - Configuration management
 * - Session history and context
 * - Error handling and user experience
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY in web.env.local.mjs
 * - Optionally: npm install commander inquirer ora chalk
 *
 * Run:
 *   npx tsx examples/07-advanced-patterns/04-cli-tool.ts
 *   npx tsx examples/07-advanced-patterns/04-cli-tool.ts "What is TypeScript?"
 *
 * Expected Output:
 *   Interactive CLI tool with streaming responses,
 *   history, and professional output formatting.
 */

import { Bridge } from 'ai.matey.core';
import { OpenAIFrontendAdapter } from 'ai.matey.frontend/openai';
import { AnthropicBackendAdapter } from 'ai.matey.backend/anthropic';
import { requireAPIKey } from '../_shared/env-loader.js';
import { displayError } from '../_shared/helpers.js';
import * as readline from 'readline';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class AIChatCLI {
  private bridge: Bridge;
  private conversationHistory: Message[] = [];
  private rl: readline.Interface;

  constructor(apiKey: string) {
    this.bridge = new Bridge(
      new OpenAIFrontendAdapter(),
      new AnthropicBackendAdapter({ apiKey })
    );

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // System prompt
    this.conversationHistory.push({
      role: 'system',
      content: 'You are a helpful AI assistant. Provide concise, accurate answers.',
    });
  }

  private async askQuestion(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  private async chat(userMessage: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    try {
      const stream = await this.bridge.chatStream({
        model: 'gpt-4',
        messages: this.conversationHistory as any,
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      });

      let fullResponse = '';
      process.stdout.write('\n🤖 AI: ');

      for await (const chunk of stream) {
        if (chunk.choices && chunk.choices[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          process.stdout.write(content);
          fullResponse += content;
        }
      }

      console.log('\n');

      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });

      return fullResponse;
    } catch (error) {
      throw error;
    }
  }

  async runOneShot(query: string) {
    console.log('\n🔮 AI Matey CLI - One-shot Mode\n');
    console.log('📝 Question:', query, '\n');

    try {
      await this.chat(query);
      this.cleanup();
    } catch (error) {
      displayError(error, 'CLI query');
      this.cleanup();
      process.exit(1);
    }
  }

  async runInteractive() {
    console.log('\n🔮 AI Matey CLI - Interactive Mode');
    console.log('═'.repeat(60));
    console.log('💡 Type your questions or commands:');
    console.log('   • /history - View conversation history');
    console.log('   • /clear   - Clear conversation');
    console.log('   • /exit    - Exit the CLI');
    console.log('   • /help    - Show this help');
    console.log('═'.repeat(60) + '\n');

    while (true) {
      try {
        const input = await this.askQuestion('👤 You: ');

        if (!input.trim()) continue;

        // Handle commands
        if (input.startsWith('/')) {
          if (input === '/exit' || input === '/quit') {
            console.log('\n👋 Goodbye!\n');
            this.cleanup();
            break;
          }

          if (input === '/clear') {
            this.conversationHistory = [this.conversationHistory[0]]; // Keep system prompt
            console.log('\n✓ Conversation cleared\n');
            continue;
          }

          if (input === '/history') {
            console.log('\n📜 Conversation History:');
            console.log('─'.repeat(60));
            this.conversationHistory
              .filter((m) => m.role !== 'system')
              .forEach((msg, i) => {
                const icon = msg.role === 'user' ? '👤' : '🤖';
                console.log(`${icon} ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
              });
            console.log('─'.repeat(60) + '\n');
            continue;
          }

          if (input === '/help') {
            console.log('\n💡 Available Commands:');
            console.log('   /history - View conversation');
            console.log('   /clear   - Clear history');
            console.log('   /exit    - Exit CLI');
            console.log('   /help    - Show help\n');
            continue;
          }

          console.log(`\n❌ Unknown command: ${input}`);
          console.log('   Type /help for available commands\n');
          continue;
        }

        // Regular chat
        await this.chat(input);
      } catch (error) {
        console.log('\n❌ Error:', (error as Error).message, '\n');
        console.log('💡 Tip: Check your API key and network connection\n');
      }
    }
  }

  cleanup() {
    this.rl.close();
  }
}

async function main() {
  try {
    const apiKey = requireAPIKey('anthropic');
    const cli = new AIChatCLI(apiKey);

    // Check if query provided as argument
    const args = process.argv.slice(2);
    const query = args.join(' ');

    if (query) {
      // One-shot mode
      await cli.runOneShot(query);
    } else {
      // Interactive mode
      await cli.runInteractive();
    }
  } catch (error) {
    displayError(error, 'CLI tool');
    process.exit(1);
  }
}

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n\n👋 Interrupted. Goodbye!\n');
  process.exit(0);
});

main();
