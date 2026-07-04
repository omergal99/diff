"""
Two-phase diff engine.

Phase 1: Line-level diff using Python's difflib (Myers algorithm, C-speed).
Phase 2: Word-level diff inside modified line pairs.

Kept intentionally small and focused. All side-effects live in callers.
"""

from __future__ import annotations
import difflib
import re
import time
from utils.models import DiffHunk, DiffStats, DiffResult, DiffOptions, WordOp
from utils.stream import sha256_stream, read_text_lines
from utils.logger import get_logger
from core.moved import detect_moved_lines

log = get_logger("diff")

# Regex that splits on word boundaries, punctuation, and whitespace
_WORD_RE = re.compile(r"(\s+|[^\w\s]+|\w+)")


def _tokenize(line: str) -> list[str]:
    """Split a line into word tokens for word-level diff."""
    return [t for t in _WORD_RE.findall(line) if t]


def _word_diff(line_a: str, line_b: str) -> list[WordOp]:
    """Compute word-level operations between two changed lines."""
    tokens_a = _tokenize(line_a)
    tokens_b = _tokenize(line_b)
    matcher = difflib.SequenceMatcher(None, tokens_a, tokens_b, autojunk=False)
    ops: list[WordOp] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            ops.append(WordOp(op="equal", text="".join(tokens_a[i1:i2])))
        elif tag == "insert":
            ops.append(WordOp(op="insert", text="".join(tokens_b[j1:j2])))
        elif tag == "delete":
            ops.append(WordOp(op="delete", text="".join(tokens_a[i1:i2])))
        elif tag == "replace":
            ops.append(WordOp(op="delete", text="".join(tokens_a[i1:i2])))
            ops.append(WordOp(op="insert", text="".join(tokens_b[j1:j2])))
    return ops


def _normalize(line: str, opts: DiffOptions) -> str:
    """Apply ignore filters to a line before comparison."""
    if opts.ignore_case:
        line = line.lower()
    if opts.ignore_whitespace:
        line = " ".join(line.split())
    if opts.ignore_comments:
        # Strip // ... and # ... style comment lines
        stripped = line.lstrip()
        if stripped.startswith("//") or stripped.startswith("#"):
            return ""
    return line


def compute_diff(
    text_a: str,
    text_b: str,
    opts: DiffOptions | None = None,
    hash_a: str | None = None,
    hash_b: str | None = None,
) -> DiffResult:
    """
    Main entry point. Accepts raw text strings.
    Returns a structured DiffResult with hunks and stats.
    """
    opts = opts or DiffOptions()
    t_start = time.perf_counter()

    lines_a = read_text_lines(text_a.encode()) if isinstance(text_a, str) else text_a
    lines_b = read_text_lines(text_b.encode()) if isinstance(text_b, str) else text_b

    # SHA-256 early exit: if we already know hashes match, return immediately
    if hash_a and hash_b and hash_a == hash_b:
        elapsed = (time.perf_counter() - t_start) * 1000
        stats = DiffStats(
            lines_a=len(lines_a), lines_b=len(lines_b),
            added=0, deleted=0, modified=0, moved=0,
            equal=len(lines_a), elapsed_ms=round(elapsed, 2),
        )
        return DiffResult(stats=stats, hunks=[], hash_a=hash_a, hash_b=hash_b, identical=True)

    # Apply normalization for comparison keys (display still uses original lines)
    norm_a = [_normalize(l, opts) for l in lines_a]
    norm_b = [_normalize(l, opts) for l in lines_b]

    matcher = difflib.SequenceMatcher(None, norm_a, norm_b, autojunk=False)
    opcodes = matcher.get_opcodes()

    raw_hunks: list[DiffHunk] = []
    added_lines: list[tuple[int, str]] = []    # (line_b_idx, text) for moved detection
    deleted_lines: list[tuple[int, str]] = []  # (line_a_idx, text) for moved detection

    for tag, i1, i2, j1, j2 in opcodes:
        if tag == "equal":
            for k in range(i2 - i1):
                raw_hunks.append(DiffHunk(
                    type="equal",
                    line_a=i1 + k + 1,
                    line_b=j1 + k + 1,
                    lines_a=[lines_a[i1 + k]],
                    lines_b=[lines_b[j1 + k]],
                ))
        elif tag == "insert":
            for k in range(j2 - j1):
                raw_hunks.append(DiffHunk(
                    type="added",
                    line_a=None,
                    line_b=j1 + k + 1,
                    lines_b=[lines_b[j1 + k]],
                ))
                added_lines.append((j1 + k, lines_b[j1 + k]))
        elif tag == "delete":
            for k in range(i2 - i1):
                raw_hunks.append(DiffHunk(
                    type="deleted",
                    line_a=i1 + k + 1,
                    line_b=None,
                    lines_a=[lines_a[i1 + k]],
                ))
                deleted_lines.append((i1 + k, lines_a[i1 + k]))
        elif tag == "replace":
            # Pair up lines as modified where possible
            len_del = i2 - i1
            len_add = j2 - j1
            pairs = min(len_del, len_add)
            for k in range(pairs):
                la = lines_a[i1 + k]
                lb = lines_b[j1 + k]
                word_ops = _word_diff(la, lb) if opts.word_level else []
                raw_hunks.append(DiffHunk(
                    type="modified",
                    line_a=i1 + k + 1,
                    line_b=j1 + k + 1,
                    lines_a=[la],
                    lines_b=[lb],
                    word_diff=word_ops,
                ))
            # Any remaining lines are pure adds or deletes
            for k in range(pairs, len_del):
                raw_hunks.append(DiffHunk(
                    type="deleted",
                    line_a=i1 + k + 1,
                    line_b=None,
                    lines_a=[lines_a[i1 + k]],
                ))
                deleted_lines.append((i1 + k, lines_a[i1 + k]))
            for k in range(pairs, len_add):
                raw_hunks.append(DiffHunk(
                    type="added",
                    line_a=None,
                    line_b=j1 + k + 1,
                    lines_b=[lines_b[j1 + k]],
                ))
                added_lines.append((j1 + k, lines_b[j1 + k]))

    # Moved-line detection (promotes deleted+added pairs to moved)
    if opts.detect_moved and deleted_lines and added_lines:
        raw_hunks = detect_moved_lines(
            raw_hunks, deleted_lines, added_lines, opts.moved_threshold
        )

    # Build stats
    counts = {"equal": 0, "added": 0, "deleted": 0, "modified": 0, "moved": 0}
    for h in raw_hunks:
        counts[h.type] = counts.get(h.type, 0) + 1

    elapsed = (time.perf_counter() - t_start) * 1000
    stats = DiffStats(
        lines_a=len(lines_a),
        lines_b=len(lines_b),
        added=counts["added"],
        deleted=counts["deleted"],
        modified=counts["modified"],
        moved=counts["moved"],
        equal=counts["equal"],
        elapsed_ms=round(elapsed, 2),
    )

    log.debug(f"Diff: {len(lines_a)}→{len(lines_b)} lines | "
              f"+{counts['added']} -{counts['deleted']} ~{counts['modified']} ↕{counts['moved']} "
              f"in {elapsed:.1f}ms")

    return DiffResult(
        stats=stats,
        hunks=raw_hunks,
        hash_a=hash_a,
        hash_b=hash_b,
        identical=False,
    )
