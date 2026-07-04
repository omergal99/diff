"""
API routes for archive (ZIP/TAR/TGZ) comparison.

POST /api/diff/archive → Server-Sent Events stream of file-level results.
"""

from __future__ import annotations
import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from core.archive import compare_archives
from utils.logger import get_logger

log = get_logger("routes.archive")

router = APIRouter(prefix="/api/diff", tags=["archive"])

MAX_ARCHIVE_SIZE = 500 * 1024 * 1024  # 500 MB


@router.post("/archive")
async def diff_archive(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
) -> StreamingResponse:
    """
    Compare two archives. Returns a Server-Sent Events stream.
    Each event is a JSON object describing one file's status.
    """
    data_a = await file_a.read()
    data_b = await file_b.read()

    if len(data_a) > MAX_ARCHIVE_SIZE or len(data_b) > MAX_ARCHIVE_SIZE:
        raise HTTPException(413, detail="Archive too large (max 500 MB)")

    async def event_stream():
        try:
            for event in compare_archives(data_a, data_b):
                yield f"data: {json.dumps(event)}\n\n"
        except ValueError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        except Exception as e:
            log.exception("Archive compare failed")
            yield f"data: {json.dumps({'type': 'error', 'message': 'Internal error'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
