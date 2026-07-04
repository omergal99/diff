/**
 * Unicode homograph and suspicious character detection (client-side).
 * Mirrors the Python backend module for instant in-browser checks.
 */

// Subset of Unicode confusables → their Latin lookalikes
const CONFUSABLES = new Map([
  // Cyrillic
  ['а','a'], ['е','e'], ['о','o'], ['р','p'], ['с','c'], ['х','x'],
  ['А','A'], ['В','B'], ['Е','E'], ['К','K'], ['М','M'], ['Н','H'],
  ['О','O'], ['Р','P'], ['С','C'], ['Т','T'], ['Х','X'], ['У','Y'],
  // Greek
  ['α','a'], ['β','b'], ['ε','e'], ['η','n'], ['ι','i'], ['κ','k'],
  ['ο','o'], ['ρ','p'], ['τ','t'], ['υ','u'], ['χ','x'], ['ω','w'],
  // Zero-width / invisible
  ['\u200b','[ZWSP]'], ['\u200c','[ZWNJ]'], ['\u200d','[ZWJ]'],
  ['\ufeff','[BOM]'],  ['\u00ad','[SHY]'],
]);

/**
 * Scan text for homograph characters.
 * @param {string} text
 * @returns {{ hasSuspicious: boolean, findings: object[], nonAsciiCount: number }}
 */
export function checkUnicode(text) {
  const findings = [];
  let nonAsciiCount = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch.charCodeAt(0) > 0x7f) nonAsciiCount++;

    if (CONFUSABLES.has(ch)) {
      const lookalike = CONFUSABLES.get(ch);
      const start = Math.max(0, i - 10);
      const end   = Math.min(text.length, i + 11);
      findings.push({
        char:      ch,
        position:  i,
        codepoint: `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
        looksLike: lookalike,
        context:   text.slice(start, end),
      });
    }
  }

  return { hasSuspicious: findings.length > 0, findings, nonAsciiCount };
}

/**
 * Strip non-ASCII characters using a configurable regex.
 * @param {string} text
 * @param {string} [pattern='[^\\x00-\\x7f]']
 * @returns {string}
 */
export function stripNonAscii(text, pattern = '[^\\x00-\\x7f]') {
  return text.replace(new RegExp(pattern, 'g'), '');
}

/**
 * Strip zero-width / invisible Unicode characters.
 * @param {string} text
 * @returns {string}
 */
export function stripZeroWidth(text) {
  return text.replace(/[\u200b\u200c\u200d\ufeff\u00ad]/g, '');
}
