/**
 * Meta Dashboard — shows timing, file sizes, change counts.
 * Renders into a fixed container above the diff panels.
 */

import { el, clear, append } from '../utils/dom.js';
import { formatMs, formatBytes, formatNumber, shortHash } from '../utils/format.js';

let _container = null;

/** Initialise and return the meta bar container element. */
export function initMetaBar(parent) {
  _container = el('div', { class: 'meta-bar', id: 'meta-bar', 'aria-live': 'polite' });
  parent.appendChild(_container);
  return _container;
}

/**
 * Render diff statistics into the meta bar.
 *
 * @param {object} stats        - DiffStats from engine
 * @param {object} [fileMeta]   - { nameA, nameB, sizeA, sizeB, hashA, hashB }
 */
export function renderStats(stats, fileMeta = {}) {
  if (!_container) return;
  clear(_container);

  const {
    added = 0, deleted = 0, modified = 0, moved = 0,
    lines_a = 0, lines_b = 0, elapsed_ms = 0,
  } = stats;

  const { nameA, nameB, sizeA, sizeB, hashA, hashB } = fileMeta;

  // Build chips
  const chips = [
    added    > 0 && chip('added',    `+${formatNumber(added)} added`),
    deleted  > 0 && chip('deleted',  `−${formatNumber(deleted)} deleted`),
    modified > 0 && chip('modified', `~${formatNumber(modified)} modified`),
    moved    > 0 && chip('moved',    `↕${formatNumber(moved)} moved`),
    chip('info', `${formatNumber(lines_a)} / ${formatNumber(lines_b)} lines`),
    chip('info', `⏱ ${formatMs(elapsed_ms)}`),
    sizeA != null && chip('info', `A: ${formatBytes(sizeA)}`),
    sizeB != null && chip('info', `B: ${formatBytes(sizeB)}`),
    hashA && hashA === hashB && chip('added', `✓ Identical (SHA-256: ${shortHash(hashA)})`),
  ].filter(Boolean);

  append(_container, ...chips);
}

/**
 * Show a simple "files are identical" message.
 * @param {string} hash
 * @param {number} elapsedMs
 */
export function renderIdentical(hash, elapsedMs) {
  if (!_container) return;
  clear(_container);
  append(_container,
    chip('added', `✓ Files are identical`),
    chip('info',  `SHA-256: ${shortHash(hash)}`),
    chip('info',  `⏱ ${formatMs(elapsedMs)}`),
  );
}

/**
 * Show an error message in the meta bar.
 * @param {string} message
 */
export function renderError(message) {
  if (!_container) return;
  clear(_container);
  append(_container,
    el('span', { class: 'meta-chip', style: { background: 'var(--color-deleted-bg)', color: 'var(--color-deleted-text)', border: '1px solid var(--color-deleted-border)' } },
      `⚠ ${message}`)
  );
}

/** Clear / hide the meta bar. */
export function clearMetaBar() {
  if (_container) clear(_container);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function chip(type, text) {
  return el('span', { class: `meta-chip ${type}` }, text);
}
