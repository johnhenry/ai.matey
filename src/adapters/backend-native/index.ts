/**
 * Native Backend Adapters
 *
 * Backend adapters that require native bindings or platform-specific dependencies.
 * These are separated from HTTP-based backends to allow graceful degradation
 * on unsupported platforms.
 *
 * **Optional Dependencies:**
 * - `node-llama-cpp` - For NodeLlamaCppBackend (works on Linux, macOS, Windows)
 * - `apple-foundation-models` - For AppleBackend (macOS 15+ Sequoia only)
 *
 * These dependencies are **peerDependencies** marked as optional, so they won't
 * be automatically installed. Install only the ones you need:
 *
 * ```bash
 * # For node-llama-cpp
 * npm install node-llama-cpp
 *
 * # For Apple Foundation Models (macOS 15+ Sequoia only)
 * npm install apple-foundation-models
 * ```
 *
 * **Graceful Failure:**
 * All adapters will fail gracefully if:
 * - The dependency is not installed
 * - The platform is not supported
 *
 * @example Using Node-LlamaCpp
 * ```typescript
 * import { NodeLlamaCppBackend } from 'ai.matey/adapters/backend-native';
 *
 * const backend = new NodeLlamaCppBackend({
 *   modelPath: './models/tinyllama-1.1b.gguf',
 *   contextSize: 2048,
 * });
 *
 * await backend.initialize();
 * const response = await backend.execute(request);
 * ```
 *
 * @example Using Apple Foundation Models
 * ```typescript
 * import { AppleBackend } from 'ai.matey/adapters/backend-native';
 *
 * const backend = new AppleBackend({
 *   instructions: 'You are a helpful assistant.',
 *   maximumResponseTokens: 2048,
 *   temperature: 0.7,
 * });
 *
 * await backend.initialize();
 * const response = await backend.execute(request);
 * ```
 *
 * @module
 */

// Export Node-LlamaCpp backend
export { NodeLlamaCppBackend } from './node-llamacpp.js';

// Export Apple backend
export { AppleBackend } from './apple.js';
export type { AppleConfig } from './apple.js';

// Re-export common types for convenience
export type {
  BackendAdapter,
  BackendAdapterConfig,
  AdapterMetadata,
} from '../../types/adapters.js';

export type {
  IRChatRequest,
  IRChatResponse,
  IRChatStream,
} from '../../types/ir.js';
