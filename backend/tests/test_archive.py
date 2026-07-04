"""
Tests for archive streaming comparison.
"""

import sys, os, io, zipfile, tarfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.archive import build_manifest, compare_archives


def make_zip(files: dict[str, bytes]) -> bytes:
    """Create an in-memory ZIP archive."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


def make_tar(files: dict[str, bytes]) -> bytes:
    """Create an in-memory TAR archive."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz') as tf:
        for name, data in files.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            tf.addfile(info, io.BytesIO(data))
    return buf.getvalue()


# ─── Manifest tests ───────────────────────────────────────────────────────────

def test_zip_manifest():
    data = make_zip({"a.txt": b"hello", "b.txt": b"world"})
    manifest = build_manifest(data)
    assert "a.txt" in manifest
    assert "b.txt" in manifest
    assert manifest["a.txt"].size == 5


def test_tar_manifest():
    data = make_tar({"x.py": b"print('hi')", "y.py": b"pass"})
    manifest = build_manifest(data)
    assert "x.py" in manifest
    assert "y.py" in manifest


# ─── Compare tests ────────────────────────────────────────────────────────────

def collect(gen):
    """Collect all events from the generator."""
    return list(gen)


def test_identical_archives():
    files = {"a.txt": b"same content", "b.txt": b"also same"}
    z_a = make_zip(files)
    z_b = make_zip(files)
    events = collect(compare_archives(z_a, z_b))
    file_events = [e for e in events if e["type"] == "file"]
    assert all(e["status"] == "equal" for e in file_events)


def test_modified_file():
    z_a = make_zip({"readme.txt": b"version 1"})
    z_b = make_zip({"readme.txt": b"version 2"})
    events = collect(compare_archives(z_a, z_b))
    file_events = [e for e in events if e["type"] == "file"]
    assert len(file_events) == 1
    assert file_events[0]["status"] == "modified"


def test_added_file():
    z_a = make_zip({"a.txt": b"hello"})
    z_b = make_zip({"a.txt": b"hello", "b.txt": b"new"})
    events = collect(compare_archives(z_a, z_b))
    file_events = [e for e in events if e["type"] == "file"]
    statuses = {e["path"]: e["status"] for e in file_events}
    assert statuses["a.txt"] == "equal"
    assert statuses["b.txt"] == "added"


def test_deleted_file():
    z_a = make_zip({"a.txt": b"hello", "old.txt": b"remove me"})
    z_b = make_zip({"a.txt": b"hello"})
    events = collect(compare_archives(z_a, z_b))
    file_events = [e for e in events if e["type"] == "file"]
    statuses = {e["path"]: e["status"] for e in file_events}
    assert statuses["old.txt"] == "deleted"


def test_done_event_present():
    z_a = make_zip({"a.txt": b"x"})
    z_b = make_zip({"a.txt": b"y"})
    events = collect(compare_archives(z_a, z_b))
    done = [e for e in events if e["type"] == "done"]
    assert len(done) == 1
    assert "elapsed_ms" in done[0]
    assert "summary" in done[0]
