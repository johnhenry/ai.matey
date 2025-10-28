# Manual API Tests

This directory contains integration tests that make real API calls to verify structured output functionality with actual AI providers.

## ⚠️ Important Notes

- These tests **make real API calls** and will **consume API credits**
- Tests are **not run by default** in CI/CD
- You must provide valid API keys
- Tests may take 30-60 seconds each due to network latency

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env.test` file in the project root:

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google (for Gemini)
GOOGLE_API_KEY=...
```

Or export them directly:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="..."
```

### 3. Run Tests

Run all manual tests:

```bash
npm run test:manual
```

Run specific provider tests:

```bash
# OpenAI only
npm run test:manual -- -t "OpenAI"

# Anthropic only
npm run test:manual -- -t "Anthropic"

# Gemini only
npm run test:manual -- -t "Gemini"

# Cross-provider consistency
npm run test:manual -- -t "Cross-Provider"
```

## Test Coverage

### OpenAI Tests
- ✅ Tools mode extraction
- ✅ JSON schema mode extraction
- ✅ Streaming with progressive updates
- ✅ Complex nested schemas
- ✅ Error handling

### Anthropic Tests
- ✅ Tools mode extraction
- ✅ Markdown JSON mode (fallback)
- ✅ Streaming with tool call handling
- ✅ Sentiment analysis

### Gemini Tests
- ✅ Tools mode extraction
- ✅ JSON mode (fallback)
- ✅ Basic data extraction

### Cross-Provider Tests
- ✅ Consistency across providers
- ✅ Same schema produces equivalent results
- ✅ All extraction modes work

### Error Handling Tests
- ✅ Invalid model names
- ✅ Abort signal handling
- ✅ Schema validation failures
- ✅ Network errors

## Expected Results

All tests should pass if:
- ✅ API keys are valid and have credits
- ✅ All provider APIs are operational
- ✅ Network connection is stable
- ✅ Bug fixes from P0/P1 issues are working correctly

## Cost Estimates

Approximate API costs per full test run:

- **OpenAI**: ~$0.01-0.02 (using gpt-4o-mini)
- **Anthropic**: ~$0.01-0.02 (using claude-3-5-haiku)
- **Gemini**: ~$0.00-0.01 (using gemini-1.5-flash)

**Total per run**: ~$0.02-0.05

## Troubleshooting

### Tests Skip Automatically

If you see:
```
⚠️  Skipping real API tests - no API keys found in environment
```

**Solution**: Set at least one API key in your environment.

### Rate Limit Errors

If you hit rate limits:

```bash
# Add delays between tests
npm run test:manual -- --test-timeout=60000
```

### Authentication Errors

Common issues:
- Invalid API key format
- Expired or revoked keys
- Insufficient permissions
- Organization restrictions

**Solution**: Verify your API keys at:
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/settings/keys
- Google: https://makersuite.google.com/app/apikey

### Model Not Found Errors

Some models may be region-restricted or deprecated:

**Solution**: Update model names in test file:
- OpenAI: Use `gpt-4o`, `gpt-4o-mini`, or `gpt-4-turbo`
- Anthropic: Use `claude-3-5-sonnet-20241022` or `claude-3-5-haiku-20241022`
- Gemini: Use `gemini-1.5-pro` or `gemini-1.5-flash`

## CI/CD Integration

To run these tests in CI/CD:

### GitHub Actions

```yaml
name: Manual API Tests

on:
  workflow_dispatch:  # Manual trigger only
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:manual
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
```

## What These Tests Verify

1. **P0-1 Fix**: Multi-tool call streaming works correctly
2. **P0-2 Fix**: Tool input types are consistent (objects, not strings)
3. **P0-3 Fix**: Schema validation catches invalid schemas early
4. **P0-4 Fix**: No duplicate done chunks in streams
5. **P1-1 Fix**: No memory leaks in long-running streams
6. **P1-2 Fix**: Partial JSON parser handles complex cases
7. **P1-3 Fix**: Null/undefined content is caught with clear errors

## Performance Benchmarks

Expected latencies (95th percentile):

- **Non-streaming**: 2-5 seconds
- **Streaming (first chunk)**: 300-800ms
- **Streaming (total)**: 3-8 seconds

Variations depend on:
- Model size and speed
- Prompt complexity
- Schema complexity
- Network latency
- Provider load

## Support

If tests fail unexpectedly:

1. Check API provider status pages
2. Verify API keys and credits
3. Review test output for specific errors
4. Open an issue with full error logs
