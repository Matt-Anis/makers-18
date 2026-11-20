from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db import get_db
from app.ingestion.scrubber import (
    MAX_UPLOAD_BYTES,
    DocumentExtractionError,
    extract_and_scrub_document,
)
from app.models import AuditLog, User

router = APIRouter(prefix="/ingestion", tags=["ingestion"])


class ExtractedDocumentOut(BaseModel):
    """Sanitized document text and summary of stripped hidden metadata/comments."""

    filename: str
    file_type: Literal["pdf", "docx", "txt"]
    text: str
    char_count: int
    page_count: int | None = None
    stripped_metadata_fields: list[str]
    stripped_comments_count: int
    stripped_revisions_count: int
    truncated: bool


@router.post("/extract", response_model=ExtractedDocumentOut)
async def extract_uploaded_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ExtractedDocumentOut:
    """Extract text in memory from .pdf, .docx, or .txt while stripping metadata and comments."""
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()

    try:
        result = extract_and_scrub_document(file.filename or "document.txt", data)
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    db.add(
        AuditLog(
            user_id=current_user.id,
            action="document.extracted",
            entity_counts={
                "metadata_fields": len(result.stripped_metadata_fields),
                "comments": result.stripped_comments_count,
                "revisions": result.stripped_revisions_count,
            },
        )
    )
    db.commit()

    return ExtractedDocumentOut(
        filename=result.filename,
        file_type=result.file_type,
        text=result.text,
        char_count=result.char_count,
        page_count=result.page_count,
        stripped_metadata_fields=result.stripped_metadata_fields,
        stripped_comments_count=result.stripped_comments_count,
        stripped_revisions_count=result.stripped_revisions_count,
        truncated=result.truncated,
    )
