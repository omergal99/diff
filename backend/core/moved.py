"""
Moved-line detection using Levenshtein similarity.

Promotes DELETED + ADDED hunk pairs into MOVED hunks when the line content
is sufficiently similar. Uses greedy 1-to-1 matching to avoid false duplicates.

Key invariant: each source line can only pair with one target line.
This correctly handles the "two '111' in B, one in A" case.
"""

from __future__ import annotations
import difflib
from utils.models import DiffHunk
from utils.logger import get_logger

log = get_logger("moved")


def _similarity(a: str, b: str) -> float:
    """
    Quick string similarity ratio using difflib (Ratcliff/Obershelp).
    Returns 0.0–1.0. Faster than full Levenshtein for our purposes.
    """
    return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()


def detect_moved_lines(
    hunks: list[DiffHunk],
    deleted_lines: list[tuple[int, str]],  # (line_a_idx, text)
    added_lines: list[tuple[int, str]],    # (line_b_idx, text)
    threshold: float = 0.80,
) -> list[DiffHunk]:
    """
    Scan deleted and added lines for high-similarity pairs → mark as MOVED.

    Steps:
    1. Compute similarity for every (deleted, added) candidate pair.
    2. Sort candidates by similarity descending.
    3. Greedy 1-to-1 matching: once a line is matched, remove it from pool.
    4. Annotate matching hunks in-place as type="moved".
    """
    if not deleted_lines or not added_lines:
        return hunks

    # Build candidate pairs above threshold
    candidates: list[tuple[float, int, int]] = []  # (sim, del_idx, add_idx)
    for d_idx, (d_line_num, d_text) in enumerate(deleted_lines):
        for a_idx, (a_line_num, a_text) in enumerate(added_lines):
            sim = _similarity(d_text.strip(), a_text.strip())
            if sim >= threshold:
                candidates.append((sim, d_idx, a_idx))

    candidates.sort(reverse=True)  # highest similarity first

    matched_del: set[int] = set()
    matched_add: set[int] = set()
    moves: list[tuple[int, int, int, int]] = []  # (d_line_num, a_line_num, d_idx, a_idx)

    for sim, d_idx, a_idx in candidates:
        if d_idx in matched_del or a_idx in matched_add:
            continue  # already matched
        matched_del.add(d_idx)
        matched_add.add(a_idx)
        moves.append((
            deleted_lines[d_idx][0],
            added_lines[a_idx][0],
            d_idx,
            a_idx,
        ))
        log.debug(f"Moved: line {deleted_lines[d_idx][0]+1}→{added_lines[a_idx][0]+1} "
                  f"(sim={sim:.2f})")

    if not moves:
        return hunks

    # Build lookup sets for fast hunk mutation
    deleted_line_nums = {deleted_lines[d_idx][0] for _, _, d_idx, _ in moves}
    added_line_nums = {added_lines[a_idx][0] for _, _, _, a_idx in moves}

    # Build a map: moved_from (a_line_num) → moved_to (b_line_num) and vice versa
    from_to: dict[int, int] = {}
    to_from: dict[int, int] = {}
    for d_lnum, a_lnum, _, _ in moves:
        from_to[d_lnum] = a_lnum
        to_from[a_lnum] = d_lnum

    # Mutate hunks in-place
    updated: list[DiffHunk] = []
    for h in hunks:
        if h.type == "deleted" and h.line_a is not None:
            zero_idx = h.line_a - 1  # convert to 0-based
            if zero_idx in deleted_line_nums:
                target_b = from_to[zero_idx] + 1  # back to 1-based
                h = h.model_copy(update={"type": "moved", "moved_from": h.line_a, "moved_to": target_b})
        elif h.type == "added" and h.line_b is not None:
            zero_idx = h.line_b - 1
            if zero_idx in added_line_nums:
                source_a = to_from[zero_idx] + 1
                h = h.model_copy(update={"type": "moved", "moved_from": source_a, "moved_to": h.line_b})
        updated.append(h)

    return updated
