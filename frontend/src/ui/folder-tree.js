/**
 * Folder Tree — renders a directory-explorer-style view of archive/folder diffs.
 *
 * Receives an array of ArchiveEntry objects (streamed from backend SSE).
 * Emits 'tree:open-file' { path, status } when a modified file is double-clicked.
 */

import { el, clear, append } from '../utils/dom.js';
import { bus } from '../utils/dom.js';
import { formatBytes } from '../utils/format.js';

// Status → display icon + label
const STATUS = {
  equal:    { icon: '=',  label: 'equal',    badge: 'equal'    },
  modified: { icon: '~',  label: 'modified', badge: 'modified' },
  added:    { icon: '+',  label: 'added',    badge: 'added'    },
  deleted:  { icon: '−',  label: 'deleted',  badge: 'deleted'  },
};

/**
 * Mount a folder tree into a container element.
 *
 * @param {HTMLElement} container
 * @returns {{ addEntry(entry): void, setSummary(summary): void, clear(): void }}
 */
export function createFolderTree(container) {
  // Filter bar
  const filterAll      = filterBtn('All',      null,       true);
  const filterModified = filterBtn('Changed',  'modified');
  const filterAdded    = filterBtn('Added',    'added');
  const filterDeleted  = filterBtn('Deleted',  'deleted');

  let activeFilter = null;

  [filterAll, filterModified, filterAdded, filterDeleted].forEach(b => {
    b.addEventListener('click', () => {
      activeFilter = b.dataset.filter || null;
      [filterAll, filterModified, filterAdded, filterDeleted].forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      applyFilter();
    });
  });

  const filterBar = el('div', { class: 'toolbar-group', style: { padding: '4px 8px', borderBottom: '1px solid var(--color-border)' } },
    filterAll, filterModified, filterAdded, filterDeleted
  );

  const summaryEl = el('div', { style: { fontSize: '11px', color: 'var(--color-text-muted)', padding: '4px 12px' } });
  const treeEl    = el('div', { class: 'folder-tree' });

  container.appendChild(filterBar);
  container.appendChild(summaryEl);
  container.appendChild(treeEl);

  const _entries = [];

  function applyFilter() {
    clear(treeEl);
    const filtered = activeFilter ? _entries.filter(e => e.status === activeFilter) : _entries;
    filtered.forEach(e => treeEl.appendChild(buildRow(e)));
  }

  function buildRow(entry) {
    const s      = STATUS[entry.status] ?? STATUS.equal;
    const parts  = entry.path.split('/');
    const indent = (parts.length - 1) * 12;
    const name   = parts[parts.length - 1];
    const meta   = [
      entry.size_a != null ? formatBytes(entry.size_a) : '',
      entry.size_b != null && entry.size_b !== entry.size_a ? `→ ${formatBytes(entry.size_b)}` : '',
    ].filter(Boolean).join(' ');

    const row = el('div', {
      class: 'tree-item',
      style: { paddingLeft: `${12 + indent}px` },
      title: entry.path,
    },
      el('span', { class: `status-badge ${entry.status}` }, s.icon),
      el('span', { style: { flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px' } }, name),
      meta && el('span', { style: { fontSize: '11px', color: 'var(--color-text-muted)' } }, meta),
    );

    if (entry.status === 'modified') {
      row.style.cursor = 'pointer';
      row.addEventListener('dblclick', () => {
        bus.emit('tree:open-file', { path: entry.path, status: entry.status });
      });
      row.title += '\n(double-click to compare)';
    }

    return row;
  }

  return {
    addEntry(entry) {
      _entries.push(entry);
      if (!activeFilter || activeFilter === entry.status) {
        treeEl.appendChild(buildRow(entry));
      }
    },

    setSummary({ equal = 0, modified = 0, added = 0, deleted = 0, elapsed_ms = 0 }) {
      summaryEl.textContent =
        `${equal} equal · ${modified} modified · ${added} added · ${deleted} deleted · ${(elapsed_ms / 1000).toFixed(2)}s`;
    },

    clear() {
      _entries.length = 0;
      clear(treeEl);
      summaryEl.textContent = '';
    },
  };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function filterBtn(label, filter, defaultActive = false) {
  const b = el('button', {
    class: `btn btn-sm ${defaultActive ? 'active' : ''}`,
    dataset: { filter: filter ?? '' },
  }, label);
  return b;
}
