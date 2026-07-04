/**
 * Diff Web Worker
 * Receives: { textA, textB, options }
 * Posts back: { type: 'result', data: DiffResult } | { type: 'error', message }
 *
 * Runs entirely off the main thread so the UI never freezes.
 */

// Import the diff engine. Workers use importScripts for classic scripts,
// but since we use type="module" workers we can use ES imports.
import { computeDiff } from '../core/diff-engine.js';

self.onmessage = (event) => {
  const { textA, textB, options, id } = event.data;

  try {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const result = computeDiff(linesA, linesB, options);
    self.postMessage({ type: 'result', id, data: result });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: err.message });
  }
};
