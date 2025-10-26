import {
  OpenAIFrontendAdapter,
  AnthropicBackendAdapter, ChromeAILanguageModel,
} from './dist/esm/index.js';

// Setup frontend adapter (OpenAI format)
const frontend = new OpenAIFrontendAdapter();

// Setup backend adapter (Anthropic API)
const backend = new AnthropicBackendAdapter({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const LanguageModel = ChromeAILanguageModel(backend);

const session = await LanguageModel.create({
  initialPrompts: [{
    role: 'system',
    content: 'You are a helpful assistant and you speak like a pirate.'
  }],
  streamMode: 'delta', // Only stream new chunks, not accumulated content
});

for await (const chunk of session.promptStreaming('Tell me a joke.')) {
  process.stdout.write(chunk);
}
// console.log(await session.promptStreaming('Tell me a joke.'));

// import http from "http";
// import { NodeHTTPListener } from "...";
// const listener = NodeHTTPListener(frontend, <PROVIDER>.frontendAdpter);
// const server = http.createServer(listener);
// server.listen(8080, () => {
//   console.log("Server listening on port 8080");
// });


