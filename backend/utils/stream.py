"""
Streaming utilities for large file processing.
Never loads entire files into memory at once.
"""

from __future__ import annotations
import hashlib
import io
from typing import Generator, AsyncGenerator


CHUNK_SIZE = 64 * 1024  # 64 KB


def sha256_stream(data: bytes) -> str:
    """Compute SHA-256 of bytes data (already in memory)."""
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: str) -> str:
    """Compute SHA-256 of a file by streaming it in 64 KB chunks."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(CHUNK_SIZE):
            h.update(chunk)
    return h.hexdigest()


def read_text_lines(data: bytes, encoding: str = "utf-8") -> list[str]:
    """
    Decode bytes to text, detect encoding fallback, return list of lines.
    Strips trailing newlines but preserves empty lines.
    """
    # Try preferred encoding first, fall back to latin-1 (never fails)
    for enc in (encoding, "utf-8-sig", "latin-1"):
        try:
            text = data.decode(enc)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    return text.splitlines()


def iter_lines(data: bytes) -> Generator[str, None, None]:
    """Yield lines from bytes without loading all into a list at once."""
    buf = io.BytesIO(data)
    for raw_line in buf:
        yield raw_line.decode("utf-8", errors="replace").rstrip("\r\n")


def chunk_list(lst: list, size: int) -> Generator[list, None, None]:
    """Yield successive chunks of a list."""
    for i in range(0, len(lst), size):
        yield lst[i : i + size]
