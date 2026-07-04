"""
Archive streaming comparison (ZIP / TAR / TGZ).

Opens archives as streams — never extracts to disk.
Builds a manifest {path → {size, hash}} for each archive,
then compares manifests and yields results file-by-file.

Uses Python stdlib only: tarfile, zipfile, hashlib, io.
"""

from __future__ import annotations
import hashlib
import io
import tarfile
import zipfile
import time
from typing import Generator, Literal
from utils.logger import get_logger

log = get_logger("archive")


ArchiveStatus = Literal["equal", "modified", "added", "deleted"]


class ArchiveEntry:
    __slots__ = ("path", "size", "hash")

    def __init__(self, path: str, size: int, hash_: str):
        self.path = path
        self.size = size
        self.hash = hash_


def _hash_data(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _read_tar_manifest(data: bytes) -> dict[str, ArchiveEntry]:
    """Build manifest from TAR/TGZ bytes (streaming, no disk I/O)."""
    manifest: dict[str, ArchiveEntry] = {}
    stream = io.BytesIO(data)
    try:
        with tarfile.open(fileobj=stream, mode="r:*") as tf:
            for member in tf.getmembers():
                if not member.isfile():
                    continue
                f = tf.extractfile(member)
                if f is None:
                    continue
                content = f.read()
                manifest[member.name] = ArchiveEntry(
                    path=member.name,
                    size=member.size,
                    hash_=_hash_data(content),
                )
                del content  # release immediately
    except tarfile.TarError as e:
        raise ValueError(f"Cannot read TAR archive: {e}")
    return manifest


def _read_zip_manifest(data: bytes) -> dict[str, ArchiveEntry]:
    """Build manifest from ZIP bytes (streaming, no disk I/O)."""
    manifest: dict[str, ArchiveEntry] = {}
    stream = io.BytesIO(data)
    try:
        with zipfile.ZipFile(stream, "r") as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                content = zf.read(info.filename)
                manifest[info.filename] = ArchiveEntry(
                    path=info.filename,
                    size=info.file_size,
                    hash_=_hash_data(content),
                )
                del content
    except zipfile.BadZipFile as e:
        raise ValueError(f"Cannot read ZIP archive: {e}")
    return manifest


def _detect_format(data: bytes) -> Literal["tar", "zip", "unknown"]:
    """Detect archive format from magic bytes."""
    if data[:2] == b"PK":
        return "zip"
    if data[:2] in (b"\x1f\x8b", b"BZ") or data[:5] == b"ustar":
        return "tar"
    # Try TAR magic at offset 257
    if len(data) > 262 and data[257:262] == b"ustar":
        return "tar"
    return "unknown"


def build_manifest(data: bytes) -> dict[str, ArchiveEntry]:
    """Auto-detect format and build manifest."""
    fmt = _detect_format(data)
    if fmt == "zip":
        return _read_zip_manifest(data)
    elif fmt == "tar":
        return _read_tar_manifest(data)
    else:
        raise ValueError("Unsupported archive format. Use ZIP, TAR, or TGZ.")


def compare_archives(
    data_a: bytes,
    data_b: bytes,
) -> Generator[dict, None, None]:
    """
    Compare two archives and yield result dicts for each file.

    Yields:
      {"type": "start", "total_a": N, "total_b": M}
      {"type": "file", "path": "...", "status": "equal|modified|added|deleted", ...}
      {"type": "done", "summary": {...}, "elapsed_ms": N}
    """
    t_start = time.perf_counter()

    log.debug("Building manifest A...")
    manifest_a = build_manifest(data_a)
    log.debug("Building manifest B...")
    manifest_b = build_manifest(data_b)

    all_paths = sorted(set(manifest_a.keys()) | set(manifest_b.keys()))

    yield {"type": "start", "total_a": len(manifest_a), "total_b": len(manifest_b)}

    summary = {"equal": 0, "modified": 0, "added": 0, "deleted": 0}

    for path in all_paths:
        entry_a = manifest_a.get(path)
        entry_b = manifest_b.get(path)

        if entry_a and entry_b:
            if entry_a.hash == entry_b.hash:
                status: ArchiveStatus = "equal"
            else:
                status = "modified"
        elif entry_a:
            status = "deleted"
        else:
            status = "added"

        summary[status] += 1

        result = {
            "type": "file",
            "path": path,
            "status": status,
        }
        if entry_a:
            result["hash_a"] = entry_a.hash
            result["size_a"] = entry_a.size
        if entry_b:
            result["hash_b"] = entry_b.hash
            result["size_b"] = entry_b.size

        yield result

    elapsed = (time.perf_counter() - t_start) * 1000
    yield {"type": "done", "summary": summary, "elapsed_ms": round(elapsed, 2)}
    log.debug(f"Archive compare done: {summary} in {elapsed:.1f}ms")
