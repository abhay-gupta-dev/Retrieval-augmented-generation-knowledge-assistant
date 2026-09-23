"""Authenticated document upload and indexing status API."""

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
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
def list_documents(knowledge_base_id: UUID, user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> list[Document]:
    owned_knowledge_base(database, user, knowledge_base_id)
    return list(database.scalars(select(Document).where(Document.knowledge_base_id == knowledge_base_id).order_by(Document.created_at.desc())))


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(knowledge_base_id: UUID, background_tasks: BackgroundTasks, file: UploadFile = File(...), user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> Document:
    owned_knowledge_base(database, user, knowledge_base_id)
    filename = Path(file.filename or "upload").name
    content = await file.read()
    try:
        storage_key, content_hash = persist_upload(filename, content)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)) from error
    document = Document(knowledge_base_id=knowledge_base_id, original_filename=filename, storage_key=storage_key, content_type=file.content_type, size_bytes=len(content), content_sha256=content_hash, status="queued")
    database.add(document)
    database.commit()
    database.refresh(document)
    background_tasks.add_task(index_document, document.id)
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(knowledge_base_id: UUID, document_id: UUID, user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> None:
    owned_knowledge_base(database, user, knowledge_base_id)
    document = database.scalar(select(Document).where(Document.id == document_id, Document.knowledge_base_id == knowledge_base_id))
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    path = storage_path(document.storage_key)
    database.delete(document)
    database.commit()
    path.unlink(missing_ok=True)
