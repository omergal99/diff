/**
 * Diffinity — Application Entry Point
 *
 * Responsibilities:
 *  - Wire up DOM structure
 *  - Listen to toolbar events and route them
 *  - Orchestrate diff computation (client-side vs backend)
 *  - Manage tabs (Text | JSON | Folder/Archive | Image)
 */

import { bus, $, el, append, clear } from './utils/dom.js';
import { restorePreferences } from './utils/theme.js';
import { readAsText, readAsBuffer, pickFiles, setupDropZone, detectLanguage, humanSize } from './utils/file.js';
import { sha256, compareHashes } from './core/hash.js';
import { computeDiff } from './core/diff-engine.js';
import { computeJsonDiff } from './core/json-diff.js';
import { checkUnicode } from './core/unicode.js';
import { initToolbar } from './ui/toolbar.js';
import { DiffPanel } from './ui/panel.js';
import { initMetaBar, renderStats, renderIdentical, renderError, clearMetaBar } from './ui/meta-bar.js';
import { createSearch } from './ui/search.js';
import { exportHtml, exportJson, exportMerged } from './utils/export.js';
import { countLines, countWords } from './utils/format.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const LARGE_FILE_THRESHOLD = 2 * 1024 * 1024; // 2 MB → use backend
const BACKEND_URL = (typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:8000'
  : '';

// ─── State ───────────────────────────────────────────────────────────────────

const state = {
  textA:     '',
  textB:     '',
  nameA:     'File A',
  nameB:     'File B',
  sizeA:     0,
  sizeB:     0,
  hashA:     null,
  hashB:     null,
  lastResult: null,
  options:   {
    ignoreWhitespace: false,
    ignoreCase:       false,
    ignoreComments:   false,
    wordLevel:        true,
    detectMoved:      true,
    foldUnchanged:    true,
  },
};

// ─── Main init ───────────────────────────────────────────────────────────────

async function init() {
  restorePreferences();

  // Build shell
  const app      = $('#app');
  const header   = $('#header');
  const toolbar  = $('#toolbar');
  const main     = $('#main');
  const statusbar = $('#statusbar');

  // Meta bar (just above main panels)
  initMetaBar(main);

  const apiLink = document.getElementById('api-link');
  if (apiLink) {
    if (BACKEND_URL) {
      apiLink.href = `${BACKEND_URL}/api/docs`;
    } else {
      apiLink.style.display = 'none';
    }
  }

  // Toolbar
  initToolbar(toolbar);

  // Panel container
  const panelContainer = el('div', { class: 'panel-container', style: { flex: 1 } });
  main.appendChild(panelContainer);

  // Left panel
  const leftEl = el('div', { class: 'panel' },
    el('div', { class: 'panel-header' },
      el('span', { class: 'panel-title' }, 'File A'),
    ),
    el('textarea', {
      class: 'panel-body panel-textarea',
      placeholder: 'Paste text here, or open a file above…',
      spellcheck: 'false',
      style: { resize: 'none', border: 'none', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-md)', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)', width: '100%', height: '100%' },
    })
  );

  // Right panel
  const rightEl = el('div', { class: 'panel' },
    el('div', { class: 'panel-header' },
      el('span', { class: 'panel-title' }, 'File B'),
    ),
    el('textarea', {
      class: 'panel-body panel-textarea',
      placeholder: 'Paste text here, or open a file above…',
      spellcheck: 'false',
      style: { resize: 'none', border: 'none', padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-md)', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)', width: '100%', height: '100%' },
    })
  );

  panelContainer.appendChild(leftEl);
  panelContainer.appendChild(rightEl);

  // Diff output panel (shown after compare)
  const diffContainer = el('div', { class: 'panel-container', style: { display: 'none', flex: 1 } });
  const diffLeftEl  = el('div', { class: 'panel' }, el('div', { class: 'panel-header' }, el('span', { class: 'panel-title' }, 'File A')), el('div', { class: 'panel-body diff-body' }));
  const diffRightEl = el('div', { class: 'panel' }, el('div', { class: 'panel-header' }, el('span', { class: 'panel-title' }, 'File B')), el('div', { class: 'panel-body diff-body' }));
  diffContainer.appendChild(diffLeftEl);
  diffContainer.appendChild(diffRightEl);
  main.appendChild(diffContainer);

  const leftPanel  = new DiffPanel(diffLeftEl,  'left');
  const rightPanel = new DiffPanel(diffRightEl, 'right');
  leftPanel.setPeer(rightPanel);
  rightPanel.setPeer(leftPanel);

  // Compare button
  const compareBtn = el('button', {
    class: 'btn btn-primary',
    style: { marginLeft: 'auto', padding: '6px 18px', fontWeight: 700 },
    title: 'Compare the two texts (Ctrl+Enter)',
  }, '⚡ Compare');
  toolbar.appendChild(compareBtn);

  // Textareas
  const taLeft  = leftEl.querySelector('textarea');
  const taRight = rightEl.querySelector('textarea');

  // Drop zones
  setupDropZone(leftEl,  files => loadFile(files[0], 'left'));
  setupDropZone(rightEl, files => loadFile(files[0], 'right'));

  // ── Keyboard shortcut ──
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runCompare();
    if ((e.ctrlKey || e.metaKey) && e.key === 'f')     { e.preventDefault(); /* focus search */ }
  });

  // ── Compare button ──
  compareBtn.addEventListener('click', runCompare);

  // ── Toolbar events ──
  bus.on('toolbar:open-file', async ({ side }) => {
    const files = await pickFiles({ accept: '*' });
    if (files[0]) loadFile(files[0], side);
  });

  bus.on('toolbar:options', ({ key, value }) => {
    state.options[key] = value;
    if (state.lastResult) runCompare();
  });

  bus.on('toolbar:export', ({ format }) => {
    if (!state.lastResult) return;
    if (format === 'html')   exportHtml(state.lastResult, state.nameA, state.nameB);
    if (format === 'json')   exportJson(state.lastResult);
    if (format === 'merged') {
      // Simple merge: take right side text
      exportMerged(state.textB, state.nameB || 'merged.txt');
    }
  });

  bus.on('toolbar:unicode-check', () => {
    const text = taLeft.value + '\n' + taRight.value;
    const result = checkUnicode(text);
    if (result.hasSuspicious) {
      alert(`⚠ Unicode Alert!\n\nFound ${result.findings.length} suspicious character(s):\n\n` +
        result.findings.map(f => `  "${f.char}" (${f.codepoint}) at position ${f.position} — looks like "${f.looksLike}"\n  Context: …${f.context}…`).join('\n\n'));
    } else {
      alert(`✓ No suspicious Unicode characters found.\n${result.nonAsciiCount} non-ASCII characters total.`);
    }
  });

  // ── Core compare function ──────────────────────────────────────────────────

  async function runCompare() {
    const textA = taLeft.value;
    const textB = taRight.value;

    if (!textA && !textB) return;

    state.textA = textA;
    state.textB = textB;

    // Show diff panels, hide input panels
    panelContainer.style.display  = 'none';
    diffContainer.style.display   = 'flex';

    leftPanel.setTitle(state.nameA);
    rightPanel.setTitle(state.nameB);

    clearMetaBar();

    try {
      // ── SHA-256 early exit ──
      const t0 = performance.now();
      const [hashA, hashB] = await Promise.all([sha256(textA), sha256(textB)]);
      state.hashA = hashA;
      state.hashB = hashB;

      if (hashA === hashB) {
        renderIdentical(hashA, performance.now() - t0);
        leftPanel.render([]);
        rightPanel.render([]);
        updateStatus('identical');
        return;
      }

      // ── Choose engine ──
      const useBackend = textA.length > LARGE_FILE_THRESHOLD || textB.length > LARGE_FILE_THRESHOLD;
      let result = null;

      if (useBackend && BACKEND_URL) {
        try {
          result = await diffViaBackend(textA, textB);
        } catch (err) {
          console.warn('Backend unavailable, falling back to client-side diffing.', err);
        }
      }

      if (!result) {
        const linesA = textA.split('\n');
        const linesB = textB.split('\n');
        result = computeDiff(linesA, linesB, state.options);
        result.hash_a = hashA;
        result.hash_b = hashB;
      }

      state.lastResult = result;
      leftPanel.render(result.hunks);
      rightPanel.render(result.hunks);

      renderStats(result.stats, {
        nameA: state.nameA, nameB: state.nameB,
        sizeA: state.sizeA, sizeB: state.sizeB,
        hashA, hashB,
      });

      updateStatus('done', result.stats);

    } catch (err) {
      renderError(err.message);
      console.error('Compare failed:', err);
    }
  }

  async function diffViaBackend(textA, textB) {
    if (!BACKEND_URL) throw new Error('Backend is unavailable in this deployment.');

    const resp = await fetch(`${BACKEND_URL}/api/diff/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text_a: textA, text_b: textB, options: state.options }),
    });
    if (!resp.ok) throw new Error(`Backend error: ${resp.status}`);
    return resp.json();
  }

  async function loadFile(file, side) {
    const text = await readAsText(file);
    const size = file.size;
    const name = file.name;

    if (side === 'left') {
      taLeft.value    = text;
      state.nameA     = name;
      state.sizeA     = size;
      leftEl.querySelector('.panel-title').textContent = name;
    } else {
      taRight.value   = text;
      state.nameB     = name;
      state.sizeB     = size;
      rightEl.querySelector('.panel-title').textContent = name;
    }
  }

  function updateStatus(state, stats) {
    const sb = statusbar;
    clear(sb);
    if (state === 'identical') {
      append(sb, el('span', {}, '✓ Files are identical'));
    } else if (state === 'done' && stats) {
      append(sb,
        el('span', {}, `+${stats.added} −${stats.deleted} ~${stats.modified} ↕${stats.moved}`),
        el('span', {}, `|`),
        el('span', {}, `${stats.lines_a} / ${stats.lines_b} lines`),
        el('span', {}, `|`),
        el('span', {}, `⏱ ${stats.elapsed_ms}ms`),
      );
    }
  }

  // ── Back button (show input panels again) ──
  const backBtn = el('button', { class: 'btn', style: { marginRight: '8px' }, title: 'Edit input' }, '← Edit');
  toolbar.insertBefore(backBtn, toolbar.firstChild);
  backBtn.style.display = 'none';
  diffContainer.addEventListener('transitionend', () => {});

  // Show back button once diff is shown
  const origCompare = compareBtn.onclick;
  compareBtn.addEventListener('click', () => { backBtn.style.display = ''; });
  backBtn.addEventListener('click', () => {
    diffContainer.style.display  = 'none';
    panelContainer.style.display = 'flex';
    backBtn.style.display        = 'none';
    clearMetaBar();
  });
}

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', init);
