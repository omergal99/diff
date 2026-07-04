"""
API routes for Office document comparison.

POST /api/diff/office → extract text from DOCX/XLSX/PDF then diff.
"""

from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from core.office import extract
from core.diff import compute_diff
from utils.models import DiffOptions
from utils.stream import sha256_stream
from utils.logger import get_logger

log = get_logger("routes.office")

router = APIRouter(prefix="/api/diff", tags=["office"])

MAX_OFFICE_SIZE = 100 * 1024 * 1024  # 100 MB


@router.post("/office")
async def diff_office(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    file_type: str = Query(..., description="docx | xlsx | pdf"),
) -> dict:
    """
    Extract text from two Office documents and return a text diff.
    Response includes the extracted text plus the full diff hunks.
    """
    data_a = await file_a.read()
    data_b = await file_b.read()

    for data, name in ((data_a, "A"), (data_b, "B")):
        if len(data) > MAX_OFFICE_SIZE:
            raise HTTPException(413, detail=f"File {name} too large (max 100 MB)")

    try:
        text_a = extract(data_a, file_type)
        text_b = extract(data_b, file_type)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        log.exception("Office extraction failed")
        raise HTTPException(500, detail=f"Extraction failed: {e}")

    hash_a = sha256_stream(data_a)
    hash_b = sha256_stream(data_b)

    try:
        diff = compute_diff(
            text_a,
            text_b,
            opts=DiffOptions(),
            hash_a=hash_a,
            hash_b=hash_b,
        )
    except Exception as e:
        log.exception("Office diff failed")
        raise HTTPException(500, detail=str(e))

    result = diff.model_dump()
    result["extracted_a"] = text_a
    result["extracted_b"] = text_b
    result["file_type"] = file_type
    return result
