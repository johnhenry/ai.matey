/**
 * useTokenCount Hook
 *
 * React hook for estimating token counts.
 *
 * @module
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Token count options.
 */
export interface UseTokenCountOptions {
  /** Text to count tokens for */
  text?: string;
  /** Model to use for estimation */
  model?: string;
  /** Custom tokenizer function */
  tokenizer?: (text: string) => number;
  /** Debounce delay in ms */
  debounceMs?: number;
}

/**
 * Token count return value.
 */
export interface UseTokenCountReturn {
  /** Estimated token count */
  tokenCount: number;
  /** Characters count */
  characterCount: number;
  /** Word count */
  wordCount: number;
  /** Whether estimation is in progress */
  isEstimating: boolean;
  /** Count tokens for text */
  countTokens: (text: string) => number;
}

/**
 * Default tokenizer using rough estimation.
 *
 * Uses ~4 characters per token as a rough estimate,
 * which is approximately accurate for GPT models with English text.
 */
function defaultTokenizer(text: string): number {
  if (!text) return 0;

  // More sophisticated estimation:
  // - Count words (average ~1.3 tokens per word)
  // - Count special characters/punctuation (often separate tokens)
  // - Account for whitespace

  const words = text.split(/\s+/).filter(Boolean);
  const wordTokens = words.length * 1.3;

  // Count punctuation and special characters
  const punctuation = (text.match(/[.,!?;:'"()\[\]{}<>@#$%^&*+=|\\/-]/g) || []).length;

  // Count numbers as separate tokens
  const numbers = (text.match(/\d+/g) || []).length;

  return Math.ceil(wordTokens + punctuation * 0.5 + numbers);
}

/**
 * useTokenCount - React hook for estimating token counts.
 *
 * Provides real-time token estimation for text input,
 * useful for staying within model context limits.
 *
 * @example
 * ```tsx
 * import { useTokenCount } from 'ai.matey.react.hooks';
 *
 * function TokenCounter() {
 *   const [text, setText] = useState('');
 *   const { tokenCount, characterCount, wordCount } = useTokenCount({ text });
 *
 *   return (
 *     <div>
 *       <textarea value={text} onChange={(e) => setText(e.target.value)} />
 *       <p>Tokens: ~{tokenCount} | Words: {wordCount} | Characters: {characterCount}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTokenCount(options: UseTokenCountOptions = {}): UseTokenCountReturn {
  const {
    text = '',
    model: _model, // Reserved for future model-specific tokenizers
    tokenizer = defaultTokenizer,
    debounceMs = 100,
  } = options;

  const [tokenCount, setTokenCount] = useState<number>(0);
  const [isEstimating, setIsEstimating] = useState<boolean>(false);

  // Character count (memoized)
  const characterCount = useMemo(() => text.length, [text]);

  // Word count (memoized)
  const wordCount = useMemo(() => {
    if (!text.trim()) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }, [text]);

  // Count tokens function
  const countTokens = useCallback(
    (inputText: string): number => {
      return tokenizer(inputText);
    },
    [tokenizer]
  );

  // Debounced token counting effect
  useEffect(() => {
    if (!text) {
      setTokenCount(0);
      return;
    }

    setIsEstimating(true);

    const timeoutId = setTimeout(() => {
      const count = countTokens(text);
      setTokenCount(count);
      setIsEstimating(false);
    }, debounceMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [text, countTokens, debounceMs]);

  return {
    tokenCount,
    characterCount,
    wordCount,
    isEstimating,
    countTokens,
  };
}

/**
 * Model-specific token limits.
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-3.5-turbo': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'gemini-pro': 30720,
  'gemini-1.5-pro': 1000000,
  'command-r': 128000,
  'command-r-plus': 128000,
  'mixtral-8x7b': 32768,
  'llama-3-70b': 8192,
  'llama-3.1-405b': 128000,
};

/**
 * Get token limit for a model.
 */
export function getModelTokenLimit(model: string): number | undefined {
  // Try exact match
  if (MODEL_TOKEN_LIMITS[model]) {
    return MODEL_TOKEN_LIMITS[model];
  }

  // Try prefix match
  for (const [key, value] of Object.entries(MODEL_TOKEN_LIMITS)) {
    if (model.startsWith(key) || model.includes(key)) {
      return value;
    }
  }

  return undefined;
}
