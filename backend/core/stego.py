"""
Steganography detection via LSB (Least Significant Bit) analysis.

Extracts the LSB of R, G, B channels from every pixel,
reconstructs the bit stream, and measures Shannon entropy.

High entropy (≥ 7.5 bits/byte) indicates likely hidden data —
natural image noise has much lower LSB entropy.
"""

from __future__ import annotations
import io
import math
import time
from collections import Counter
from typing import TYPE_CHECKING

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from utils.logger import get_logger

log = get_logger("stego")

ENTROPY_THRESHOLD = 7.5   # bits/byte — above this → suspicious
DIFF_PIXEL_ALERT = 0.05   # 5% of pixels changed in LSBs → flag


def _check_pil() -> None:
    if not PIL_AVAILABLE:
        raise RuntimeError("Pillow is not installed. Run: pip install Pillow")


def _shannon_entropy(data: bytes) -> float:
    """Compute Shannon entropy of a byte sequence. Max = 8 bits/byte."""
    if not data:
        return 0.0
    counts = Counter(data)
    total = len(data)
    entropy = 0.0
    for count in counts.values():
        p = count / total
        if p > 0:
            entropy -= p * math.log2(p)
    return round(entropy, 4)


def _extract_lsb_bytes(img: "Image.Image") -> bytes:
    """
    Extract LSB of each R, G, B channel for every pixel.
    Returns a bytes object (one bit per channel → packed 8 bits = 1 byte).
    """
    rgb = img.convert("RGB")
    pixels = list(rgb.getdata())
    bits: list[int] = []
    for r, g, b in pixels:
        bits.append(r & 1)
        bits.append(g & 1)
        bits.append(b & 1)

    # Pack bits into bytes (MSB first)
    byte_list: list[int] = []
    for i in range(0, len(bits) - 7, 8):
        byte_val = 0
        for j in range(8):
            byte_val = (byte_val << 1) | bits[i + j]
        byte_list.append(byte_val)

    return bytes(byte_list)


def analyze_image(data: bytes) -> dict:
    """
    Analyze a single image for hidden LSB payload.

    Returns a dict with:
      - entropy: float (Shannon entropy of LSB stream)
      - is_suspicious: bool
      - lsb_preview: str (first 64 printable chars of decoded LSBs)
      - pixel_count: int
      - elapsed_ms: float
    """
    _check_pil()
    t_start = time.perf_counter()

    img = Image.open(io.BytesIO(data))
    width, height = img.size
    pixel_count = width * height

    lsb_bytes = _extract_lsb_bytes(img)
    entropy = _shannon_entropy(lsb_bytes)
    is_suspicious = entropy >= ENTROPY_THRESHOLD

    # Try to decode a human-readable preview
    try:
        preview = lsb_bytes[:128].decode("utf-8", errors="replace")
        preview = "".join(c if c.isprintable() else "·" for c in preview)[:64]
    except Exception:
        preview = ""

    elapsed = (time.perf_counter() - t_start) * 1000
    log.debug(f"Stego: {width}x{height} | entropy={entropy} | suspicious={is_suspicious} | {elapsed:.1f}ms")

    return {
        "pixel_count": pixel_count,
        "dimensions": (width, height),
        "entropy": entropy,
        "is_suspicious": is_suspicious,
        "lsb_preview": preview,
        "elapsed_ms": round(elapsed, 2),
    }


def compare_images(data_a: bytes, data_b: bytes, run_stego: bool = False) -> dict:
    """
    Pixel-level comparison of two images.

    Returns diff regions, changed pixel count, and optional stego analysis.
    """
    _check_pil()
    t_start = time.perf_counter()

    img_a = Image.open(io.BytesIO(data_a)).convert("RGB")
    img_b = Image.open(io.BytesIO(data_b)).convert("RGB")

    w_a, h_a = img_a.size
    w_b, h_b = img_b.size

    # If dimensions differ, we can't do pixel diff — just report
    if (w_a, h_a) != (w_b, h_b):
        elapsed = (time.perf_counter() - t_start) * 1000
        return {
            "dimensions_a": (w_a, h_a),
            "dimensions_b": (w_b, h_b),
            "identical": False,
            "pixel_diff_count": -1,
            "diff_percentage": 100.0,
            "changed_regions": [],
            "stego": None,
            "elapsed_ms": round(elapsed, 2),
            "error": "Images have different dimensions",
        }

    pixels_a = list(img_a.getdata())
    pixels_b = list(img_b.getdata())

    diff_pixels: list[int] = []
    lsb_diff_count = 0

    for idx, (pa, pb) in enumerate(zip(pixels_a, pixels_b)):
        if pa != pb:
            diff_pixels.append(idx)
        # Count pixels that differ ONLY in LSB (steganography indicator)
        if (pa[0] & 1, pa[1] & 1, pa[2] & 1) != (pb[0] & 1, pb[1] & 1, pb[2] & 1):
            lsb_diff_count += 1

    pixel_diff_count = len(diff_pixels)
    total_pixels = w_a * h_a
    diff_pct = round((pixel_diff_count / total_pixels) * 100, 4) if total_pixels else 0

    # Compute bounding boxes of changed regions (group nearby changed pixels)
    changed_regions = _compute_regions(diff_pixels, w_a, h_a)

    stego_result = None
    if run_stego:
        lsb_only_pct = lsb_diff_count / total_pixels if total_pixels else 0
        stego_result = {
            "analyzed": True,
            "lsb_diff_pixels": lsb_diff_count,
            "lsb_diff_percentage": round(lsb_only_pct * 100, 4),
            "is_suspicious": lsb_only_pct >= DIFF_PIXEL_ALERT,
            "entropy_a": _shannon_entropy(_extract_lsb_bytes(img_a)),
            "entropy_b": _shannon_entropy(_extract_lsb_bytes(img_b)),
        }

    elapsed = (time.perf_counter() - t_start) * 1000
    log.debug(f"Image compare: {pixel_diff_count}/{total_pixels} pixels differ ({diff_pct}%) in {elapsed:.1f}ms")

    return {
        "dimensions_a": (w_a, h_a),
        "dimensions_b": (w_b, h_b),
        "identical": pixel_diff_count == 0,
        "pixel_diff_count": pixel_diff_count,
        "diff_percentage": diff_pct,
        "changed_regions": changed_regions,
        "stego": stego_result,
        "elapsed_ms": round(elapsed, 2),
    }


def _compute_regions(diff_pixels: list[int], width: int, height: int, cell_size: int = 16) -> list[dict]:
    """
    Group changed pixels into bounding-box regions using a coarse grid.
    Avoids returning thousands of individual pixel coords to the client.
    """
    if not diff_pixels:
        return []

    occupied_cells: set[tuple[int, int]] = set()
    for idx in diff_pixels:
        x = (idx % width) // cell_size
        y = (idx // width) // cell_size
        occupied_cells.add((x, y))

    regions = []
    for cx, cy in sorted(occupied_cells):
        regions.append({
            "x": cx * cell_size,
            "y": cy * cell_size,
            "w": cell_size,
            "h": cell_size,
        })

    # Limit to 500 regions in the response
    return regions[:500]
