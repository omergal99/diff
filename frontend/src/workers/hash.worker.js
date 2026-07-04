/**
 * Hash Web Worker
 * Receives: { buffer: ArrayBuffer, id: string }
 * Posts back: { type: 'result', id, hash: string }
 *
 * Runs SHA-256 via SubtleCrypto off the main thread.
 */

self.onmessage = async (event) => {
  const { buffer, id } = event.data;
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hash = [...new Uint8Array(hashBuffer)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    self.postMessage({ type: 'result', id, hash });
  } catch (err) {
    self.postMessage({ type: 'error', id, message: err.message });
  }
};
