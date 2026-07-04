"""
API routes for Unicode / homograph analysis.

POST /api/unicode/check    → detect homographs and suspicious chars
POST /api/unicode/strip    → strip non-ASCII or zero-width chars
"""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.unicode_check import check_text, strip_non_ascii, strip_zero_width
from utils.logger import get_logger

log = get_logger("routes.unicode")

router = APIRouter(prefix="/api/unicode", tags=["unicode"])


class CheckRequest(BaseModel):
    text: str


class StripRequest(BaseModel):
    text: str
    mode: str = "non_ascii"       # "non_ascii" | "zero_width" | "custom"
    pattern: str = r"[^\x00-\x7f]"  # used only when mode="custom"


@router.post("/check")
async def unicode_check(req: CheckRequest) -> dict:
    """Detect Unicode homographs and suspicious characters in text."""
    try:
        return check_text(req.text)
    except Exception as e:
        log.exception("Unicode check failed")
        raise HTTPException(500, detail=str(e))


@router.post("/strip")
async def unicode_strip(req: StripRequest) -> dict:
    """Strip non-ASCII or zero-width characters from text."""
    try:
        if req.mode == "zero_width":
            cleaned = strip_zero_width(req.text)
        elif req.mode == "custom":
            cleaned = strip_non_ascii(req.text, req.pattern)
        else:
            cleaned = strip_non_ascii(req.text)

        removed_count = len(req.text) - len(cleaned)
        return {
            "original_length": len(req.text),
            "cleaned_length": len(cleaned),
            "removed_count": removed_count,
            "cleaned_text": cleaned,
        }
    except Exception as e:
        raise HTTPException(400, detail=str(e))
