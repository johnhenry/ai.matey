/**
 * AI Matey Browser Backend Adapters
 *
 * Browser-compatible backend adapters that don't require Node.js or server-side APIs.
 * These adapters can run natively in the browser environment.
 *
 * Included adapters:
 * - Chrome AI: Uses Chrome's built-in AI APIs (window.ai)
 * - Function: Custom function-based adapters for testing and integration
 * - Mock: Mock responses for testing and development
 *
 * @module ai.matey.backend.browser
 */

// Chrome AI adapter - uses Chrome's built-in AI
export * from './chrome-ai.js';

// Function adapter - custom function-based backends
export * from './function.js';

// Mock adapter - testing and development
export * from './mock.js';
