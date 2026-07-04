"""
Tests for steganography LSB analysis.
Requires Pillow to be installed.
"""

import sys, os, io
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

pytestmark = pytest.mark.skipif(not PIL_AVAILABLE, reason="Pillow not installed")


def make_png(width=32, height=32, color=(100, 150, 200)) -> bytes:
    """Create a simple solid-colour PNG in memory."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def make_stego_png(width=32, height=32) -> bytes:
    """Create a PNG with highly random LSBs (simulates hidden data)."""
    import random
    img = Image.new("RGB", (width, height))
    pixels = []
    for _ in range(width * height):
        # Use random LSBs to simulate hidden data
        r = (random.randint(0, 127) * 2) | random.randint(0, 1)
        g = (random.randint(0, 127) * 2) | random.randint(0, 1)
        b = (random.randint(0, 127) * 2) | random.randint(0, 1)
        pixels.append((r, g, b))
    img.putdata(pixels)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


from core.stego import analyze_image, compare_images


def test_analyze_normal_image():
    png = make_png()
    result = analyze_image(png)
    assert "entropy" in result
    assert "is_suspicious" in result
    assert result["pixel_count"] == 32 * 32
    assert isinstance(result["entropy"], float)


def test_identical_images():
    png = make_png()
    result = compare_images(png, png)
    assert result["identical"] is True
    assert result["pixel_diff_count"] == 0


def test_different_images():
    a = make_png(color=(100, 100, 100))
    b = make_png(color=(200, 200, 200))
    result = compare_images(a, b)
    assert result["identical"] is False
    assert result["pixel_diff_count"] > 0
    assert result["diff_percentage"] > 0


def test_different_dimensions():
    a = make_png(width=32, height=32)
    b = make_png(width=64, height=64)
    result = compare_images(a, b)
    assert result["identical"] is False
    assert result["pixel_diff_count"] == -1
    assert "error" in result


def test_stego_analysis_returns_result():
    png = make_stego_png()
    result = analyze_image(png)
    # High-entropy pixel data should be flagged
    # (may or may not be suspicious depending on randomness, just test structure)
    assert "entropy" in result
    assert "is_suspicious" in result
    assert "elapsed_ms" in result
