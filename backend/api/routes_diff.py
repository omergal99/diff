"""
API routes for text and JSON comparison.

POST /api/diff/text   → two-phase line+word diff
POST /api/diff/json   → structural JSON diff
"""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from utils.models import DiffOptions, DiffResult, JsonDiffOptions, JsonDiffResult
from utils.stream import sha256_stream
from core.diff import compute_diff
from core.json_diff import compute_json_diff
from utils.logger import get_logger

log = get_logger("routes.diff")

router = APIRouter(prefix="/api/diff", tags=["diff"])


class TextDiffRequest(BaseModel):
    text_a: str
    text_b: str
    options: DiffOptions = DiffOptions()


class JsonDiffRequest(BaseModel):
    json_a: str
    json_b: str
    options: JsonDiffOptions = JsonDiffOptions()


@router.post("/text", response_model=DiffResult)
async def diff_text(req: TextDiffRequest) -> DiffResult:
    """Compare two text strings. Returns coloured diff hunks."""
    try:
        hash_a = sha256_stream(req.text_a.encode())
        hash_b = sha256_stream(req.text_b.encode())

        result = compute_diff(
            req.text_a,
            req.text_b,
            opts=req.options,
            hash_a=hash_a,
            hash_b=hash_b,
        )
        return result
    except Exception as e:
        log.exception("Text diff failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/json", response_model=JsonDiffResult)
async def diff_json(req: JsonDiffRequest) -> JsonDiffResult:
    """Compare two JSON strings structurally."""
    try:
        result = compute_json_diff(req.json_a, req.json_b, opts=req.options)
        return result
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        log.exception("JSON diff failed")
        raise HTTPException(status_code=500, detail=str(e))
