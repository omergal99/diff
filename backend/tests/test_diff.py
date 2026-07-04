"""
Tests for the two-phase diff engine.
Run with: pytest backend/tests/test_diff.py -v
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.diff import compute_diff
from utils.models import DiffOptions


def diff(a: str, b: str, **kwargs) -> dict:
    opts = DiffOptions(**kwargs)
    result = compute_diff(a, b, opts=opts)
    return result


# ─── Basic cases ─────────────────────────────────────────────────────────────

def test_identical_strings():
    r = diff("hello\nworld", "hello\nworld")
    assert r.identical is False  # hashes not provided, so no early exit
    assert r.stats.added == 0
    assert r.stats.deleted == 0
    assert all(h.type == "equal" for h in r.hunks)


def test_identical_with_hashes():
    from utils.stream import sha256_stream
    text = "hello\nworld"
    h = sha256_stream(text.encode())
    r = compute_diff(text, text, hash_a=h, hash_b=h)
    assert r.identical is True
    assert r.stats.added == 0


def test_single_line_added():
    r = diff("a\nb", "a\nb\nc")
    assert r.stats.added == 1
    added = [h for h in r.hunks if h.type == "added"]
    assert len(added) == 1
    assert added[0].lines_b == ["c"]


def test_single_line_deleted():
    r = diff("a\nb\nc", "a\nb")
    assert r.stats.deleted == 1
    deleted = [h for h in r.hunks if h.type == "deleted"]
    assert len(deleted) == 1
    assert deleted[0].lines_a == ["c"]


def test_modified_line():
    r = diff("hello world", "hello earth")
    modified = [h for h in r.hunks if h.type == "modified"]
    assert len(modified) == 1
    assert modified[0].lines_a == ["hello world"]
    assert modified[0].lines_b == ["hello earth"]


def test_word_diff_on_modified():
    r = diff("the quick brown fox", "the quick red fox", word_level=True)
    modified = [h for h in r.hunks if h.type == "modified"]
    assert modified, "Expected at least one modified hunk"
    # Should have word ops
    assert modified[0].word_diff


# ─── Ignore options ───────────────────────────────────────────────────────────

def test_ignore_whitespace():
    r = diff("hello  world", "hello world", ignore_whitespace=True)
    assert r.stats.modified == 0

def test_ignore_case():
    r = diff("Hello World", "hello world", ignore_case=True)
    assert r.stats.modified == 0

def test_ignore_comments():
    r = diff("// this comment\ncode()", "// different comment\ncode()", ignore_comments=True)
    # Both comment lines normalise to "" so should be equal
    modified = [h for h in r.hunks if h.type == "modified"]
    assert len(modified) == 0


# ─── Moved lines ─────────────────────────────────────────────────────────────

def test_moved_line_detection():
    a = "line one\nline two\nline three"
    b = "line three\nline one\nline two"
    r = diff(a, b, detect_moved=True, moved_threshold=0.8)
    moved = [h for h in r.hunks if h.type == "moved"]
    assert len(moved) > 0, "Expected moved lines to be detected"


def test_duplicate_lines_not_over_matched():
    """
    If A has one "111" and B has two "111" lines,
    only one B line should be matched as MOVED; the other should be ADDED.
    """
    a = "111\nfoo"
    b = "foo\n111\n111"
    r = diff(a, b, detect_moved=True, moved_threshold=0.95)
    moved = [h for h in r.hunks if h.type == "moved"]
    added = [h for h in r.hunks if h.type == "added"]
    # At most one "111" should be marked moved
    moved_111 = [m for m in moved if "111" in (m.lines_a or m.lines_b or [""])[0]]
    assert len(moved_111) <= 1


# ─── Stats ───────────────────────────────────────────────────────────────────

def test_stats_fields_present():
    r = diff("a\nb", "a\nc")
    assert hasattr(r.stats, 'lines_a')
    assert hasattr(r.stats, 'lines_b')
    assert hasattr(r.stats, 'elapsed_ms')
    assert r.stats.elapsed_ms >= 0


def test_empty_inputs():
    r = diff("", "")
    assert r.stats.lines_a == 1  # split("") = [""]
    assert r.stats.added == 0
    assert r.stats.deleted == 0


def test_one_empty():
    r = diff("", "hello\nworld")
    assert r.stats.added == 2
