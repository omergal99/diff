"""
Tests for JSON structural diff engine.
"""

import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.json_diff import compute_json_diff
from utils.models import JsonDiffOptions


def jdiff(a: dict, b: dict, **kwargs) -> object:
    opts = JsonDiffOptions(**kwargs)
    return compute_json_diff(json.dumps(a), json.dumps(b), opts=opts)


def test_identical():
    r = jdiff({"a": 1}, {"a": 1})
    assert r.identical is True
    assert len(r.changes) == 0


def test_value_changed():
    r = jdiff({"city": "Tel Aviv"}, {"city": "Haifa"})
    assert not r.identical
    changed = [c for c in r.changes if c.type == "changed"]
    assert len(changed) == 1
    assert changed[0].path == "city"
    assert changed[0].value_a == "Tel Aviv"
    assert changed[0].value_b == "Haifa"


def test_key_added():
    r = jdiff({"a": 1}, {"a": 1, "b": 2})
    added = [c for c in r.changes if c.type == "added"]
    assert len(added) == 1
    assert added[0].path == "b"


def test_key_deleted():
    r = jdiff({"a": 1, "b": 2}, {"a": 1})
    deleted = [c for c in r.changes if c.type == "deleted"]
    assert len(deleted) == 1
    assert deleted[0].path == "b"


def test_nested():
    a = {"user": {"name": "Alice", "age": 30}}
    b = {"user": {"name": "Alice", "age": 31}}
    r = jdiff(a, b)
    changed = [c for c in r.changes if c.type == "changed"]
    assert len(changed) == 1
    assert changed[0].path == "user.age"


def test_array_indexing():
    a = {"items": ["x", "y"]}
    b = {"items": ["x", "z"]}
    r = jdiff(a, b)
    changed = [c for c in r.changes if c.type == "changed"]
    assert any("items" in c.path for c in changed)


def test_invalid_json_a():
    import pytest
    from core.json_diff import compute_json_diff
    with pytest.raises(ValueError, match="File A"):
        compute_json_diff("{invalid}", '{"a": 1}')


def test_invalid_json_b():
    import pytest
    from core.json_diff import compute_json_diff
    with pytest.raises(ValueError, match="File B"):
        compute_json_diff('{"a": 1}', "{invalid}")


def test_schema_only():
    a = {"user": {"name": "Alice",   "age": 30}}
    b = {"user": {"name": "Bob",     "age": 99}}
    r = jdiff(a, b, schema_only=True)
    # In schema-only mode, values are replaced with type names → both are "str"/"int" → equal
    assert r.identical is True
