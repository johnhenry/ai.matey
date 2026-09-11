/**
 * Warning Utilities
 *
 * Helpers for creating, formatting, and managing semantic drift warnings.
 *
 * @module
 */

import type { IRWarning, WarningSeverity, WarningCategory } from '@johnhenry/aimatey-types';

// ============================================================================
// Warning Creation
// ============================================================================

/**
 * Create a warning object.
 *
 * @param category Warning category
 * @param message Human-readable message
 * @param options Additional warning options
 * @returns Warning object
 */
export function createWarning(
  category: WarningCategory,
  message: string,
  options: {
    severity?: WarningSeverity;
    field?: string;
    originalValue?: unknown;
    transformedValue?: unknown;
    source?: string;
    details?: Record<string, unknown>;
  } = {}
): IRWarning {
  return {
    category,
    severity: options.severity ?? 'warning',
    message,
    field: options.field,
    originalValue: options.originalValue,
    transformedValue: options.transformedValue,
    source: options.source,
    details: options.details,
  };
}

/**
 * Create a parameter normalization warning.
 *
 * @param field Parameter field name
 * @param originalValue Original value
 * @param transformedValue Transformed value
 * @param message Optional custom message
 * @param source Source adapter
 * @returns Warning object
 */
export function createNormalizationWarning(
  field: string,
  originalValue: unknown,
  transformedValue: unknown,
  message?: string,
  source?: string
): IRWarning {
  return createWarning(
    'parameter-normalized',
    message ||
      `Parameter '${field}' normalized from ${String(originalValue)} to ${String(transformedValue)}`,
    {
      severity: 'info',
      field,
      originalValue,
      transformedValue,
      source,
    }
  );
}

/**
 * Create a parameter clamping warning.
 *
 * @param field Parameter field name
 * @param originalValue Original value
 * @param clampedValue Clamped value
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @param source Source adapter
 * @returns Warning object
 */
export function createClampingWarning(
  field: string,
  originalValue: unknown,
  clampedValue: unknown,
  min: number,
  max: number,
  source?: string
): IRWarning {
  return createWarning(
    'parameter-clamped',
    `Parameter '${field}' clamped from ${String(originalValue)} to ${String(clampedValue)} (valid range: ${min}-${max})`,
    {
      severity: 'warning',
      field,
      originalValue,
      transformedValue: clampedValue,
      source,
      details: { min, max },
    }
  );
}

/**
 * Create an unsupported parameter warning.
 *
 * @param field Parameter field name
 * @param value Parameter value
 * @param source Source adapter
 * @returns Warning object
 */
export function createUnsupportedParameterWarning(
  field: string,
  value: unknown,
  source?: string
): IRWarning {
  return createWarning(
    'parameter-unsupported',
    `Parameter '${field}' is not supported by provider (value: ${String(value)})`,
    {
      severity: 'warning',
      field,
      originalValue: value,
      source,
    }
  );
}

/**
 * Create a capability unsupported warning.
 *
 * @param capability Capability name
 * @param source Source adapter
 * @returns Warning object
 */
export function createUnsupportedCapabilityWarning(capability: string, source?: string): IRWarning {
  return createWarning(
    'capability-unsupported',
    `Capability '${capability}' is not supported by provider`,
    {
      severity: 'warning',
      field: capability,
      source,
    }
  );
}

/**
 * Create a token limit exceeded warning.
 *
 * @param estimatedTokens Estimated token count
 * @param maxTokens Maximum tokens allowed
 * @param source Source adapter
 * @returns Warning object
 */
export function createTokenLimitWarning(
  estimatedTokens: number,
  maxTokens: number,
  source?: string
): IRWarning {
  return createWarning(
    'token-limit-exceeded',
    `Estimated tokens (${estimatedTokens}) may exceed provider limit (${maxTokens})`,
    {
      severity: 'warning',
      source,
      details: { estimatedTokens, maxTokens },
    }
  );
}

/**
 * Create a stop sequences truncated warning.
 *
 * @param originalCount Original number of stop sequences
 * @param maxCount Maximum allowed
 * @param source Source adapter
 * @returns Warning object
 */
export function createStopSequencesTruncatedWarning(
  originalCount: number,
  maxCount: number,
  source?: string
): IRWarning {
  return createWarning(
    'stop-sequences-truncated',
    `Stop sequences truncated from ${originalCount} to ${maxCount} (provider limit)`,
    {
      severity: 'warning',
      field: 'stopSequences',
      originalValue: originalCount,
      transformedValue: maxCount,
      source,
    }
  );
}

/**
 * Create a warning for a request that waited before it ran.
 *
 * For a store-and-forward transport that accepted a turn, held it, and
 * executed it later. The reply is correct and late, which no translation
 * category can say.
 *
 * @param queuedMs How long the request waited before it was executed
 * @param source Source adapter
 * @returns Warning object
 */
export function createRequestQueuedWarning(queuedMs: number, source?: string): IRWarning {
  return createWarning('request-queued', `Request was queued for ${queuedMs}ms before it ran`, {
    severity: 'info',
    source,
    details: { queuedMs },
  });
}

/**
 * Create a warning for a turn whose delivery was degraded.
 *
 * The request was translated faithfully and the backend did what was asked;
 * the *link* is what went wrong -- a stream that reconnected mid-response, a
 * re-send after a transport failure, a hop an order of magnitude slower than
 * the same request served locally.
 *
 * Reach for this rather than `capability-unsupported`, which says the backend
 * could not do what was asked and means something else entirely.
 *
 * @param reason What degraded the delivery
 * @param options Optional structured detail and source adapter
 * @returns Warning object
 */
export function createTransportDegradedWarning(
  reason: string,
  options: { details?: Record<string, unknown>; source?: string } = {}
): IRWarning {
  return createWarning('transport-degraded', `Transport degraded: ${reason}`, {
    severity: 'warning',
    source: options.source,
    details: options.details,
  });
}

/**
 * Create a warning for a response that arrived without provenance where the
 * receiver had reason to expect it.
 *
 * `IRMetadata.provenance` is optional, so `undefined` cannot by itself
 * distinguish "nothing was recorded" from "something recorded it and the trip
 * ate it". Attaching this on receipt makes the second case detectable, and
 * says so as the receiving hop's own claim rather than as an inference.
 *
 * @param expectedFrom The hop the receiver expected provenance from
 * @param source Source adapter
 * @returns Warning object
 */
export function createProvenanceLostWarning(expectedFrom: string, source?: string): IRWarning {
  return createWarning(
    'provenance-lost',
    `Response from '${expectedFrom}' carried no provenance where provenance was expected`,
    {
      severity: 'warning',
      field: 'metadata.provenance',
      source,
      details: { expectedFrom },
    }
  );
}

// ============================================================================
// Warning Manipulation
// ============================================================================

/**
 * Merge warning arrays, removing duplicates.
 *
 * @param warningArrays Arrays of warnings to merge
 * @returns Merged and deduplicated warnings
 */
export function mergeWarnings(
  ...warningArrays: Array<readonly IRWarning[] | undefined>
): IRWarning[] {
  const warnings: IRWarning[] = [];
  const seen = new Set<string>();

  for (const array of warningArrays) {
    if (!array) {
      continue;
    }

    for (const warning of array) {
      // Create a key for deduplication
      const key = `${warning.category}:${warning.field}:${warning.message}`;

      if (!seen.has(key)) {
        seen.add(key);
        warnings.push(warning);
      }
    }
  }

  return warnings;
}

/**
 * Filter warnings by severity.
 *
 * @param warnings Warnings to filter
 * @param minSeverity Minimum severity level
 * @returns Filtered warnings
 */
export function filterWarningsBySeverity(
  warnings: readonly IRWarning[],
  minSeverity: WarningSeverity
): IRWarning[] {
  const severityOrder: Record<WarningSeverity, number> = {
    info: 0,
    warning: 1,
    error: 2,
  };

  const minLevel = severityOrder[minSeverity];

  return warnings.filter((w) => severityOrder[w.severity] >= minLevel);
}

/**
 * Filter warnings by category.
 *
 * @param warnings Warnings to filter
 * @param categories Categories to include
 * @returns Filtered warnings
 */
export function filterWarningsByCategory(
  warnings: readonly IRWarning[],
  categories: readonly WarningCategory[]
): IRWarning[] {
  const categorySet = new Set(categories);
  return warnings.filter((w) => categorySet.has(w.category));
}

/**
 * Group warnings by category.
 *
 * @param warnings Warnings to group
 * @returns Map of category to warnings
 */
export function groupWarningsByCategory(
  warnings: readonly IRWarning[]
): Map<WarningCategory, IRWarning[]> {
  const groups = new Map<WarningCategory, IRWarning[]>();

  for (const warning of warnings) {
    const group = groups.get(warning.category) || [];
    group.push(warning);
    groups.set(warning.category, group);
  }

  return groups;
}

/**
 * Check if warnings array contains a specific warning type.
 *
 * @param warnings Warnings to check
 * @param category Warning category to look for
 * @param field Optional field name to match
 * @returns true if warning exists
 */
export function hasWarning(
  warnings: readonly IRWarning[] | undefined,
  category: WarningCategory,
  field?: string
): boolean {
  if (!warnings) {
    return false;
  }

  return warnings.some(
    (w) => w.category === category && (field === undefined || w.field === field)
  );
}

// ============================================================================
// Warning Formatting
// ============================================================================

/**
 * Format a single warning as a string.
 *
 * @param warning Warning to format
 * @param includeDetails Include full details
 * @returns Formatted warning string
 */
export function formatWarning(warning: IRWarning, includeDetails = false): string {
  const prefix = `[${warning.severity.toUpperCase()}]`;
  const source = warning.source ? ` (${warning.source})` : '';

  if (!includeDetails) {
    return `${prefix} ${warning.message}${source}`;
  }

  const parts = [
    `${prefix} ${warning.message}${source}`,
    warning.field ? `  Field: ${warning.field}` : null,
    warning.originalValue !== undefined
      ? `  Original: ${JSON.stringify(warning.originalValue)}`
      : null,
    warning.transformedValue !== undefined
      ? `  Transformed: ${JSON.stringify(warning.transformedValue)}`
      : null,
    warning.details ? `  Details: ${JSON.stringify(warning.details)}` : null,
  ].filter(Boolean);

  return parts.join('\n');
}

/**
 * Format multiple warnings as a string.
 *
 * @param warnings Warnings to format
 * @param includeDetails Include full details
 * @returns Formatted warnings string
 */
export function formatWarnings(warnings: readonly IRWarning[], includeDetails = false): string {
  if (warnings.length === 0) {
    return 'No warnings';
  }

  const formatted = warnings.map((w) => formatWarning(w, includeDetails));
  return formatted.join('\n');
}

/**
 * Get a summary of warnings by category.
 *
 * @param warnings Warnings to summarize
 * @returns Summary object with counts
 */
export function getWarningSummary(warnings: readonly IRWarning[]): {
  total: number;
  byCategory: Record<WarningCategory, number>;
  bySeverity: Record<WarningSeverity, number>;
} {
  const summary = {
    total: warnings.length,
    byCategory: {} as Record<WarningCategory, number>,
    bySeverity: {
      info: 0,
      warning: 0,
      error: 0,
    } as Record<WarningSeverity, number>,
  };

  for (const warning of warnings) {
    // Count by category
    summary.byCategory[warning.category] = (summary.byCategory[warning.category] || 0) + 1;

    // Count by severity
    summary.bySeverity[warning.severity]++;
  }

  return summary;
}
