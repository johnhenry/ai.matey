# Structured Output Provider Capabilities

**Status:** Analysis Complete
**Date:** 2025-10-27

## Executive Summary

**17 of 30 backends** support tool/function calling and can support structured outputs.

**Current Implementation Status:**
- ✅ OpenAI: COMPLETE (all 4 modes)
- ❌ Anthropic: NOT IMPLEMENTED
- ❌ Gemini: NOT IMPLEMENTED
- ❌ 14 other tool-capable providers: NOT IMPLEMENTED

## Extraction Mode Compatibility

Each backend may support different extraction modes:

| Mode | Requirements | Fallback Behavior |
|------|--------------|-------------------|
| **tools** | Function/tool calling support | Most reliable, native support |
| **json** | JSON response format mode | Provider-specific, may need system prompt |
| **json_schema** | Strict JSON schema (OpenAI-specific) | Only works with OpenAI/compatible |
| **md_json** | None (universal) | Works everywhere, least reliable |

## Provider Capability Matrix

### Tier 1: High Priority (Major Providers)

| Provider | Tools Support | JSON Mode | Recommended Modes | Implementation Priority | Market Share |
|----------|---------------|-----------|-------------------|------------------------|--------------|
| **OpenAI** | ✅ | ✅ | tools, json_schema, json, md_json | ✅ COMPLETE | Very High |
| **Anthropic** | ✅ | ✅ | tools, json, md_json | 🔴 P0 CRITICAL | Very High |
| **Gemini** | ✅ | ✅ | tools, json, md_json | 🔴 P0 CRITICAL | High |
| **Azure OpenAI** | ✅ | ✅ | tools, json_schema, json, md_json | 🟡 P1 HIGH | High |

**Estimate:** 1-2 hours each (same pattern as OpenAI)

---

### Tier 2: Popular Alternative Providers

| Provider | Tools Support | JSON Mode | Recommended Modes | Implementation Priority | Notes |
|----------|---------------|-----------|-------------------|------------------------|-------|
| **Mistral** | ✅ | ✅ | tools, json, md_json | 🟡 P1 HIGH | Growing adoption |
| **Groq** | ✅ | ✅ | tools, json, md_json | 🟡 P1 HIGH | Fast inference |
| **OpenRouter** | ✅ | ✅ | tools, json, md_json | 🟢 P2 MEDIUM | Aggregator |
| **Fireworks** | ✅ | ✅ | tools, json, md_json | 🟢 P2 MEDIUM | OSS models |
| **Together AI** | ✅ | ✅ | tools, json, md_json | 🟢 P2 MEDIUM | OSS models |

**Estimate:** 1-2 hours each

---

### Tier 3: Enterprise & Specialized

| Provider | Tools Support | JSON Mode | Recommended Modes | Implementation Priority | Notes |
|----------|---------------|-----------|-------------------|------------------------|-------|
| **DeepSeek** | ✅ | ✅ | tools, json, md_json | 🟢 P2 MEDIUM | Chinese market |
| **xAI (Grok)** | ✅ | ? | tools, md_json | 🟢 P2 MEDIUM | New entrant |
| **Cerebras** | ✅ | ? | tools, md_json | ⚪ P3 LOW | Specialized hardware |
| **NVIDIA** | ✅ | ? | tools, md_json | ⚪ P3 LOW | Enterprise |
| **Cloudflare** | ✅ | ? | tools, md_json | ⚪ P3 LOW | Edge inference |
| **DeepInfra** | ✅ | ? | tools, md_json | ⚪ P3 LOW | OSS hosting |
| **LM Studio** | ✅ | ? | tools, md_json | ⚪ P3 LOW | Local models |

**Estimate:** 1-2 hours each

---

### Tier 4: Testing & Development

| Provider | Tools Support | JSON Mode | Recommended Modes | Implementation Priority | Notes |
|----------|---------------|-----------|-------------------|------------------------|-------|
| **Mock** | ✅ | ✅ | tools, json, md_json | 🟡 P1 HIGH | Critical for testing! |

**Estimate:** 30 minutes

---

### Providers WITHOUT Tool Support

These providers can only use `md_json` mode (markdown extraction fallback):

| Provider | Reason | Can Support Structured Output? |
|----------|--------|-------------------------------|
| **Ollama** | No tool support | ⚠️ md_json only |
| **Chrome AI** | No tool support | ⚠️ md_json only |
| **Cohere** | No tool support | ⚠️ md_json only |
| **Hugging Face** | No tool support | ⚠️ md_json only |
| **11 others** | Various limitations | ⚠️ Limited/None |

---

## Implementation Recommendations

### Phase 1: Critical (This Week) - P0
**Effort:** 4-6 hours

1. **Anthropic** (2 hours)
   - Second most popular provider
   - Excellent tool calling support
   - Similar API structure to OpenAI

2. **Gemini** (2 hours)
   - Third most popular provider
   - Good tool support
   - Different API structure (needs more adaptation)

3. **Mock Backend** (30 min)
   - CRITICAL for automated testing
   - Will enable integration test suite

### Phase 2: High Priority (Next Week) - P1
**Effort:** 6-8 hours

4. **Azure OpenAI** (1 hour)
   - Enterprise users
   - Nearly identical to OpenAI
   - Same 4 modes support

5. **Mistral** (2 hours)
   - Growing European provider
   - Good tool support
   - Similar to OpenAI API

6. **Groq** (2 hours)
   - Extremely fast inference
   - Popular for real-time apps
   - OpenAI-compatible API

7. **OpenRouter** (1 hour)
   - Aggregator - gives access to many models
   - OpenAI-compatible
   - High user adoption

### Phase 3: Medium Priority (Later) - P2
**Effort:** 8-10 hours

8-12. **Fireworks, Together AI, DeepSeek, xAI, LM Studio**
   - OSS and alternative providers
   - Varying levels of adoption
   - Implement as needed by users

### Phase 4: Low Priority - P3
**Effort:** As needed

13-17. **Enterprise & Specialized Providers**
   - Implement on demand
   - Lower adoption rates
   - Similar patterns to above

---

## Technical Implementation Notes

### Pattern for New Backends

Each backend adapter needs to update the `fromIR()` method to handle `request.schema`:

```typescript
// Example for Anthropic adapter
if (request.schema) {
  const schema = request.schema;
  const mode = schema.mode || 'tools';
  const name = schema.name || 'extract';

  let jsonSchema: any;
  if (schema.type === 'zod') {
    jsonSchema = convertZodToJsonSchema(schema.schema);
  } else {
    jsonSchema = schema.schema;
  }

  if (mode === 'tools') {
    // Anthropic uses 'tools' array
    tools = [{
      name,
      description: description || `Extract structured data matching the ${name} schema`,
      input_schema: jsonSchema,  // Note: Anthropic uses input_schema, not parameters
    }];
    tool_choice = { type: 'tool', name };  // Force tool use
  } else if (mode === 'json') {
    // Add to system message or use provider's JSON mode if available
    systemMessage += `\n\nRespond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
  } else if (mode === 'md_json') {
    // Add markdown instruction to system message
    systemMessage += `\n\nRespond with JSON in a markdown code block:\n\`\`\`json\n...\n\`\`\`\n\nThe JSON must match this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
  }
  // json_schema mode not supported by Anthropic
}
```

### Streaming Support

For providers with streaming tool calls:
1. Buffer tool call deltas (like OpenAI implementation)
2. Yield tool arguments as content chunks
3. Include complete tool calls in final message

For providers without streaming tool calls:
1. Wait for complete message
2. Extract tool calls at end
3. May be slower but still functional

---

## Testing Strategy

### Integration Tests Needed (Per Provider)

1. **Non-streaming tests:**
   - tools mode
   - json mode
   - md_json mode
   - json_schema mode (if supported)

2. **Streaming tests:**
   - Progressive object building
   - Partial validation
   - Error handling

3. **Edge cases:**
   - Empty responses
   - Invalid JSON
   - Schema validation failures
   - Tool call fallback

### Mock Backend Priority

The Mock backend should be updated FIRST to enable:
- Automated testing without API costs
- CI/CD integration
- Regression prevention
- Example verification

---

## Cost-Benefit Analysis

### High ROI (Implement First)
- **Anthropic, Gemini, Azure OpenAI:** Major providers, large user bases
- **Mock:** Enables testing, prevents regressions
- **Mistral, Groq:** Fast-growing adoption

### Medium ROI (Implement If Requested)
- **OpenRouter, Fireworks, Together AI:** Moderate user bases
- **DeepSeek, xAI:** Regional or emerging providers

### Low ROI (Wait for User Requests)
- **Specialized/Enterprise:** Low adoption, implement on demand
- **No-tool providers:** Only md_json mode, limited value

---

## Compatibility Notes

### JSON Schema Strict Mode
Only OpenAI (and Azure OpenAI) support the `json_schema` mode with strict validation:
```typescript
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'extract',
    schema: jsonSchema,
    strict: true
  }
}
```

Other providers use:
- **Anthropic:** Tools with `input_schema`
- **Gemini:** Function declarations with `parameters`
- **Mistral:** Tools with `function.parameters`
- **Others:** Varies by provider

### Tool Calling Variations

Different providers have different tool calling formats:

| Provider | Tool Format | Tool Choice Format |
|----------|-------------|-------------------|
| OpenAI | `tools: [{type: 'function', function: {...}}]` | `{type: 'function', function: {name}}` |
| Anthropic | `tools: [{name, description, input_schema}]` | `{type: 'tool', name}` |
| Gemini | `tools: [{functionDeclarations: [{name, parameters}]}]` | Different structure |
| Mistral | Similar to OpenAI | Similar to OpenAI |

---

## Recommended Action Plan

### Immediate (Today)
1. ✅ Review this analysis
2. ⏳ Update Mock backend (30 min) - enables testing
3. ⏳ Update Anthropic backend (2 hours)
4. ⏳ Create basic integration tests (2 hours)

**Total: ~4.5 hours**

### This Week
5. ⏳ Update Gemini backend (2 hours)
6. ⏳ Expand integration tests (2 hours)
7. ⏳ Update Azure OpenAI backend (1 hour)

**Total: ~5 hours**

### Next Week
8. ⏳ Update Mistral, Groq, OpenRouter (4-5 hours)
9. ⏳ Documentation updates (2 hours)
10. ⏳ Real API testing all providers (2-3 hours)

**Total: ~8-10 hours**

---

## Conclusion

**Yes, many more providers beyond OpenAI, Gemini, and Anthropic can support structured outputs.**

**Key Findings:**
- 17/30 backends support tool calling (can use `tools` mode)
- Most modern providers support JSON response modes
- All providers support `md_json` fallback mode
- Implementation follows same pattern as OpenAI (1-2 hours each)

**Recommendation:**
Focus on **Tier 1 (Anthropic, Gemini, Azure OpenAI, Mock)** first for maximum impact, then expand to Tier 2 based on user demand.

**Next Steps:**
1. Get approval on implementation priorities
2. Update Mock backend for testing
3. Update Anthropic and Gemini (P0)
4. Create integration test suite
5. Expand to other providers as needed
