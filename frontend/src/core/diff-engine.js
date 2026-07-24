/**
 * Client-side diff engine — Myers algorithm + word-level highlighting.
 *
 * Used for small files (< 2 MB) directly in the browser.
 * Large files are sent to the Python backend instead.
 *
 * Exported:
 *   computeDiff(linesA, linesB, options) → DiffResult
 *   wordDiff(lineA, lineB)               → WordOp[]
 */

// ─── Options defaults ───────────────────────────────────────────────────────

/** @typedef {{ ignoreWhitespace:boolean, ignoreCase:boolean, ignoreComments:boolean, wordLevel:boolean, detectMoved:boolean, movedThreshold:number }} DiffOptions */
export const DEFAULT_OPTIONS = {
  ignoreWhitespace: false,
  ignoreCase:       false,
  ignoreComments:   false,
  wordLevel:        true,
  detectMoved:      true,
  movedThreshold:   0.80,
};

// ─── Normalisation ───────────────────────────────────────────────────────────

function normalize(line, opts) {
  if (opts.ignoreCase)       line = line.toLowerCase();
  if (opts.ignoreWhitespace) line = line.trim().replace(/\s+/g, ' ');
  if (opts.ignoreComments) {
    const t = line.trimStart();
    if (t.startsWith('//') || t.startsWith('#') || t.startsWith('--')) return '';
  }
  return line;
}

// ─── Myers diff (LCS-based, O(ND)) ──────────────────────────────────────────

/**
 * Pure Myers diff on two arrays of strings.
 * Returns an array of ops: { op: 'equal'|'insert'|'delete', indexA, indexB, count }
 */
function myersDiff(a, b) {
  const n = a.length, m = b.length;
  const max = n + m;
  if (max === 0) return [];

  const v = new Int32Array(2 * max + 2);
  const trace = [];

  // Forward search
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[k - 1 + max] < v[k + 1 + max])) {
        x = v[k + 1 + max];
      } else {
        x = v[k - 1 + max] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[k + max] = x;
      if (x >= n && y >= m) { trace.push(v.slice()); break outer; }
    }
  }

  // Backtrack
  const ops = [];
  let x = n, y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const vv = trace[d];
    const k  = x - y;
    let prevK;
    if (k === -d || (k !== d && vv[k - 1 + max] < vv[k + 1 + max])) {
      prevK = k + 1;
    } else {
      prevK = k - 1;
    }
    const prevX = vv[prevK + max];
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push({ op: 'equal', indexA: x - 1, indexB: y - 1 });
      x--; y--;
    }
    if (d > 0) {
      if (x === prevX) {
        ops.push({ op: 'insert', indexA: null, indexB: y - 1 });
        y--;
      } else {
        ops.push({ op: 'delete', indexA: x - 1, indexB: null });
        x--;
      }
    }
  }
  return ops.reverse();
}

// ─── Word tokenizer ──────────────────────────────────────────────────────────

const WORD_RE = /(\s+|[^\w\s]+|\w+)/g;

function tokenize(line) {
  return line.match(WORD_RE) ?? [];
}

// ─── Word-level diff ─────────────────────────────────────────────────────────

/**
 * Compute word-level operations between two changed lines.
 * @param {string} lineA
 * @param {string} lineB
 * @returns {{ op: 'equal'|'insert'|'delete', text: string }[]}
 */
export function wordDiff(lineA, lineB) {
  const tA = tokenize(lineA);
  const tB = tokenize(lineB);
  const rawOps = myersDiff(tA, tB);
  const ops = [];

  for (const { op, indexA, indexB } of rawOps) {
    if (op === 'equal') {
      ops.push({ op: 'equal', text: tA[indexA] ?? '' });
    } else if (op === 'delete') {
      ops.push({ op: 'delete', text: (indexA != null && indexA >= 0) ? (tA[indexA] ?? '') : '' });
    } else if (op === 'insert') {
      ops.push({ op: 'insert', text: (indexB != null && indexB >= 0) ? (tB[indexB] ?? '') : '' });
    }
  }

  return ops;
}

// ─── Similarity (for moved-line detection) ───────────────────────────────────

/**
 * Compute Ratcliff/Obershelp-like similarity between two strings.
 * Fast approximation using longest common substring ratio.
 * @returns {number} 0.0 – 1.0
 */
function similarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  // Count matching character pairs (bigrams)
  const bigramsA = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) ?? 0) + 1);
  }
  let matches = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    if (bigramsA.has(bg) && bigramsA.get(bg) > 0) {
      matches++;
      bigramsA.set(bg, bigramsA.get(bg) - 1);
    }
  }
  return (2 * matches) / (a.length + b.length - 2);
}

// ─── Moved-line detection ────────────────────────────────────────────────────

function detectMoved(hunks, threshold) {
  const deleted = hunks.filter(h => h.type === 'deleted');
  const added   = hunks.filter(h => h.type === 'added');
  if (!deleted.length || !added.length) return hunks;

  // Build candidates
  const candidates = [];
  for (const d of deleted) {
    for (const a of added) {
      const sim = similarity(
        (d.lines_a[0] ?? '').trim(),
        (a.lines_b[0] ?? '').trim()
      );
      if (sim >= threshold) candidates.push({ sim, d, a });
    }
  }
  candidates.sort((x, y) => y.sim - x.sim);

  const matchedD = new Set();
  const matchedA = new Set();

  for (const { d, a } of candidates) {
    if (matchedD.has(d) || matchedA.has(a)) continue;
    matchedD.add(d);
    matchedA.add(a);
    d.type      = 'moved';
    d.moved_to  = a.line_b;
    a.type      = 'moved';
    a.moved_from = d.line_a;
  }

  return hunks;
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Compute a full diff between two arrays of lines.
 *
 * @param {string[]} linesA
 * @param {string[]} linesB
 * @param {Partial<DiffOptions>} [opts]
 * @returns {{ stats: object, hunks: object[] }}
 */
export function computeDiff(linesA, linesB, opts = {}) {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  const t0 = performance.now();

  const normA = linesA.map(l => normalize(l, options));
  const normB = linesB.map(l => normalize(l, options));

  const rawOps = myersDiff(normA, normB);

  const hunks  = [];
  let counts   = { equal: 0, added: 0, deleted: 0, modified: 0, moved: 0 };

  // Collapse consecutive ops into hunks
  let i = 0;
  while (i < rawOps.length) {
    const op = rawOps[i];

    if (op.op === 'equal') {
      hunks.push({
        type:    'equal',
        line_a:  op.indexA + 1,
        line_b:  op.indexB + 1,
        lines_a: [linesA[op.indexA]],
        lines_b: [linesB[op.indexB]],
      });
      counts.equal++;
      i++;
      continue;
    }

    // Peek ahead: pair consecutive delete+insert as 'modified'
    if (op.op === 'delete' && i + 1 < rawOps.length && rawOps[i + 1].op === 'insert') {
      const del = op;
      const ins = rawOps[i + 1];
      const la  = linesA[del.indexA];
      const lb  = linesB[ins.indexB];
      const wops = options.wordLevel ? wordDiff(la, lb) : [];
      hunks.push({
        type:      'modified',
        line_a:    del.indexA + 1,
        line_b:    ins.indexB + 1,
        lines_a:   [la],
        lines_b:   [lb],
        word_diff: wops,
      });
      counts.modified++;
      i += 2;
      continue;
    }

    if (op.op === 'delete') {
      hunks.push({
        type:    'deleted',
        line_a:  op.indexA + 1,
        line_b:  null,
        lines_a: [linesA[op.indexA]],
        lines_b: [],
      });
      counts.deleted++;
      i++;
      continue;
    }

    if (op.op === 'insert') {
      hunks.push({
        type:    'added',
        line_a:  null,
        line_b:  op.indexB + 1,
        lines_a: [],
        lines_b: [linesB[op.indexB]],
      });
      counts.added++;
      i++;
      continue;
    }

    i++;
  }

  // Moved-line detection
  if (options.detectMoved) {
    detectMoved(hunks, options.movedThreshold);
    counts.moved = hunks.filter(h => h.type === 'moved').length;
  }

  const elapsed = performance.now() - t0;

  return {
    stats: {
      lines_a:    linesA.length,
      lines_b:    linesB.length,
      added:      counts.added,
      deleted:    counts.deleted,
      modified:   counts.modified,
      moved:      counts.moved,
      equal:      counts.equal,
      elapsed_ms: parseFloat(elapsed.toFixed(2)),
    },
    hunks,
  };
}
