/**
 * Output Formatter Utility
 *
 * Formats output for terminal display.
 * Handles colors, tables, and streaming output.
 *
 * @module cli/utils/output-formatter
 */

/**
 * ANSI color codes.
 */
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

let colorsEnabled = true;

/**
 * Enable or disable colored output.
 */
export function setColorsEnabled(enabled: boolean): void {
  colorsEnabled = enabled;
}

/**
 * Check if colors are enabled.
 */
export function areColorsEnabled(): boolean {
  return colorsEnabled;
}

/**
 * Apply color to text.
 */
export function colorize(text: string, color: keyof typeof colors): string {
  if (!colorsEnabled) {
    return text;
  }
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Format text with multiple styles.
 */
export function style(text: string, ...styles: Array<keyof typeof colors>): string {
  if (!colorsEnabled) {
    return text;
  }
  const prefix = styles.map((s) => colors[s]).join('');
  return `${prefix}${text}${colors.reset}`;
}

/**
 * Print success message.
 */
export function success(message: string): void {
  console.log(colorize('✓ ' + message, 'green'));
}

/**
 * Print error message.
 */
export function error(message: string): void {
  console.error(colorize('✗ ' + message, 'red'));
}

/**
 * Print warning message.
 */
export function warn(message: string): void {
  console.warn(colorize('⚠ ' + message, 'yellow'));
}

/**
 * Print info message.
 */
export function info(message: string): void {
  console.log(colorize('ℹ ' + message, 'blue'));
}

/**
 * Format a table.
 */
export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: 'left' | 'right';
}

export interface TableOptions {
  columns: TableColumn[];
  rows: Record<string, any>[];
}

export function formatTable(options: TableOptions): string {
  const { columns, rows } = options;

  if (rows.length === 0) {
    return '';
  }

  // Calculate column widths
  const widths = columns.map((col) => {
    const headerWidth = col.header.length;
    const maxContentWidth = Math.max(
      ...rows.map((row) => String(row[col.key] || '').length)
    );
    return col.width || Math.max(headerWidth, maxContentWidth);
  });

  // Format header
  const header = columns
    .map((col, i) => col.header.padEnd(widths[i] || 0))
    .join('  ');

  // Format rows
  const formattedRows = rows.map((row) =>
    columns
      .map((col, i) => {
        const value = String(row[col.key] || '');
        const width = widths[i] || 0;
        return col.align === 'right'
          ? value.padStart(width)
          : value.padEnd(width);
      })
      .join('  ')
  );

  return [
    style(header, 'bold'),
    ...formattedRows,
  ].join('\n');
}

/**
 * Format file size in human-readable format.
 */
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format duration in human-readable format.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3600000) {
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * Format relative time (e.g., "2 minutes ago").
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) {
    return 'just now';
  }
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(diff / 86400000);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Create a spinner for long-running operations.
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private interval?: NodeJS.Timeout;
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  start(): void {
    if (this.interval || !colorsEnabled) {
      return;
    }

    this.interval = setInterval(() => {
      const frame = this.frames[this.currentFrame] || '⠋';
      process.stdout.write(
        `\r${colorize(frame, 'cyan')} ${this.text}`
      );
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    // Clear spinner line
    process.stdout.write('\r\x1b[K');

    if (finalMessage) {
      console.log(finalMessage);
    }
  }

  succeed(message?: string): void {
    this.stop(success.bind(null, message || this.text) as any);
  }

  fail(message?: string): void {
    this.stop(error.bind(null, message || this.text) as any);
  }
}

/**
 * Print a box around text.
 */
export function printBox(text: string, options: { title?: string; padding?: number } = {}): void {
  const { title, padding = 1 } = options;
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map((l) => l.length));
  const width = maxLength + padding * 2;

  const top = title
    ? `╭─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 3))}╮`
    : `╭${'─'.repeat(width + 2)}╮`;
  const bottom = `╰${'─'.repeat(width + 2)}╯`;
  const paddingStr = ' '.repeat(padding);

  console.log(style(top, 'cyan'));
  for (const line of lines) {
    const padded = line.padEnd(maxLength);
    console.log(style('│', 'cyan') + paddingStr + padded + paddingStr + style('│', 'cyan'));
  }
  console.log(style(bottom, 'cyan'));
}
