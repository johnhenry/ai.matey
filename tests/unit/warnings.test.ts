/**
 * Warning Utilities Tests
 *
 * Tests for warning creation, manipulation, and formatting utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  createWarning,
  createNormalizationWarning,
  createClampingWarning,
  createUnsupportedParameterWarning,
  createUnsupportedCapabilityWarning,
  createTokenLimitWarning,
  createStopSequencesTruncatedWarning,
  mergeWarnings,
  filterWarningsBySeverity,
  filterWarningsByCategory,
  groupWarningsByCategory,
  hasWarning,
  formatWarning,
  formatWarnings,
  getWarningSummary,
} from 'ai.matey.utils';
import type { IRWarning, WarningCategory, WarningSeverity } from 'ai.matey.types';

// ============================================================================
// createWarning Tests
// ============================================================================

describe('createWarning', () => {
  it('should create warning with required fields', () => {
    const warning = createWarning('parameter-normalized', 'Test message');

    expect(warning.category).toBe('parameter-normalized');
    expect(warning.message).toBe('Test message');
    expect(warning.severity).toBe('warning'); // default
  });

  it('should create warning with custom severity', () => {
    const warning = createWarning('parameter-clamped', 'Test', { severity: 'error' });

    expect(warning.severity).toBe('error');
  });

  it('should create warning with all optional fields', () => {
    const warning = createWarning('parameter-normalized', 'Test', {
      severity: 'info',
      field: 'temperature',
      originalValue: 2.5,
      transformedValue: 2.0,
      source: 'openai-backend',
      details: { min: 0, max: 2 },
    });

    expect(warning.severity).toBe('info');
    expect(warning.field).toBe('temperature');
    expect(warning.originalValue).toBe(2.5);
    expect(warning.transformedValue).toBe(2.0);
    expect(warning.source).toBe('openai-backend');
    expect(warning.details).toEqual({ min: 0, max: 2 });
  });

  it('should leave optional fields undefined when not provided', () => {
    const warning = createWarning('capability-unsupported', 'Test');

    expect(warning.field).toBeUndefined();
    expect(warning.originalValue).toBeUndefined();
    expect(warning.transformedValue).toBeUndefined();
    expect(warning.source).toBeUndefined();
    expect(warning.details).toBeUndefined();
  });
});

// ============================================================================
// createNormalizationWarning Tests
// ============================================================================

describe('createNormalizationWarning', () => {
  it('should create normalization warning with auto-generated message', () => {
    const warning = createNormalizationWarning('temperature', 1.5, 1.0);

    expect(warning.category).toBe('parameter-normalized');
    expect(warning.severity).toBe('info');
    expect(warning.field).toBe('temperature');
    expect(warning.originalValue).toBe(1.5);
    expect(warning.transformedValue).toBe(1.0);
    expect(warning.message).toContain('temperature');
    expect(warning.message).toContain('1.5');
    expect(warning.message).toContain('1');
  });

  it('should create normalization warning with custom message', () => {
    const warning = createNormalizationWarning(
      'temperature',
      1.5,
      1.0,
      'Custom normalization message'
    );

    expect(warning.message).toBe('Custom normalization message');
  });

  it('should include source when provided', () => {
    const warning = createNormalizationWarning(
      'temperature',
      1.5,
      1.0,
      undefined,
      'anthropic-backend'
    );

    expect(warning.source).toBe('anthropic-backend');
  });

  it('should handle string values', () => {
    const warning = createNormalizationWarning('model', 'gpt-4', 'gpt-4-turbo');

    expect(warning.originalValue).toBe('gpt-4');
    expect(warning.transformedValue).toBe('gpt-4-turbo');
  });
});

// ============================================================================
// createClampingWarning Tests
// ============================================================================

describe('createClampingWarning', () => {
  it('should create clamping warning with range info', () => {
    const warning = createClampingWarning('temperature', 2.5, 2.0, 0, 2);

    expect(warning.category).toBe('parameter-clamped');
    expect(warning.severity).toBe('warning');
    expect(warning.field).toBe('temperature');
    expect(warning.originalValue).toBe(2.5);
    expect(warning.transformedValue).toBe(2.0);
    expect(warning.message).toContain('2.5');
    expect(warning.message).toContain('2');
    expect(warning.message).toContain('0-2');
    expect(warning.details).toEqual({ min: 0, max: 2 });
  });

  it('should include source when provided', () => {
    const warning = createClampingWarning('temperature', 2.5, 2.0, 0, 2, 'openai-backend');

    expect(warning.source).toBe('openai-backend');
  });

  it('should handle negative ranges', () => {
    const warning = createClampingWarning('penalty', -3, -2, -2, 2);

    expect(warning.originalValue).toBe(-3);
    expect(warning.transformedValue).toBe(-2);
    expect(warning.details).toEqual({ min: -2, max: 2 });
  });
});

// ============================================================================
// createUnsupportedParameterWarning Tests
// ============================================================================

describe('createUnsupportedParameterWarning', () => {
  it('should create unsupported parameter warning', () => {
    const warning = createUnsupportedParameterWarning('topK', 40);

    expect(warning.category).toBe('parameter-unsupported');
    expect(warning.severity).toBe('warning');
    expect(warning.field).toBe('topK');
    expect(warning.originalValue).toBe(40);
    expect(warning.message).toContain('topK');
    expect(warning.message).toContain('40');
  });

  it('should include source when provided', () => {
    const warning = createUnsupportedParameterWarning('topK', 40, 'openai-backend');

    expect(warning.source).toBe('openai-backend');
  });

  it('should handle object values', () => {
    const warning = createUnsupportedParameterWarning('customParam', { key: 'value' });

    expect(warning.originalValue).toEqual({ key: 'value' });
  });
});

// ============================================================================
// createUnsupportedCapabilityWarning Tests
// ============================================================================

describe('createUnsupportedCapabilityWarning', () => {
  it('should create unsupported capability warning', () => {
    const warning = createUnsupportedCapabilityWarning('vision');

    expect(warning.category).toBe('capability-unsupported');
    expect(warning.severity).toBe('warning');
    expect(warning.field).toBe('vision');
    expect(warning.message).toContain('vision');
  });

  it('should include source when provided', () => {
    const warning = createUnsupportedCapabilityWarning('streaming', 'mock-backend');

    expect(warning.source).toBe('mock-backend');
  });
});

// ============================================================================
// createTokenLimitWarning Tests
// ============================================================================

describe('createTokenLimitWarning', () => {
  it('should create token limit warning', () => {
    const warning = createTokenLimitWarning(150000, 128000);

    expect(warning.category).toBe('token-limit-exceeded');
    expect(warning.severity).toBe('warning');
    expect(warning.message).toContain('150000');
    expect(warning.message).toContain('128000');
    expect(warning.details).toEqual({ estimatedTokens: 150000, maxTokens: 128000 });
  });

  it('should include source when provided', () => {
    const warning = createTokenLimitWarning(150000, 128000, 'openai-backend');

    expect(warning.source).toBe('openai-backend');
  });
});

// ============================================================================
// createStopSequencesTruncatedWarning Tests
// ============================================================================

describe('createStopSequencesTruncatedWarning', () => {
  it('should create stop sequences truncated warning', () => {
    const warning = createStopSequencesTruncatedWarning(10, 4);

    expect(warning.category).toBe('stop-sequences-truncated');
    expect(warning.severity).toBe('warning');
    expect(warning.field).toBe('stopSequences');
    expect(warning.originalValue).toBe(10);
    expect(warning.transformedValue).toBe(4);
    expect(warning.message).toContain('10');
    expect(warning.message).toContain('4');
  });

  it('should include source when provided', () => {
    const warning = createStopSequencesTruncatedWarning(10, 4, 'openai-backend');

    expect(warning.source).toBe('openai-backend');
  });
});

// ============================================================================
// mergeWarnings Tests
// ============================================================================

describe('mergeWarnings', () => {
  it('should merge multiple warning arrays', () => {
    const warnings1 = [createWarning('parameter-normalized', 'Warning 1')];
    const warnings2 = [createWarning('parameter-clamped', 'Warning 2')];

    const merged = mergeWarnings(warnings1, warnings2);

    expect(merged).toHaveLength(2);
  });

  it('should remove duplicate warnings', () => {
    const warning = createWarning('parameter-normalized', 'Same warning', { field: 'temp' });
    const warnings1 = [warning];
    const warnings2 = [createWarning('parameter-normalized', 'Same warning', { field: 'temp' })];

    const merged = mergeWarnings(warnings1, warnings2);

    expect(merged).toHaveLength(1);
  });

  it('should handle undefined arrays', () => {
    const warnings1 = [createWarning('parameter-normalized', 'Warning 1')];

    const merged = mergeWarnings(warnings1, undefined, undefined);

    expect(merged).toHaveLength(1);
  });

  it('should handle empty arrays', () => {
    const merged = mergeWarnings([], [], []);

    expect(merged).toHaveLength(0);
  });

  it('should handle all undefined', () => {
    const merged = mergeWarnings(undefined, undefined);

    expect(merged).toHaveLength(0);
  });

  it('should preserve order', () => {
    const warning1 = createWarning('parameter-normalized', 'First');
    const warning2 = createWarning('parameter-clamped', 'Second');
    const warning3 = createWarning('capability-unsupported', 'Third');

    const merged = mergeWarnings([warning1], [warning2], [warning3]);

    expect(merged[0].message).toBe('First');
    expect(merged[1].message).toBe('Second');
    expect(merged[2].message).toBe('Third');
  });

  it('should deduplicate based on category, field, and message', () => {
    const warning1 = createWarning('parameter-normalized', 'Same message', {
      field: 'temperature',
      originalValue: 1.0,
    });
    const warning2 = createWarning('parameter-normalized', 'Same message', {
      field: 'temperature',
      originalValue: 2.0, // Different value but same key
    });

    const merged = mergeWarnings([warning1], [warning2]);

    expect(merged).toHaveLength(1);
    expect(merged[0].originalValue).toBe(1.0); // First one wins
  });

  it('should keep warnings with different fields', () => {
    const warning1 = createWarning('parameter-normalized', 'Same message', { field: 'temp' });
    const warning2 = createWarning('parameter-normalized', 'Same message', { field: 'topP' });

    const merged = mergeWarnings([warning1], [warning2]);

    expect(merged).toHaveLength(2);
  });
});

// ============================================================================
// filterWarningsBySeverity Tests
// ============================================================================

describe('filterWarningsBySeverity', () => {
  const warnings: IRWarning[] = [
    createWarning('parameter-normalized', 'Info', { severity: 'info' }),
    createWarning('parameter-clamped', 'Warning', { severity: 'warning' }),
    createWarning('capability-unsupported', 'Error', { severity: 'error' }),
  ];

  it('should filter to info and above', () => {
    const filtered = filterWarningsBySeverity(warnings, 'info');

    expect(filtered).toHaveLength(3);
  });

  it('should filter to warning and above', () => {
    const filtered = filterWarningsBySeverity(warnings, 'warning');

    expect(filtered).toHaveLength(2);
    expect(filtered.every(w => w.severity !== 'info')).toBe(true);
  });

  it('should filter to error only', () => {
    const filtered = filterWarningsBySeverity(warnings, 'error');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].severity).toBe('error');
  });

  it('should handle empty array', () => {
    const filtered = filterWarningsBySeverity([], 'warning');

    expect(filtered).toHaveLength(0);
  });

  it('should handle all same severity', () => {
    const sameLevel = [
      createWarning('parameter-normalized', 'W1', { severity: 'warning' }),
      createWarning('parameter-clamped', 'W2', { severity: 'warning' }),
    ];

    const filtered = filterWarningsBySeverity(sameLevel, 'warning');

    expect(filtered).toHaveLength(2);
  });
});

// ============================================================================
// filterWarningsByCategory Tests
// ============================================================================

describe('filterWarningsByCategory', () => {
  const warnings: IRWarning[] = [
    createWarning('parameter-normalized', 'Normalized'),
    createWarning('parameter-clamped', 'Clamped'),
    createWarning('capability-unsupported', 'Capability'),
    createWarning('token-limit-exceeded', 'Token'),
  ];

  it('should filter by single category', () => {
    const filtered = filterWarningsByCategory(warnings, ['parameter-normalized']);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].category).toBe('parameter-normalized');
  });

  it('should filter by multiple categories', () => {
    const filtered = filterWarningsByCategory(warnings, [
      'parameter-normalized',
      'parameter-clamped',
    ]);

    expect(filtered).toHaveLength(2);
  });

  it('should return empty for non-matching categories', () => {
    const filtered = filterWarningsByCategory(warnings, ['stop-sequences-truncated']);

    expect(filtered).toHaveLength(0);
  });

  it('should handle empty warnings array', () => {
    const filtered = filterWarningsByCategory([], ['parameter-normalized']);

    expect(filtered).toHaveLength(0);
  });

  it('should handle empty categories array', () => {
    const filtered = filterWarningsByCategory(warnings, []);

    expect(filtered).toHaveLength(0);
  });
});

// ============================================================================
// groupWarningsByCategory Tests
// ============================================================================

describe('groupWarningsByCategory', () => {
  it('should group warnings by category', () => {
    const warnings: IRWarning[] = [
      createWarning('parameter-normalized', 'N1'),
      createWarning('parameter-normalized', 'N2'),
      createWarning('parameter-clamped', 'C1'),
    ];

    const groups = groupWarningsByCategory(warnings);

    expect(groups.size).toBe(2);
    expect(groups.get('parameter-normalized')).toHaveLength(2);
    expect(groups.get('parameter-clamped')).toHaveLength(1);
  });

  it('should handle empty array', () => {
    const groups = groupWarningsByCategory([]);

    expect(groups.size).toBe(0);
  });

  it('should handle single warning', () => {
    const warnings = [createWarning('parameter-normalized', 'Test')];

    const groups = groupWarningsByCategory(warnings);

    expect(groups.size).toBe(1);
    expect(groups.get('parameter-normalized')).toHaveLength(1);
  });

  it('should handle all same category', () => {
    const warnings: IRWarning[] = [
      createWarning('parameter-normalized', 'N1'),
      createWarning('parameter-normalized', 'N2'),
      createWarning('parameter-normalized', 'N3'),
    ];

    const groups = groupWarningsByCategory(warnings);

    expect(groups.size).toBe(1);
    expect(groups.get('parameter-normalized')).toHaveLength(3);
  });

  it('should handle all different categories', () => {
    const warnings: IRWarning[] = [
      createWarning('parameter-normalized', 'N'),
      createWarning('parameter-clamped', 'C'),
      createWarning('capability-unsupported', 'U'),
      createWarning('token-limit-exceeded', 'T'),
    ];

    const groups = groupWarningsByCategory(warnings);

    expect(groups.size).toBe(4);
  });
});

// ============================================================================
// hasWarning Tests
// ============================================================================

describe('hasWarning', () => {
  const warnings: IRWarning[] = [
    createWarning('parameter-normalized', 'N', { field: 'temperature' }),
    createWarning('parameter-clamped', 'C', { field: 'topP' }),
  ];

  it('should return true when warning exists by category', () => {
    expect(hasWarning(warnings, 'parameter-normalized')).toBe(true);
  });

  it('should return false when warning does not exist by category', () => {
    expect(hasWarning(warnings, 'capability-unsupported')).toBe(false);
  });

  it('should return true when warning exists by category and field', () => {
    expect(hasWarning(warnings, 'parameter-normalized', 'temperature')).toBe(true);
  });

  it('should return false when field does not match', () => {
    expect(hasWarning(warnings, 'parameter-normalized', 'topP')).toBe(false);
  });

  it('should handle undefined warnings array', () => {
    expect(hasWarning(undefined, 'parameter-normalized')).toBe(false);
  });

  it('should handle empty warnings array', () => {
    expect(hasWarning([], 'parameter-normalized')).toBe(false);
  });

  it('should match any field when field not specified', () => {
    const warningsWithField = [
      createWarning('parameter-normalized', 'N', { field: 'temperature' }),
    ];

    expect(hasWarning(warningsWithField, 'parameter-normalized')).toBe(true);
  });
});

// ============================================================================
// formatWarning Tests
// ============================================================================

describe('formatWarning', () => {
  it('should format warning without details', () => {
    const warning = createWarning('parameter-normalized', 'Test message');
    const formatted = formatWarning(warning);

    expect(formatted).toBe('[WARNING] Test message');
  });

  it('should include source when present', () => {
    const warning = createWarning('parameter-normalized', 'Test', { source: 'openai' });
    const formatted = formatWarning(warning);

    expect(formatted).toBe('[WARNING] Test (openai)');
  });

  it('should format info severity', () => {
    const warning = createWarning('parameter-normalized', 'Info', { severity: 'info' });
    const formatted = formatWarning(warning);

    expect(formatted).toContain('[INFO]');
  });

  it('should format error severity', () => {
    const warning = createWarning('parameter-normalized', 'Error', { severity: 'error' });
    const formatted = formatWarning(warning);

    expect(formatted).toContain('[ERROR]');
  });

  it('should include details when requested', () => {
    const warning = createWarning('parameter-normalized', 'Test', {
      field: 'temperature',
      originalValue: 2.5,
      transformedValue: 2.0,
      details: { min: 0, max: 2 },
    });
    const formatted = formatWarning(warning, true);

    expect(formatted).toContain('Field: temperature');
    expect(formatted).toContain('Original: 2.5');
    expect(formatted).toContain('Transformed: 2');
    expect(formatted).toContain('Details:');
  });

  it('should handle warning with no optional fields in details mode', () => {
    const warning = createWarning('parameter-normalized', 'Simple');
    const formatted = formatWarning(warning, true);

    expect(formatted).toBe('[WARNING] Simple');
  });
});

// ============================================================================
// formatWarnings Tests
// ============================================================================

describe('formatWarnings', () => {
  it('should return "No warnings" for empty array', () => {
    const formatted = formatWarnings([]);

    expect(formatted).toBe('No warnings');
  });

  it('should format multiple warnings', () => {
    const warnings = [
      createWarning('parameter-normalized', 'Warning 1'),
      createWarning('parameter-clamped', 'Warning 2'),
    ];
    const formatted = formatWarnings(warnings);

    expect(formatted).toContain('Warning 1');
    expect(formatted).toContain('Warning 2');
    expect(formatted.split('\n')).toHaveLength(2);
  });

  it('should include details when requested', () => {
    const warnings = [
      createWarning('parameter-normalized', 'W1', { field: 'temp' }),
      createWarning('parameter-clamped', 'W2', { field: 'topP' }),
    ];
    const formatted = formatWarnings(warnings, true);

    expect(formatted).toContain('Field: temp');
    expect(formatted).toContain('Field: topP');
  });
});

// ============================================================================
// getWarningSummary Tests
// ============================================================================

describe('getWarningSummary', () => {
  it('should return summary with counts', () => {
    const warnings: IRWarning[] = [
      createWarning('parameter-normalized', 'N1', { severity: 'info' }),
      createWarning('parameter-normalized', 'N2', { severity: 'warning' }),
      createWarning('parameter-clamped', 'C1', { severity: 'warning' }),
      createWarning('capability-unsupported', 'U1', { severity: 'error' }),
    ];

    const summary = getWarningSummary(warnings);

    expect(summary.total).toBe(4);
    expect(summary.bySeverity.info).toBe(1);
    expect(summary.bySeverity.warning).toBe(2);
    expect(summary.bySeverity.error).toBe(1);
    expect(summary.byCategory['parameter-normalized']).toBe(2);
    expect(summary.byCategory['parameter-clamped']).toBe(1);
    expect(summary.byCategory['capability-unsupported']).toBe(1);
  });

  it('should handle empty array', () => {
    const summary = getWarningSummary([]);

    expect(summary.total).toBe(0);
    expect(summary.bySeverity.info).toBe(0);
    expect(summary.bySeverity.warning).toBe(0);
    expect(summary.bySeverity.error).toBe(0);
    expect(Object.keys(summary.byCategory)).toHaveLength(0);
  });

  it('should handle single warning', () => {
    const warnings = [createWarning('parameter-normalized', 'Test', { severity: 'info' })];

    const summary = getWarningSummary(warnings);

    expect(summary.total).toBe(1);
    expect(summary.bySeverity.info).toBe(1);
    expect(summary.byCategory['parameter-normalized']).toBe(1);
  });

  it('should handle all same category', () => {
    const warnings: IRWarning[] = [
      createWarning('parameter-normalized', 'N1'),
      createWarning('parameter-normalized', 'N2'),
      createWarning('parameter-normalized', 'N3'),
    ];

    const summary = getWarningSummary(warnings);

    expect(summary.byCategory['parameter-normalized']).toBe(3);
  });
});
