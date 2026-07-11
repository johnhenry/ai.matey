# ai.matey.native.node-llamacpp

## 0.2.1

### Patch Changes

- New LiteRT-LM backend adapter: run Gemma on-device in the browser via WebGPU
  (`@litert-lm/core`, optional peer). Streaming-native with engine caching per model URL,
  AbortSignal cancellation, and semantic-drift warnings for the Web SDK's dropped features
  (sampler params, tools, non-text content). Registry entries for Gemma-4 E2B/E4B. Also:
  node-llama-cpp is now properly declared as an optional peer dependency of
  ai.matey.native.node-llamacpp.
- Updated dependencies
  - ai.matey.utils@0.4.1
