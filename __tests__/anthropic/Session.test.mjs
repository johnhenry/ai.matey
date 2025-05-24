// Simple Test Runner and Mocking Setup (similar to shared/Session.test.mjs)
const tests = [];
let originalFetch;
let mockFetchResponses = [];
let fetchCallArgs = []; // To store arguments of fetch calls

async function mockFetch(url, options) {
  fetchCallArgs.push({ url, options: JSON.parse(options.body) }); // Store parsed body
  if (mockFetchResponses.length === 0) {
    throw new Error('Mock fetch called but no response was queued.');
  }
  const mockResponse = mockFetchResponses.shift();
  if (mockResponse.error) {
    return Promise.resolve({
      ok: false,
      status: mockResponse.status || 500,
      statusText: mockResponse.statusText || 'Internal Server Error',
      text: () => Promise.resolve(typeof mockResponse.error === 'string' ? mockResponse.error : JSON.stringify(mockResponse.error)),
      json: () => Promise.resolve(mockResponse.error),
    });
  }

  if (mockResponse.stream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of mockResponse.chunks) {
          controller.enqueue(encoder.encode(chunk));
          await new Promise(resolve => setTimeout(resolve, 10)); // Simulate network delay
        }
        controller.close();
      }
    });
    return Promise.resolve({
      ok: true,
      status: mockResponse.status || 200,
      statusText: mockResponse.statusText || 'OK',
      body: stream,
      headers: new Headers({'Content-Type': 'text/event-stream'})
    });
  }

  return Promise.resolve({
    ok: true,
    status: mockResponse.status || 200,
    statusText: mockResponse.statusText || 'OK',
    json: () => Promise.resolve(mockResponse.json),
    text: () => Promise.resolve(JSON.stringify(mockResponse.json)), // if .text() is called
  });
}

function setupGlobalFetchMock() {
  originalFetch = global.fetch;
  global.fetch = mockFetch;
}

function teardownGlobalFetchMock() {
  global.fetch = originalFetch;
}

function queueMockResponse(response) {
  mockFetchResponses.push(response);
}

function clearFetchCallLog() {
  fetchCallArgs = [];
  mockFetchResponses = [];
}

function test(description, fn) {
  tests.push({ description, fn });
}

async function runAllTests() {
  setupGlobalFetchMock();
  for (const t of tests) {
    clearFetchCallLog(); // Clear for each test
    try {
      await t.fn();
      console.log(`✅ PASS: ${t.description}`);
    } catch (e) {
      console.error(`❌ FAIL: ${t.description}`);
      console.error(e.stack); // Print stack trace for better debugging
    }
  }
  teardownGlobalFetchMock();
}

// --- End of Simple Test Runner ---

// Import the class to be tested
import AnthropicSession from '../../anthropic/Session.mjs'; // Adjust path as needed

// Mock AI interface for Session constructor
const mockAiConfig = {
  model: 'claude-3-opus-20240229',
  endpoint: 'https://api.anthropic.com', // Default endpoint
  credentials: { apiKey: 'test-api-key' }
};
const mockAiInterface = {
  config: mockAiConfig,
  languageModel: { _capabilities: { defaultTemperature: 0.7, maxTokens: 4096 } }
};

// Helper to create a simple Blob in Node.js (for testing purposes)
function createTestBlob(content, type) {
  if (typeof Blob === 'undefined') {
    // Node.js environment
    const { Blob } = await import('node:buffer');
    return new Blob([content], { type });
  }
  // Browser environment
  return new Blob([content], { type });
}


// --- Tests for Anthropic Session ---

test('Anthropic: promptStreaming - string input (text-only)', async () => {
  const session = new AnthropicSession({ systemPrompt: "Be helpful" }, mockAiInterface);
  session._addToHistory("Previous user query", "Previous assistant answer");

  queueMockResponse({
    stream: true,
    chunks: [
      'event: message_start\ndata: {"type": "message_start", "message": {"id": "msg_123", "type": "message", "role": "assistant", "content": [], "model": "claude-3", "stop_reason": null, "stop_sequence": null, "usage": {"input_tokens": 10, "output_tokens": 1}}}\n\n',
      'event: content_block_start\ndata: {"type": "content_block_start", "index":0, "content_block": {"type": "text", "text": ""}}\n\n',
      'event: content_block_delta\ndata: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Hello"}}\n\n',
      'event: content_block_delta\ndata: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": " world"}}\n\n',
      'event: content_block_stop\ndata: {"type": "content_block_stop", "index":0}\n\n',
      'event: message_delta\ndata: {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence":null, "usage":{"output_tokens": 2}}}\n\n',
      'event: message_stop\ndata: {"type": "message_stop"}\n\n'
    ]
  });

  const input = "Current user query";
  let responseText = "";
  for await (const chunk of session.promptStreaming(input, { temperature: 0.5, maxTokens: 100 })) {
    responseText += chunk;
  }

  console.assert(responseText === "Hello world", `Expected "Hello world", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  console.assert(requestPayload.messages.length === 3, `Expected 3 messages, got ${requestPayload.messages.length}`); // history (user, assistant) + current input
  console.assert(requestPayload.messages[0].role === "user", "History message 1 role mismatch");
  console.assert(requestPayload.messages[1].role === "assistant", "History message 2 role mismatch");
  console.assert(requestPayload.messages[2].role === "user", "Current message role mismatch");
  console.assert(requestPayload.messages[2].content[0].text === "Current user query", "Current message content mismatch");
  console.assert(requestPayload.system === "Be helpful", "System prompt mismatch");
  console.assert(requestPayload.temperature === 0.5, "Temperature option mismatch");
  console.assert(requestPayload.max_tokens === 100, "max_tokens option mismatch");

  const history = session._getConversationHistory();
  console.assert(history.length === 4, `Expected history length 4, got ${history.length}`);
  console.assert(history[3].role === "assistant" && history[3].content === "Hello world", "History not updated correctly");
});


test('Anthropic: promptStreaming - array input (text-only)', async () => {
  const session = new AnthropicSession({}, mockAiInterface);
  session._setConversationHistory([{role: "user", content: "Initial context"}]); // Set some prior history

  queueMockResponse({
    stream: true,
    chunks: [
      'event: message_start\ndata: {"type": "message_start", "message": {"role": "assistant"}}\n\n',
      'event: content_block_delta\ndata: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Array response"}}\n\n',
      'event: message_stop\ndata: {"type": "message_stop"}\n\n'
    ]
  });

  const inputArray = [
    { role: 'user', content: 'Follow up 1' },
    { role: 'assistant', content: 'Okay' },
    { role: 'user', content: 'Follow up 2' }
  ];
  
  // Note: For Anthropic, the `input` array in `promptStreaming` is treated as the content of the *last user message*.
  // The `chat()` method in SharedSession would call `_setConversationHistory` with messages *before* the last one.
  // So, if we are testing `promptStreaming` directly with an array, it means that array IS the last user message,
  // potentially multimodal. Here, it's text-only parts.
  
  // To simulate `chat()` behavior for array input:
  // 1. Current `input` to `promptStreaming` is the *last user message content*, potentially an array of parts.
  // 2. History *before* this last user message is already set via `_setConversationHistory`.
  
  // Let's adjust the test to reflect `promptStreaming`'s direct expectation.
  // The `input` will be the content of the last user message.
  const lastUserMessageContent = [
      { type: 'text', value: 'This is the last user message, composed of parts.'}
  ];
   session._setConversationHistory([ // History *before* the last user message
    {role: "user", content: "Initial context"}, 
    {role: "assistant", content: "Response to initial context"}
  ]);


  let responseText = "";
  // Pass the array representing the last user message's content
  for await (const chunk of session.promptStreaming(lastUserMessageContent, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "Array response", `Expected "Array response", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  // Expected messages: history (user, assistant) + current user message (built from lastUserMessageContent)
  console.assert(requestPayload.messages.length === 3, `Expected 3 messages, got ${requestPayload.messages.length}`);
  console.assert(requestPayload.messages[2].role === "user", "Last message role mismatch");
  console.assert(requestPayload.messages[2].content[0].type === "text", "Last message content type mismatch");
  console.assert(requestPayload.messages[2].content[0].text === "This is the last user message, composed of parts.", "Last message content text mismatch");
  
  const history = session._getConversationHistory();
  // Expected history: old_history + last_user_message (as array) + assistant_response
  console.assert(history.length === 4, `Expected history length 4, got ${history.length}`);
  console.assert(JSON.stringify(history[2].content) === JSON.stringify(lastUserMessageContent) , "User message in history mismatch");
  console.assert(history[3].content === "Array response", "Assistant response in history mismatch");

});

test('Anthropic: promptStreaming - multimodal input (text + image Blob)', async () => {
  const session = new AnthropicSession({}, mockAiInterface);
  const imageBlob = await createTestBlob(["dummy image data"], "image/png");
  
  const input = [
    { type: 'text', value: 'Describe this image:' },
    { type: 'image', value: imageBlob, mimeType: 'image/png' } // mimeType here is illustrative, actual Blob has it
  ];

  queueMockResponse({
    stream: true,
    chunks: [
      'event: message_start\ndata: {"type": "message_start", "message": {"role": "assistant"}}\n\n',
      'event: content_block_delta\ndata: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "It is an image."}}\n\n',
      'event: message_stop\ndata: {"type": "message_stop"}\n\n'
    ]
  });

  let responseText = "";
  for await (const chunk of session.promptStreaming(input, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "It is an image.", `Expected "It is an image.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  const userMessageContent = requestPayload.messages[0].content;
  console.assert(userMessageContent.length === 2, "Expected 2 parts in user message content");
  console.assert(userMessageContent[0].type === "text" && userMessageContent[0].text === "Describe this image:", "Text part mismatch");
  console.assert(userMessageContent[1].type === "image", "Image part type mismatch");
  console.assert(userMessageContent[1].source.type === "base64", "Image source type mismatch");
  console.assert(userMessageContent[1].source.media_type === "image/png", "Image media_type mismatch");
  console.assert(userMessageContent[1].source.data.length > 0, "Image data missing"); // Basic check for base64 data

  const history = session._getConversationHistory();
  console.assert(history.length === 2, "History length mismatch");
  console.assert(JSON.stringify(history[0].content) === JSON.stringify(input), "Multimodal user input not stored correctly in history");
});

test('Anthropic: promptStreaming - multimodal input (text + base64 image string)', async () => {
  const session = new AnthropicSession({}, mockAiInterface);
  const base64ImageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="; // 1x1 black pixel
  
  const input = [
    { type: 'text', value: 'Analyze:' },
    { type: 'image', value: base64ImageData, mimeType: 'image/png' } // Provide mimeType
  ];

  queueMockResponse({
    stream: true,
    chunks: [
        'event: message_start\ndata: {"type": "message_start", "message": {"role": "assistant"}}\n\n',
        'event: content_block_delta\ndata: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Base64 image."}}\n\n',
        'event: message_stop\ndata: {"type": "message_stop"}\n\n'
    ]
  });

  let responseText = "";
  for await (const chunk of session.promptStreaming(input, {})) {
    responseText += chunk;
  }

  console.assert(responseText === "Base64 image.", `Expected "Base64 image.", got "${responseText}"`);
  
  const requestPayload = fetchCallArgs[0].options;
  const userMessageContent = requestPayload.messages[0].content;
  console.assert(userMessageContent[1].type === "image", "Image part type mismatch");
  console.assert(userMessageContent[1].source.media_type === "image/png", "Image media_type mismatch for base64");
  console.assert(userMessageContent[1].source.data === base64ImageData, "Image base64 data mismatch");
});


test('Anthropic: promptStreaming - API error handling', async () => {
  const session = new AnthropicSession({}, mockAiInterface);
  queueMockResponse({
    error: { type: 'error', error: { type: 'invalid_request_error', message: 'Bad request' } },
    status: 400
  });

  let errorThrown = false;
  try {
    for await (const chunk of session.promptStreaming("test error", {})) {
      // Should not yield anything
    }
  } catch (e) {
    errorThrown = true;
    console.assert(e.message.includes("HTTP error! status: 400") || e.message.includes("Bad request"), `Error message mismatch: ${e.message}`);
  }
  console.assert(errorThrown, "API error did not throw an exception");
});


test('Anthropic: promptStreaming - options passthrough (max_tokens, temperature)', async () => {
    const session = new AnthropicSession({}, mockAiInterface);
    queueMockResponse({
        stream: true,
        chunks: [
            'event: message_start\ndata: {"type": "message_start", "message": {"role": "assistant"}}\n\n',
            'event: content_block_delta\ndata: {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "Test"}}\n\n',
            'event: message_stop\ndata: {"type": "message_stop"}\n\n'
        ]
    });

    await session.promptStreaming("Test options", { temperature: 0.9, maxTokens: 150 }).next(); // Consume one item to trigger fetch

    const requestPayload = fetchCallArgs[0].options;
    console.assert(requestPayload.temperature === 0.9, "Temperature not passed through");
    console.assert(requestPayload.max_tokens === 150, "max_tokens (mapped from maxTokens) not passed through");
});


// Run all tests when the file is executed
runAllTests();
// To run: node __tests__/anthropic/Session.test.mjs
// Ensure relative path to anthropic/Session.mjs is correct.
// Ensure Blob polyfill or Node version >= 15.7.0 (for Blob) or 16.5.0 (for buffer.Blob) is available if running in Node.
// The createTestBlob helper tries to use node:buffer's Blob if global Blob is not found.
