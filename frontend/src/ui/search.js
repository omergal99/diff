/**
 * Search — per-panel search bar with regex support and session history.
 *
 * Usage:
 *   const search = createSearch(container, onMatch);
 *   search.highlight(text);  // highlight matches in rendered lines
 */

import { el, $, append, clear } from '../utils/dom.js';

const MAX_HISTORY = 20;
const HISTORY_KEY = 'diffinity-search-history';

// ─── History ─────────────────────────────────────────────────────────────────

function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? '[]'); }
  catch { return []; }
}

function saveHistory(entries) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

function addToHistory(term) {
  if (!term) return;
  const hist = loadHistory().filter(h => h !== term);
  hist.unshift(term);
  saveHistory(hist);
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a search widget and mount it into a container element.
 *
 * @param {HTMLElement} mountPoint
 * @param {function({ term:string, isRegex:boolean, results:number[] }): void} onChange
 * @returns {{ update(lines: string[]): void, destroy(): void }}
 */
export function createSearch(mountPoint, onChange) {
  let _lines   = [];
  let _matches = [];    // array of line indices
  let _current = 0;
  let _histOpen = false;

  // ── DOM ──
  const input    = el('input', { type: 'text', placeholder: 'Search… (/ for regex)', title: 'Press Enter to find next, Shift+Enter for previous' });
  const regexBtn = el('button', { class: 'btn-icon', title: 'Toggle regex', 'aria-pressed': 'false' }, '.*');
  const prevBtn  = el('button', { class: 'btn-icon', title: 'Previous (Shift+Enter)' }, '↑');
  const nextBtn  = el('button', { class: 'btn-icon', title: 'Next (Enter)' }, '↓');
  const countEl  = el('span', { class: 'search-count', style: { fontSize: '11px', color: 'var(--color-text-muted)', minWidth: '60px' } });
  const histBtn  = el('button', { class: 'btn-icon', title: 'Search history' }, '▾');
  const histPanel = el('ul', { class: 'search-history', style: { display: 'none', position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', zIndex: 100, maxHeight: '200px', overflow: 'auto', listStyle: 'none', padding: '4px 0' } });

  const wrapper = el('div', { class: 'search-bar', style: { position: 'relative' } },
    input, regexBtn, prevBtn, nextBtn, countEl, histBtn, histPanel
  );
  mountPoint.appendChild(wrapper);

  let isRegex = false;

  function runSearch() {
    const term = input.value;
    if (!term) { _matches = []; countEl.textContent = ''; onChange({ term: '', isRegex, results: [] }); return; }

    addToHistory(term);
    try {
      const pattern = isRegex ? new RegExp(term, 'gi') : null;
      _matches = [];
      _lines.forEach((line, idx) => {
        const hit = pattern ? pattern.test(line) : line.toLowerCase().includes(term.toLowerCase());
        if (hit) _matches.push(idx);
        if (pattern) pattern.lastIndex = 0;
      });
      _current = 0;
      countEl.textContent = _matches.length ? `${_current + 1}/${_matches.length}` : 'no results';
      onChange({ term, isRegex, results: _matches, current: _matches[_current] });
    } catch (e) {
      countEl.textContent = 'bad regex';
    }
  }

  function navigate(dir) {
    if (!_matches.length) return;
    _current = (_current + dir + _matches.length) % _matches.length;
    countEl.textContent = `${_current + 1}/${_matches.length}`;
    onChange({ term: input.value, isRegex, results: _matches, current: _matches[_current] });
  }

  // ── Events ──
  input.addEventListener('input', runSearch);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); navigate(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { input.value = ''; runSearch(); }
  });
  regexBtn.addEventListener('click', () => {
    isRegex = !isRegex;
    regexBtn.setAttribute('aria-pressed', String(isRegex));
    regexBtn.style.background = isRegex ? 'var(--color-accent-light)' : '';
    runSearch();
  });
  prevBtn.addEventListener('click', () => navigate(-1));
  nextBtn.addEventListener('click', () => navigate(1));
  histBtn.addEventListener('click', () => {
    _histOpen = !_histOpen;
    histPanel.style.display = _histOpen ? 'block' : 'none';
    if (_histOpen) renderHistory();
  });

  function renderHistory() {
    clear(histPanel);
    const hist = loadHistory();
    if (!hist.length) {
      histPanel.appendChild(el('li', { style: { padding: '6px 12px', color: 'var(--color-text-muted)', fontSize: '12px' } }, 'No history'));
      return;
    }
    hist.forEach(term => {
      const item = el('li', {
        style: { padding: '4px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-mono)' },
        onMouseenter: (e) => e.target.style.background = 'var(--color-surface-2)',
        onMouseleave: (e) => e.target.style.background = '',
      }, term);
      item.addEventListener('click', () => {
        input.value = term;
        _histOpen = false;
        histPanel.style.display = 'none';
        runSearch();
      });
      histPanel.appendChild(item);
    });
  }

  // Close history on outside click
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) { _histOpen = false; histPanel.style.display = 'none'; }
  });

  return {
    /** Update the lines this search operates on. */
    update(lines) { _lines = lines; runSearch(); },
    destroy() { wrapper.remove(); },
    focus() { input.focus(); },
  };
}
