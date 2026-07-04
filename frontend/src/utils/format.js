/**
 * Formatting utilities — pure functions, no DOM, no side effects.
 */

/** Format bytes to human-readable size. */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Format milliseconds to human-readable duration. */
export function formatMs(ms) {
  if (ms < 1)     return `${ms.toFixed(2)}ms`;
  if (ms < 1000)  return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Format a number with thousands separator. */
export function formatNumber(n) {
  return new Intl.NumberFormat().format(n);
}

/** Truncate a string to maxLen chars with ellipsis. */
export function truncate(str, maxLen = 40) {
  if (!str || str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 1)}…`;
}

/** Pad a number to a fixed width (for line numbers). */
export function padNum(n, width) {
  return String(n).padStart(width, ' ');
}

/** Return a readable percentage string. */
export function formatPct(ratio) {
  return `${(ratio * 100).toFixed(1)}%`;
}

/**
 * Format a SHA-256 hash for display — show first 16 chars + ellipsis.
 * @param {string} hash
 */
export function shortHash(hash) {
  if (!hash) return '';
  return `${hash.slice(0, 16)}…`;
}

/** Count lines in a string. */
export function countLines(text) {
  if (!text) return 0;
  let n = 1;
  for (const ch of text) if (ch === '\n') n++;
  return n;
}

/** Count words in a string. */
export function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
