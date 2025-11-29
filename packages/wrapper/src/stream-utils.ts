/**
 * Stream Utilities
 *
 * Re-exports stream utilities from ai.matey.utils.
 *
 * @module
 */

// Re-export stream utilities from ai.matey.utils
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
} from 'ai.matey.utils';
