/**
 * Client-side JSON structural diff.
 * Flattens both JSON objects to dot-notation paths and compares.
 */

/**
 * Flatten a JSON object/array to dot-notation paths.
 * @param {any} obj
 * @param {string} [prefix='']
 * @param {Map} [result]
 * @returns {Map<string, any>}
 */
function flatten(obj, prefix = '', result = new Map()) {
  if (obj !== null && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, result));
    } else {
      for (const [k, v] of Object.entries(obj)) {
        flatten(v, prefix ? `${prefix}.${k}` : k, result);
      }
    }
  } else {
    result.set(prefix, obj);
  }
  return result;
}

/**
 * Compute a structural JSON diff.
 * @param {string} textA - raw JSON string
 * @param {string} textB - raw JSON string
 * @param {{ schemaOnly?: boolean }} [opts]
 * @returns {{ changes: object[], identical: boolean, error?: string }}
 */
export function computeJsonDiff(textA, textB, opts = {}) {
  let objA, objB;
  try { objA = JSON.parse(textA); } catch (e) { return { changes: [], identical: false, error: `File A: ${e.message}` }; }
  try { objB = JSON.parse(textB); } catch (e) { return { changes: [], identical: false, error: `File B: ${e.message}` }; }

  const flatA = flatten(objA);
  const flatB = flatten(objB);
  const changes = [];

  // Keys in both
  for (const [key, va] of flatA) {
    if (flatB.has(key)) {
      const vb = flatB.get(key);
      if (!Object.is(va, vb)) {
        changes.push({ path: key, type: 'changed', value_a: va, value_b: vb });
      }
    } else {
      changes.push({ path: key, type: 'deleted', value_a: va, value_b: undefined });
    }
  }

  // Keys only in B
  for (const [key, vb] of flatB) {
    if (!flatA.has(key)) {
      changes.push({ path: key, type: 'added', value_a: undefined, value_b: vb });
    }
  }

  // Sort for consistent order
  changes.sort((a, b) => a.path.localeCompare(b.path));

  return { changes, identical: changes.length === 0 };
}
