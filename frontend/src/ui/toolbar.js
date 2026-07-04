/**
 * Toolbar — top control bar.
 *
 * Emits events via the shared bus:
 *   'toolbar:open-file'    { side: 'left'|'right' }
 *   'toolbar:options'      { key, value }  (filter toggle)
 *   'toolbar:view-change'  { mode: 'split'|'unified' }
 *   'toolbar:theme'        { theme }
 *   'toolbar:rtl'          { dir }
 *   'toolbar:export'       { format: 'html'|'json'|'merged' }
 *   'toolbar:unicode-check'
 *   'toolbar:tab'          { tab }
 */

import { el, append, $ } from '../utils/dom.js';
import { bus } from '../utils/dom.js';
import { cycleTheme, toggleDir, getTheme } from '../utils/theme.js';

// ─── Button factories ─────────────────────────────────────────────────────────

function btn(label, title, onClick, cls = '') {
  const b = el('button', { class: `btn ${cls}`, title }, label);
  b.addEventListener('click', onClick);
  return b;
}

function toggleBtn(label, title, key, defaultValue = false) {
  let active = defaultValue;
  const b = el('button', {
    class: `btn btn-toggle ${active ? 'active' : ''}`,
    title,
    'aria-pressed': String(active),
  }, label);
  b.addEventListener('click', () => {
    active = !active;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
    bus.emit('toolbar:options', { key, value: active });
  });
  return b;
}

function sep() {
  return el('div', { class: 'toolbar-divider', 'aria-hidden': 'true' });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Build and mount the toolbar into `container`.
 * @param {HTMLElement} container
 */
export function initToolbar(container) {
  const toolbar = container;

  // ── File open ──
  append(toolbar,
    el('div', { class: 'toolbar-group' },
      btn('📂 Open A', 'Open file for left panel',  () => bus.emit('toolbar:open-file', { side: 'left' }),  'btn-primary'),
      btn('📂 Open B', 'Open file for right panel', () => bus.emit('toolbar:open-file', { side: 'right' }), 'btn-primary'),
    ),
    sep(),
  );

  // ── View mode ──
  let viewMode = 'split';
  const splitBtn  = btn('⊞ Split',  'Side-by-side view', () => setView('split'),   'active');
  const unifiedBtn = btn('≡ Unified', 'Unified diff view', () => setView('unified'));

  function setView(mode) {
    viewMode = mode;
    splitBtn.classList.toggle('active',   mode === 'split');
    unifiedBtn.classList.toggle('active', mode === 'unified');
    bus.emit('toolbar:view-change', { mode });
  }

  append(toolbar, el('div', { class: 'toolbar-group' }, splitBtn, unifiedBtn), sep());

  // ── Filters ──
  append(toolbar,
    el('div', { class: 'toolbar-group' },
      el('span', { style: { fontSize: '11px', color: 'var(--color-text-muted)', marginRight: '2px' } }, 'Ignore:'),
      toggleBtn('Spaces',   'Ignore whitespace differences',    'ignoreWhitespace'),
      toggleBtn('Case',     'Ignore case differences',          'ignoreCase'),
      toggleBtn('Comments', 'Ignore comment lines',             'ignoreComments'),
    ),
    sep(),
  );

  // ── Moved detection ──
  append(toolbar,
    el('div', { class: 'toolbar-group' },
      toggleBtn('↕ Moved', 'Detect moved lines (shown in blue)', 'detectMoved', true),
      toggleBtn('Words',   'Word-level highlighting inside changed lines', 'wordLevel', true),
    ),
    sep(),
  );

  // ── Fold unchanged ──
  append(toolbar,
    el('div', { class: 'toolbar-group' },
      toggleBtn('Fold', 'Collapse unchanged regions', 'foldUnchanged', true),
    ),
    sep(),
  );

  // ── Unicode check ──
  append(toolbar,
    el('div', { class: 'toolbar-group' },
      btn('⚠ Unicode', 'Check for homograph / suspicious Unicode', () => bus.emit('toolbar:unicode-check')),
    ),
    sep(),
  );

  // ── Export ──
  append(toolbar,
    el('div', { class: 'toolbar-group' },
      btn('⬇ HTML',   'Export diff report as HTML', () => bus.emit('toolbar:export', { format: 'html' })),
      btn('⬇ JSON',   'Export diff result as JSON', () => bus.emit('toolbar:export', { format: 'json' })),
      btn('⬇ Merged', 'Download merged file',       () => bus.emit('toolbar:export', { format: 'merged' })),
    ),
    sep(),
  );

  // ── RTL / Theme ──
  append(toolbar,
    el('div', { class: 'toolbar-group' },
      btn('⇄ RTL', 'Toggle RTL/LTR direction', () => {
        const dir = toggleDir();
        bus.emit('toolbar:rtl', { dir });
      }),
      btn('◑ Theme', 'Cycle through themes', () => {
        const theme = cycleTheme();
        bus.emit('toolbar:theme', { theme });
      }),
    ),
  );
}
