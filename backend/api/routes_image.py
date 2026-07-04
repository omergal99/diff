"""
API routes for image comparison and steganography analysis.

POST /api/diff/image         → pixel diff + optional stego
POST /api/stego/analyze      → analyze single image for hidden data
"""

from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from core.stego import compare_images, analyze_image
from utils.logger import get_logger

log = get_logger("routes.image")

router = APIRouter(tags=["image"])

MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/api/diff/image")
async def diff_image(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    stego: bool = Query(False, description="Run steganography analysis"),
) -> dict:
    """Compare two images pixel-by-pixel. Optionally detect hidden LSB data."""
    data_a = await file_a.read()
    data_b = await file_b.read()

    for data, name in ((data_a, "A"), (data_b, "B")):
        if len(data) > MAX_IMAGE_SIZE:
            raise HTTPException(413, detail=f"Image {name} too large (max 50 MB)")

    try:
        return compare_images(data_a, data_b, run_stego=stego)
    except RuntimeError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        log.exception("Image compare failed")
        raise HTTPException(500, detail=str(e))


@router.post("/api/stego/analyze")
async def stego_analyze(
    file: UploadFile = File(...),
) -> dict:
    """Analyze a single image for LSB steganography payload."""
    data = await file.read()
    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(413, detail="Image too large (max 50 MB)")

    try:
        return analyze_image(data)
    except RuntimeError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        log.exception("Stego analysis failed")
        raise HTTPException(500, detail=str(e))
