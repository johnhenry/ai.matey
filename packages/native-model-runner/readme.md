# @johnhenry/aimatey-native-model-runner

> **Note:** Previously published as `ai.matey.native.model-runner@0.2.1`.

Base class for wrapping **any local model CLI or binary** as an AI Matey backend — llama.cpp's
`main`, whisper.cpp, MLX scripts, custom inference servers driven over stdio. Part of the
[ai.matey](https://github.com/johnhenry/ai.matey) monorepo.

> This package ships an abstract class, not a ready-made backend. If you want a turnkey local
> backend, see [`@johnhenry/aimatey-native-node-llamacpp`](../native-node-llamacpp) or
> [`@johnhenry/aimatey-native-apple`](../native-apple), or use the Ollama/LM Studio backends in
> `@johnhenry/aimatey-backend`.

## Installation

```bash
npm install @johnhenry/aimatey-native-model-runner
```

## Usage

Subclass `GenericModelRunnerBackend` and implement the four translation hooks:

```typescript
import { GenericModelRunnerBackend } from '@johnhenry/aimatey-native-model-runner';
import type { IRChatRequest } from '@johnhenry/aimatey-types';

class LlamaCliBackend extends GenericModelRunnerBackend {
  constructor() {
    super({
      command: '/usr/local/bin/llama',
      name: 'llama-cli',
      restartOnCrash: true,
    });
  }

  protected buildCommandArgs(request: IRChatRequest): string[] {
    return ['-m', '/models/model.gguf', '--temp', String(request.parameters?.temperature ?? 0.7)];
  }

  protected formatPrompt(request: IRChatRequest): string {
    return request.messages
      .map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : ''}`)
      .join('\n');
  }

  protected parseResponse(output: string) {
    return { content: output.trim() };
  }

  protected parseStreamChunk(chunk: string) {
    return { delta: chunk };
  }
}
```

The base class handles process lifecycle (spawn, health checks, restart on crash), stdio
plumbing, and adapting everything to the `BackendAdapter` interface so your subclass works in a
Bridge or Router like any cloud provider.

## License

MIT - see [LICENSE](./LICENSE) for details.
