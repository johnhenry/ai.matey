/**
 * Stream Utilities
 *
 * Re-exports stream utilities from aimatey-utils.
 *
 * @module
 */

// Re-export stream utilities from aimatey-utils
export {
  // High-level utilities
  collectStreamFull as collectStream,
  processStream,
  streamToLines,
  throttleStream,
  teeStream,

  // Basic utilities (streamToTextIterator provides generator behavior with error handling)
  streamToTextIterator as streamToText,

  // Types
  type CollectedStream,
  type ProcessStreamOptions as TransformStreamOptions,
} from '@johnhenry/aimatey-utils';
