/**
 * Diff Panel — renders a side-by-side or unified diff view.
 *
 * Responsibilities:
 *  - Render coloured line rows with gutter numbers
 *  - Word-level inline highlights
 *  - Synchronized scroll between left and right panels
 *  - Minimap overlay
 *  - Merge arrow buttons
 *
 * Intentionally has NO knowledge of files or the diff engine —
 * it only knows how to paint what it receives.
 */

import { el, clear, append, escapeHtml } from '../utils/dom.js';
import { wordDiff } from '../core/diff-engine.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const LINE_H = 20;        // px, must match CSS line-height
const FOLD_CONTEXT = 3;   // equal lines to keep around changes before folding

// ─── Sync scroll state ───────────────────────────────────────────────────────

let _syncLock = false;    // prevents scroll feedback loops

function syncScroll(sourceEl, targetEl) {
  if (_syncLock) return;
  _syncLock = true;
  const ratio = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
  targetEl.scrollTop = ratio * (targetEl.scrollHeight - targetEl.clientHeight);
  requestAnimationFrame(() => { _syncLock = false; });
}

// ─── Word-level HTML ─────────────────────────────────────────────────────────

function buildWordHtml(wordOps) {
  if (!wordOps?.length) return null;
  return wordOps.map(op => {
    const text = escapeHtml(op.text ?? '');
    if (op.op === 'equal')  return text;
    if (op.op === 'insert') return `<span class="word-insert">${text}</span>`;
    if (op.op === 'delete') return `<span class="word-delete">${text}</span>`;
    return text;
  }).join('');
}

// ─── Single line row ─────────────────────────────────────────────────────────

function buildLineRow(hunk, side, opts = {}) {
  const isLeft   = side === 'left';
  const lineNum  = isLeft ? hunk.line_a : hunk.line_b;
  const text     = isLeft
    ? (hunk.lines_a?.[0] ?? '')
    : (hunk.lines_b?.[0] ?? '');

  const row = el('div', { class: `line ${hunk.type}`, dataset: { lineA: hunk.line_a, lineB: hunk.line_b } });

  // Gutter
  const gutter = el('div', { class: 'gutter-line' }, lineNum != null ? String(lineNum) : '');
  row.appendChild(gutter);

  // Content
  const content = el('div', { class: 'line-content' });

  if (hunk.type === 'modified' && hunk.word_diff?.length) {
    // Use pre-computed word diff from backend if available; otherwise compute client-side
    const ops = hunk.word_diff.length
      ? hunk.word_diff
      : wordDiff(hunk.lines_a?.[0] ?? '', hunk.lines_b?.[0] ?? '');

    // For left panel show deletes, for right panel show inserts
    const filtered = ops.map(op => {
      if (isLeft  && op.op === 'insert') return { ...op, op: 'equal' };
      if (!isLeft && op.op === 'delete') return { ...op, op: 'equal' };
      return op;
    });
    content.innerHTML = buildWordHtml(filtered) ?? escapeHtml(text);
  } else {
    content.textContent = text;
  }

  // Moved badge
  if (hunk.type === 'moved') {
    const target = isLeft ? hunk.moved_to : hunk.moved_from;
    if (target != null) {
      const badge = el('span', {
        class: 'moved-badge',
        title: isLeft ? `Moved to line ${target}` : `Moved from line ${target}`,
      }, isLeft ? `→ ${target}` : `← ${target}`);
      content.appendChild(badge);
    }
  }

  row.appendChild(content);

  // Merge arrow (only for changed lines)
  if (opts.showMerge && ['added','deleted','modified','moved'].includes(hunk.type)) {
    const arrowDir = isLeft ? '→' : '←';
    const arrow = el('button', {
      class: 'merge-arrow',
      title: isLeft ? 'Copy to right' : 'Copy to left',
      dataset: { lineA: hunk.line_a, lineB: hunk.line_b, direction: isLeft ? 'right' : 'left' },
    }, arrowDir);
    row.appendChild(arrow);
  }

  return row;
}

// ─── Fold marker ─────────────────────────────────────────────────────────────

function buildFoldMarker(count, onExpand) {
  const marker = el('div', { class: 'fold-marker' }, `··· ${count} unchanged lines (click to expand) ···`);
  marker.addEventListener('click', onExpand);
  return marker;
}

// ─── Panel class ─────────────────────────────────────────────────────────────

export class DiffPanel {
  /**
   * @param {HTMLElement} container  - the .panel element
   * @param {'left'|'right'} side
   * @param {object} [opts]
   * @param {boolean} [opts.showMerge=true]
   * @param {boolean} [opts.foldUnchanged=true]
   */
  constructor(container, side, opts = {}) {
    this.container   = container;
    this.side        = side;
    this.opts        = { showMerge: true, foldUnchanged: true, ...opts };
    this._hunks      = [];
    this._peer       = null;     // the other DiffPanel for scroll sync

    this.body        = container.querySelector('.panel-body');
    this.titleEl     = container.querySelector('.panel-title');

    if (!this.body) {
      this.body = el('div', { class: 'panel-body' });
      container.appendChild(this.body);
    }

    // Scroll sync
    this.body.addEventListener('scroll', () => {
      if (this._peer) syncScroll(this.body, this._peer.body);
    });

    // Merge arrow delegation
    this.body.addEventListener('click', (e) => {
      const arrow = e.target.closest('.merge-arrow');
      if (arrow) this._onMergeClick(arrow);
    });
  }

  /** Link this panel to its peer for scroll synchronisation. */
  setPeer(otherPanel) { this._peer = otherPanel; }

  /** Set the panel title. */
  setTitle(title) { if (this.titleEl) this.titleEl.textContent = title; }

  /**
   * Render a full diff result.
   * @param {object[]} hunks  - DiffHunk[]
   */
  render(hunks) {
    this._hunks = hunks;
    clear(this.body);

    const frag  = document.createDocumentFragment();
    const total = hunks.length;
    let i       = 0;

    while (i < total) {
      const h = hunks[i];

      // Fold long equal regions
      if (this.opts.foldUnchanged && h.type === 'equal') {
        // Count consecutive equal hunks
        let j = i;
        while (j < total && hunks[j].type === 'equal') j++;
        const equalCount = j - i;

        if (equalCount > FOLD_CONTEXT * 2 + 2) {
          // Show first FOLD_CONTEXT
          for (let k = i; k < i + FOLD_CONTEXT; k++) {
            frag.appendChild(buildLineRow(hunks[k], this.side, this.opts));
          }
          // Fold marker
          const foldedCount = equalCount - FOLD_CONTEXT * 2;
          const foldStart   = i + FOLD_CONTEXT;
          const foldEnd     = j - FOLD_CONTEXT;
          const marker      = buildFoldMarker(foldedCount, () => {
            // Expand: replace marker with the hidden lines
            const rows = [];
            for (let k = foldStart; k < foldEnd; k++) {
              rows.push(buildLineRow(hunks[k], this.side, this.opts));
            }
            marker.replaceWith(...rows);
          });
          frag.appendChild(marker);
          // Show last FOLD_CONTEXT
          for (let k = foldEnd; k < j; k++) {
            frag.appendChild(buildLineRow(hunks[k], this.side, this.opts));
          }
          i = j;
          continue;
        }
      }

      frag.appendChild(buildLineRow(h, this.side, this.opts));
      i++;
    }

    this.body.appendChild(frag);
  }

  /** Clear the panel. */
  clear() { clear(this.body); this._hunks = []; }

  /** Scroll to a specific line number. */
  scrollToLine(lineNum) {
    // Find the row for this line
    const attr = this.side === 'left' ? 'lineA' : 'lineB';
    const row = this.body.querySelector(`[data-line-${attr === 'lineA' ? 'a' : 'b'}="${lineNum}"]`);
    if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    else this.body.scrollTop = (lineNum - 1) * LINE_H;
  }

  /** Highlight lines matching search results. */
  highlightSearch(lineIndices, currentIdx) {
    // Remove previous highlights
    this.body.querySelectorAll('.search-match').forEach(el => el.classList.remove('search-match', 'current'));
    if (!lineIndices.length) return;

    const attr = this.side === 'left' ? 'a' : 'b';
    lineIndices.forEach((lineNum, i) => {
      const row = this.body.querySelector(`[data-line-${attr}="${lineNum}"]`);
      if (row) {
        row.classList.add('search-match');
        if (i === currentIdx) row.classList.add('current');
      }
    });

    // Scroll to current match
    const current = this.body.querySelector('.search-match.current');
    current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  _onMergeClick(arrow) {
    const { direction, lineA, lineB } = arrow.dataset;
    this.container.dispatchEvent(new CustomEvent('merge-request', {
      bubbles: true,
      detail: { direction, lineA: Number(lineA), lineB: Number(lineB) },
    }));
  }
}
