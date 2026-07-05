/**
 * Apple Foundation Models Backend Adapter
 *
 * Apple on-device AI (macOS 15+ Sequoia)
 *
 * Platform Requirements: macOS 15+ (Sequoia), Apple Intelligence enabled
 *
 * Environment Variables:

 * Usage:
 *   ai-matey emulate-ollama --backend ./backend.mjs run default
 *   ai-matey proxy --backend ./backend.mjs --port 3000
 *
 * Note: Model name is metadata only (uses system default)
 */

import { AppleBackend } from 'ai.matey.native.apple';





export default new AppleBackend({
  maximumResponseTokens: 2048,
  temperature: 0.7,
  samplingMode: "default"
});
