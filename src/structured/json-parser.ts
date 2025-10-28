/**
 * JSON Parser Utilities
 *
 * Progressive JSON parsing for streaming responses.
 * Handles incomplete JSON by attempting to close open structures.
 *
 * @module
 */

// ============================================================================
// Progressive JSON Parsing
// ============================================================================

/**
 * Parse potentially incomplete JSON during streaming.
 *
 * Handles partial JSON by attempting to close open structures.
 * Returns null if JSON cannot be parsed even with fixes.
 *
 * This is a simplistic implementation that counts braces/brackets
 * and adds closing characters. It works for most common cases but
 * may fail on complex nested structures with escaped characters.
 *
 * @param jsonStr Potentially incomplete JSON string
 * @returns Parsed object or null if unparseable
 *
 * @example
 * ```typescript
 * parsePartialJSON('{"name":"John')
 * // Returns: { name: "John" }
 *
 * parsePartialJSON('{"items":[1,2')
 * // Returns: { items: [1, 2] }
 * ```
 */
export function parsePartialJSON(jsonStr: string): any {
  if (!jsonStr.trim()) {
    return null;
  }

  try {
    // First try parsing as-is
    return JSON.parse(jsonStr);
  } catch {
    // Try to fix incomplete JSON by counting braces/brackets
    // that are NOT inside strings
    let fixed = jsonStr.trim();

    // Count unmatched braces/brackets while respecting string context
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < fixed.length; i++) {
      const char = fixed[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !inString) {
        inString = true;
        continue;
      }

      if (char === '"' && inString) {
        inString = false;
        continue;
      }

      // Only count braces/brackets outside of strings
      if (!inString) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
        else if (char === '[') openBrackets++;
        else if (char === ']') openBrackets--;
      }
    }

    // Add missing closing characters
    fixed += '}'.repeat(Math.max(0, openBraces));
    fixed += ']'.repeat(Math.max(0, openBrackets));

    try {
      return JSON.parse(fixed);
    } catch {
      // If still can't parse, return null
      return null;
    }
  }
}

/**
 * Deep merge two objects, preferring values from source.
 *
 * Used for progressive updates during streaming to merge
 * partial objects as they arrive.
 *
 * Note: Arrays are replaced entirely, not merged element-wise.
 * This is a simplification that works for most use cases.
 *
 * @param target Target object (existing state)
 * @param source Source object (new partial data)
 * @returns Merged object
 *
 * @example
 * ```typescript
 * const target = { name: "John", age: 30 }
 * const source = { age: 31, email: "john@example.com" }
 *
 * deepMerge(target, source)
 * // Returns: { name: "John", age: 31, email: "john@example.com" }
 * ```
 */
export function deepMerge(target: any, source: any): any {
  // Handle primitives and null
  if (typeof source !== 'object' || source === null) {
    return source;
  }

  // Arrays are replaced entirely (not merged element-wise)
  if (Array.isArray(source)) {
    return source;
  }

  // Deep merge objects
  const result = { ...target };
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        // Recursively merge nested objects
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        // Replace primitive values and arrays
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Extract JSON from markdown code block.
 *
 * Looks for JSON in markdown code fences like:
 * ```json
 * { "key": "value" }
 * ```
 *
 * Falls back to parsing the entire content if no code block found.
 *
 * @param content Markdown content
 * @returns Extracted JSON string
 *
 * @example
 * ```typescript
 * extractMarkdownJSON('Here is the data:\n```json\n{"name":"John"}\n```')
 * // Returns: '{"name":"John"}'
 * ```
 */
export function extractMarkdownJSON(content: string): string {
  // Try to find JSON in code block
  const jsonBlockMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (jsonBlockMatch && jsonBlockMatch[1]) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find generic code block
  const codeBlockMatch = content.match(/```\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // Fallback: try to extract JSON object from anywhere in content
  const objectMatch = content.match(/\{[\s\S]*\}/);
  if (objectMatch && objectMatch[0]) {
    return objectMatch[0];
  }

  // Last resort: return entire content
  return content.trim();
}

/**
 * Validate JSON string without parsing.
 *
 * Quick check if a string is valid JSON without the
 * overhead of actually parsing it.
 *
 * @param jsonStr JSON string to validate
 * @returns true if valid JSON
 */
export function isValidJSON(jsonStr: string): boolean {
  try {
    JSON.parse(jsonStr);
    return true;
  } catch {
    return false;
  }
}

/**
 * Count brace/bracket nesting level.
 *
 * Useful for determining if JSON string is potentially complete.
 * Respects string context to avoid counting braces/brackets inside strings.
 *
 * @param jsonStr JSON string
 * @returns Nesting level (0 means balanced)
 */
export function getNestingLevel(jsonStr: string): number {
  let braceLevel = 0;
  let bracketLevel = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !inString) {
      inString = true;
      continue;
    }

    if (char === '"' && inString) {
      inString = false;
      continue;
    }

    // Only count braces/brackets outside of strings
    if (!inString) {
      if (char === '{') braceLevel++;
      else if (char === '}') braceLevel--;
      else if (char === '[') bracketLevel++;
      else if (char === ']') bracketLevel--;
    }
  }

  return Math.abs(braceLevel) + Math.abs(bracketLevel);
}
