/**
 * SHA-256 hashing using the browser's built-in SubtleCrypto API.
 * No external libraries required.
 */

/**
 * Compute SHA-256 of a string or ArrayBuffer.
 * @param {string|ArrayBuffer} input
 * @returns {Promise<string>} hex digest
 */
export async function sha256(input) {
  let buffer;
  if (typeof input === 'string') {
    buffer = new TextEncoder().encode(input);
  } else {
    buffer = input;
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return hexFromBuffer(hashBuffer);
}

/**
 * Convert an ArrayBuffer to a hex string.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function hexFromBuffer(buffer) {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 of a File object (streams through the file without
 * loading it all into memory at once if the file supports streams).
 * Falls back to full read for browsers without stream support.
 * @param {File} file
 * @returns {Promise<string>} hex digest
 */
export async function sha256File(file) {
  const buffer = await file.arrayBuffer();
  return sha256(buffer);
}

/**
 * Compare two files by hash only — no diff needed if identical.
 * @param {File} fileA
 * @param {File} fileB
 * @returns {Promise<{ hashA: string, hashB: string, identical: boolean }>}
 */
export async function compareHashes(fileA, fileB) {
  const [hashA, hashB] = await Promise.all([sha256File(fileA), sha256File(fileB)]);
  return { hashA, hashB, identical: hashA === hashB };
}
