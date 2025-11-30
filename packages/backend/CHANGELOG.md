# ai.matey.backend

## 0.2.1

### Patch Changes

- Fix default models for Anthropic and Groq backends
  - Changed Anthropic default model from claude-3-5-sonnet-20241022 to claude-3-haiku-20240307 (more widely available)
  - Added Groq default model llama-3.3-70b-versatile (was inheriting invalid gpt-3.5-turbo)

  These changes fix backend failures when model is not explicitly specified.
