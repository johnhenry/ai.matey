# ai.matey.http

## 0.2.1

### Patch Changes

- Fix HTTP streaming implementation for Express
  - Implement SSE streaming manually for Express compatibility
  - Remove dependency on sendSSEHeaders/sendSSEChunk/sendSSEDone helpers
  - Add flushHeaders() call to ensure headers are sent immediately
  - Write chunks in proper SSE format: data: {json}\n\n
  - Send [DONE] marker when stream completes

  Verified working with OpenAI backend successfully streaming chunks.
