"""Authenticated document upload, search, and indexing status API."""

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.knowledge_base import owned_knowledge_base
from app.core.security import get_current_user
from app.database.connection import get_db
from app.database.models import Document, User
from app.schemas.rag import DocumentResponse
from app.services.document_service import index_document, persist_upload, storage_path

router = APIRouter(prefix="/knowledge-bases/{knowledge_base_id}/documents", tags=["documents"])


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    knowledge_base_id: UUID,
    search: str | None = Query(default=None, description="Filter by filename"),
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[Document]:
    """List documents in a knowledge base with optional filename search."""
    owned_knowledge_base(database, user, knowledge_base_id)
    query = select(Document).where(Document.knowledge_base_id == knowledge_base_id)
    if search and search.strip():
        query = query.where(Document.original_filename.ilike(f"%{search.strip()}%"))
    query = query.order_by(Document.created_at.desc())
    return list(database.scalars(query))


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    knowledge_base_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Document:
    """Upload a document, validate it, check for duplicates, and start background indexing."""
    owned_knowledge_base(database, user, knowledge_base_id)
    filename = Path(file.filename or "upload").name
    content = await file.read()

    try:
        storage_key, content_hash = persist_upload(filename, content)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error

    # Prevent duplicate identical uploads in the same knowledge base
    existing = database.scalar(
        select(Document).where(
            Document.knowledge_base_id == knowledge_base_id,
            Document.content_sha256 == content_hash,
            Document.status != "failed",
        )
    )
    if existing:
        # Clean up uploaded storage file
        storage_path(storage_key).unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An identical document '{existing.original_filename}' is already indexed in this knowledge base.",
        )

    document = Document(
        knowledge_base_id=knowledge_base_id,
        original_filename=filename,
        storage_key=storage_key,
        content_type=file.content_type,
        size_bytes=len(content),
        content_sha256=content_hash,
        status="processing",
    )
    database.add(document)
    database.commit()
    database.refresh(document)

    background_tasks.add_task(index_document, document.id)
    return document


@router.get("/{document_id}/file")
def open_document_file(
    knowledge_base_id: UUID,
    document_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> FileResponse:
    """Open a source file belonging to an owned knowledge base."""
    owned_knowledge_base(database, user, knowledge_base_id)
    document = database.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.knowledge_base_id == knowledge_base_id,
        )
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    path = storage_path(document.storage_key)
    if not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file not found.")
    return FileResponse(
        path,
        media_type=document.content_type or "application/octet-stream",
        filename=document.original_filename,
        content_disposition_type="inline",
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    knowledge_base_id: UUID,
    document_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    """Delete a document and its storage file and vector chunks."""
    owned_knowledge_base(database, user, knowledge_base_id)
    document = database.scalar(
        select(Document).where(Document.id == document_id, Document.knowledge_base_id == knowledge_base_id)
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    path = storage_path(document.storage_key)
    database.delete(document)
    database.commit()
    path.unlink(missing_ok=True)
