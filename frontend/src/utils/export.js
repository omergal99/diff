/**
 * Export utilities — generate downloadable diff reports.
 */

import { escapeHtml } from './dom.js';

/**
 * Trigger a browser download of a string as a file.
 * @param {string} content
 * @param {string} filename
 * @param {string} mime
 */
function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export the diff result as a self-contained HTML report.
 * @param {object} diffResult  - full DiffResult from backend or worker
 * @param {string} labelA
 * @param {string} labelB
 */
export function exportHtml(diffResult, labelA = 'File A', labelB = 'File B') {
  const { stats, hunks = [] } = diffResult;

  const rows = hunks.map(h => {
    const type = h.type;
    const lineA = h.line_a ? h.line_a : '';
    const lineB = h.line_b ? h.line_b : '';
    const textA = escapeHtml((h.lines_a ?? []).join('\n'));
    const textB = escapeHtml((h.lines_b ?? []).join('\n'));
    return `
      <tr class="${type}">
        <td class="gutter">${lineA}</td>
        <td class="code">${textA}</td>
        <td class="gutter">${lineB}</td>
        <td class="code">${textB}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Diffinity Report</title>
<style>
  body { font-family: monospace; font-size: 12px; margin: 0; background: #f8f9fa; color: #212529; }
  .header { background: #1a1d23; color: #fff; padding: 12px 16px; }
  .header h1 { font-size: 16px; margin: 0 0 4px; }
  .stats { display: flex; gap: 12px; font-size: 12px; margin-top: 6px; }
  .stat { padding: 2px 8px; border-radius: 4px; }
  .stat.added    { background: #e6ffed; color: #22543d; }
  .stat.deleted  { background: #ffeef0; color: #86181d; }
  .stat.modified { background: #fffbdd; color: #735c0f; }
  .stat.moved    { background: #e8f0fe; color: #1a237e; }
  table { border-collapse: collapse; width: 100%; }
  td { padding: 1px 8px; border: none; white-space: pre-wrap; word-break: break-all; }
  td.gutter { width: 44px; text-align: right; color: #6c757d; background: #f1f3f5; border-right: 1px solid #dee2e6; user-select: none; }
  tr.added    td { background: #e6ffed; }
  tr.deleted  td { background: #ffeef0; }
  tr.modified td { background: #fffbdd; }
  tr.moved    td { background: #e8f0fe; }
  tr.added    td.gutter { background: #d1f7dc; }
  tr.deleted  td.gutter { background: #ffd7dc; }
  tr.modified td.gutter { background: #fff5b1; }
  tr.moved    td.gutter { background: #c8daff; }
</style>
</head>
<body>
<div class="header">
  <h1>Diffinity Comparison Report</h1>
  <div>Generated: ${new Date().toISOString()}</div>
  <div>${escapeHtml(labelA)} ↔ ${escapeHtml(labelB)}</div>
  <div class="stats">
    <span class="stat added">+${stats?.added ?? 0} added</span>
    <span class="stat deleted">-${stats?.deleted ?? 0} deleted</span>
    <span class="stat modified">~${stats?.modified ?? 0} modified</span>
    <span class="stat moved">↕${stats?.moved ?? 0} moved</span>
    <span class="stat">⏱ ${stats?.elapsed_ms ?? 0}ms</span>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th class="gutter">#A</th>
      <th>${escapeHtml(labelA)}</th>
      <th class="gutter">#B</th>
      <th>${escapeHtml(labelB)}</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

  download(html, 'diffinity-report.html', 'text/html');
}

/**
 * Export the diff result as a JSON file.
 * @param {object} diffResult
 */
export function exportJson(diffResult) {
  const content = JSON.stringify(diffResult, null, 2);
  download(content, 'diffinity-report.json', 'application/json');
}

/**
 * Export merged text (after one-click merge) as a plain text file.
 * @param {string} text
 * @param {string} [filename='merged.txt']
 */
export function exportMerged(text, filename = 'merged.txt') {
  download(text, filename, 'text/plain');
}
