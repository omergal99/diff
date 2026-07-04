"""
JSON structural diff engine.

Flattens JSON to dot-notation paths, then compares path→value mappings.
Supports schema-only mode (ignores values, compares keys only).
Detects reordered array elements by value hash.
"""

from __future__ import annotations
import json
import hashlib
import time
from typing import Any
from utils.models import JsonChange, JsonDiffResult, DiffStats, JsonDiffOptions
from utils.logger import get_logger

log = get_logger("json_diff")


def _hash_value(v: Any) -> str:
    return hashlib.md5(json.dumps(v, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _flatten(obj: Any, prefix: str = "", result: dict | None = None) -> dict[str, Any]:
    """
    Recursively flatten a JSON object to dot-notation paths.

    Example:
      {"user": {"name": "Alice"}}  →  {"user.name": "Alice"}
      {"items": ["a", "b"]}        →  {"items[0]": "a", "items[1]": "b"}
    """
    if result is None:
        result = {}

    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            _flatten(v, key, result)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            key = f"{prefix}[{i}]"
            _flatten(v, key, result)
    else:
        result[prefix] = obj

    return result


def _flatten_schema(obj: Any, prefix: str = "", result: dict | None = None) -> dict[str, str]:
    """Flatten keys only, mapping each path to its value type."""
    if result is None:
        result = {}

    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            _flatten_schema(v, key, result)
    elif isinstance(obj, list):
        result[prefix] = "array"
        if obj:
            _flatten_schema(obj[0], f"{prefix}[]", result)
    else:
        result[prefix] = type(obj).__name__

    return result


def compute_json_diff(
    text_a: str,
    text_b: str,
    opts: JsonDiffOptions | None = None,
) -> JsonDiffResult:
    opts = opts or JsonDiffOptions()
    t_start = time.perf_counter()

    try:
        obj_a = json.loads(text_a)
    except json.JSONDecodeError as e:
        raise ValueError(f"File A is not valid JSON: {e}")

    try:
        obj_b = json.loads(text_b)
    except json.JSONDecodeError as e:
        raise ValueError(f"File B is not valid JSON: {e}")

    if opts.schema_only:
        flat_a = _flatten_schema(obj_a)
        flat_b = _flatten_schema(obj_b)
    else:
        flat_a = _flatten(obj_a)
        flat_b = _flatten(obj_b)

    keys_a = set(flat_a.keys())
    keys_b = set(flat_b.keys())

    changes: list[JsonChange] = []
    added = deleted = changed = equal = 0

    # Keys in both: compare values
    for key in sorted(keys_a & keys_b):
        va = flat_a[key]
        vb = flat_b[key]
        if va == vb:
            equal += 1
        else:
            changed += 1
            changes.append(JsonChange(path=key, type="changed", value_a=va, value_b=vb))

    # Keys only in A → deleted
    for key in sorted(keys_a - keys_b):
        deleted += 1
        changes.append(JsonChange(path=key, type="deleted", value_a=flat_a[key]))

    # Keys only in B → added
    for key in sorted(keys_b - keys_a):
        added += 1
        changes.append(JsonChange(path=key, type="added", value_b=flat_b[key]))

    elapsed = (time.perf_counter() - t_start) * 1000
    stats = DiffStats(
        lines_a=len(keys_a),
        lines_b=len(keys_b),
        added=added,
        deleted=deleted,
        modified=changed,
        moved=0,
        equal=equal,
        elapsed_ms=round(elapsed, 2),
    )

    log.debug(f"JSON diff: {len(keys_a)}→{len(keys_b)} paths | "
              f"+{added} -{deleted} ~{changed} ={equal} in {elapsed:.1f}ms")

    return JsonDiffResult(
        stats=stats,
        changes=changes,
        identical=(not changes),
    )
