"""
Pydantic response models for all API endpoints.
Centralised here so routes stay thin.
"""

from __future__ import annotations
from typing import Any, Literal
from pydantic import BaseModel


# ─── Diff Models ─────────────────────────────────────────────────────────────

class DiffOptions(BaseModel):
    algorithm: Literal["myers", "patience"] = "patience"
    ignore_whitespace: bool = False
    ignore_case: bool = False
    ignore_comments: bool = False
    word_level: bool = True
    detect_moved: bool = True
    moved_threshold: float = 0.80


class WordOp(BaseModel):
    op: Literal["equal", "insert", "delete", "replace"]
    text: str


class DiffHunk(BaseModel):
    type: Literal["equal", "added", "deleted", "modified", "moved"]
    line_a: int | None = None
    line_b: int | None = None
    lines_a: list[str] = []
    lines_b: list[str] = []
    word_diff: list[WordOp] = []
    moved_from: int | None = None  # original line number for moved lines
    moved_to: int | None = None


class DiffStats(BaseModel):
    lines_a: int
    lines_b: int
    added: int
    deleted: int
    modified: int
    moved: int
    equal: int
    elapsed_ms: float


class DiffResult(BaseModel):
    stats: DiffStats
    hunks: list[DiffHunk]
    hash_a: str | None = None
    hash_b: str | None = None
    identical: bool = False


# ─── JSON Diff Models ─────────────────────────────────────────────────────────

class JsonDiffOptions(BaseModel):
    schema_only: bool = False
    ignore_array_order: bool = False


class JsonChange(BaseModel):
    path: str
    type: Literal["changed", "added", "deleted", "reordered"]
    value_a: Any = None
    value_b: Any = None


class JsonDiffResult(BaseModel):
    stats: DiffStats
    changes: list[JsonChange]
    identical: bool = False


# ─── Image Diff Models ────────────────────────────────────────────────────────

class BoundingBox(BaseModel):
    x: int
    y: int
    w: int
    h: int


class StegoResult(BaseModel):
    analyzed: bool
    entropy: float | None = None
    is_suspicious: bool = False
    lsb_preview: str | None = None  # first 64 chars of decoded LSB stream


class ImageDiffResult(BaseModel):
    dimensions_a: tuple[int, int]
    dimensions_b: tuple[int, int]
    identical: bool
    pixel_diff_count: int
    diff_percentage: float
    changed_regions: list[BoundingBox]
    stego: StegoResult | None = None
    elapsed_ms: float


# ─── Archive Models ───────────────────────────────────────────────────────────

class ArchiveEntry(BaseModel):
    path: str
    status: Literal["equal", "modified", "added", "deleted"]
    hash_a: str | None = None
    hash_b: str | None = None
    size_a: int | None = None
    size_b: int | None = None


class ArchiveSummary(BaseModel):
    equal: int
    modified: int
    added: int
    deleted: int
    elapsed_ms: float


# ─── Unicode Models ───────────────────────────────────────────────────────────

class HomographFinding(BaseModel):
    char: str
    position: int
    codepoint: str
    script: str
    looks_like: str
    context: str


class UnicodeCheckResult(BaseModel):
    has_suspicious: bool
    findings: list[HomographFinding]
    non_ascii_count: int
    punycode: str | None = None


# ─── Office Models ────────────────────────────────────────────────────────────

class OfficeDiffResult(DiffResult):
    extracted_a: str
    extracted_b: str
    file_type: str


# ─── Health ──────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
