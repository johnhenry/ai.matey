---
'@johnhenry/aimatey-types': minor
'@johnhenry/aimatey-backend': minor
---

Make `apiKey` optional on `BackendAdapterConfig`, and required on the adapters that use one (#104).

## A required credential with no consumer

`BackendAdapterConfig.apiKey` was `readonly apiKey: string` -- required. AWS Bedrock
authenticates with SigV4 from `awsAccessKeyId` / `awsSecretAccessKey` and reads
`config.apiKey` **zero times**, so every Bedrock user had to invent a dummy string to satisfy
a field the adapter ignores. Nothing in the type said it was inert, and a required credential
field invites a caller to put a *real* secret in it, on the reasonable assumption that it is
required for a reason.

## The survey said Bedrock is not a special case

The issue offered a contained fix (narrow `apiKey` to `never` on `AWSBedrockConfig`) and a
real one (make it optional at the base), and said the choice depended on whether other
adapters had the same shape. Grepping every adapter:

**Never read `config.apiKey`, yet required one:**

| adapter | config |
| --- | --- |
| `AWSBedrockBackendAdapter` | `AWSBedrockConfig extends BackendAdapterConfig` |
| `OllamaBackendAdapter` | takes `BackendAdapterConfig` directly |
| model-runner backend | `ModelRunnerBackendConfig extends BackendAdapterConfig` |

**Read it only to paper over its inertness:**

- `lmstudio.ts:68` -- `apiKey: config.apiKey || 'not-needed'`
- `omniroute.ts:48` -- `apiKey: config.apiKey || 'not-needed'`

**And a workaround already in the tree:**

- `NodeLlamaCppConfig extends Partial<BackendAdapterConfig>` -- weakening *every* field just
  to escape this one.

Both of the local adapters also had `config: BackendAdapterConfig = {} as BackendAdapterConfig`
in their factories: a cast that existed only because `{}` was not assignable.

Three adapters ignoring it, two substituting a placeholder, and one resorting to `Partial<>`
is not a Bedrock special case. Option 1.

## What changed

- `BackendAdapterConfig.apiKey` is now `readonly apiKey?: string`.
- New `ApiKeyBackendAdapterConfig = BackendAdapterConfig & { readonly apiKey: string }`,
  exported from `@johnhenry/aimatey-types`.
- The 26 adapters that genuinely authenticate with a key now take
  `ApiKeyBackendAdapterConfig`, so they still refuse to be constructed without one. This is
  **not** a blanket weakening.
- Bedrock, Ollama and the model runner keep the base config and no longer demand a key.
- LM Studio and OmniRoute keep the base config on their *constructors* -- a caller need not
  supply a key -- and annotate the config they hand to the OpenAI parent as the narrowed type,
  since they fill in `'not-needed'` themselves.
- DeepSeek requires a key: it is a cloud provider documented as needing `DEEPSEEK_API_KEY`
  and inherits the actual read from `OpenAIBackendAdapter`.

## Compatibility

Passing `apiKey` where it is no longer required is still valid, so existing callers -- including
everyone currently passing a dummy string to Bedrock -- keep compiling. What changes is that
`BackendAdapterConfig` is now assignable from objects without `apiKey`, so code that *reads*
`config.apiKey` off the base type sees `string | undefined` and must narrow. That is the
breaking edge, and on 0.x it makes this `minor`.
