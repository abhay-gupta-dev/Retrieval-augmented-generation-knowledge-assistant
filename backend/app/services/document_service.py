"""Safe local-storage ingestion and embedding pipeline.

Swap the storage adapter and background runner for S3/object storage and a queue
in deployment; the database and API contracts remain unchanged.
"""

import hashlib
import re
import uuid
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from docx import Document as WordDocument
from pypdf import PdfReader
from sqlalchemy import delete

from app.core.config import get_settings
from app.database.connection import SessionLocal
from app.database.models import Document, DocumentChunk
from app.services.rag_service import embed_texts

ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf", ".docx"}


def storage_path(storage_key: str) -> Path:
    settings = get_settings()
    directory = Path(settings.upload_directory)
    directory.mkdir(parents=True, exist_ok=True)
    return directory / storage_key


def validate_upload(filename: str, content: bytes) -> None:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError("Supported formats are TXT, Markdown, PDF, and DOCX.")
    if not content:
        raise ValueError("The uploaded file is empty.")
    if len(content) > get_settings().max_upload_bytes:
        raise ValueError("The uploaded file exceeds the configured size limit.")
    # Basic signature checks stop content-type spoofing before parser invocation.
    if extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise ValueError("The uploaded file is not a valid PDF.")
    if extension == ".docx" and not content.startswith(b"PK"):
        raise ValueError("The uploaded file is not a valid DOCX file.")


def persist_upload(filename: str, content: bytes) -> tuple[str, str]:
    validate_upload(filename, content)
    key = f"{uuid.uuid4()}{Path(filename).suffix.lower()}"
    storage_path(key).write_bytes(content)
    return key, hashlib.sha256(content).hexdigest()


def extract_text(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()
    if extension in {".txt", ".md"}:
        return content.decode("utf-8", errors="replace")
    if extension == ".pdf":
        return "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages)
    if extension == ".docx":
        return "\n".join(paragraph.text for paragraph in WordDocument(BytesIO(content)).paragraphs)
    raise ValueError("Unsupported document type.")


def chunk_text(text: str, chunk_size: int = 700, overlap: int = 100) -> list[str]:
    words = re.findall(r"\S+", text)
    if not words:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = end - overlap
    return chunks


def index_document(document_id: uuid.UUID) -> None:
    """Background task entry point. It owns its own short-lived DB session."""
    database = SessionLocal()
    try:
        document = database.get(Document, document_id)
        if not document:
            return
        document.status = "processing"
        database.commit()
        text = extract_text(document.original_filename, storage_path(document.storage_key).read_bytes())
        chunks = chunk_text(text)
        if not chunks:
            raise ValueError("No readable text was found in this document.")
        vectors = embed_texts(chunks)
        database.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document.id))
        database.add_all([
            DocumentChunk(document_id=document.id, chunk_index=index + 1, content=chunk, embedding=vector)
            for index, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True))
        ])
        document.chunk_count = len(chunks)
        document.status = "ready"
        document.error_message = None
        document.indexed_at = datetime.now(timezone.utc)
        database.commit()
    except Exception as error:
        database.rollback()
        document = database.get(Document, document_id)
        if document:
            document.status = "failed"
            document.error_message = str(error)[:2000]
            database.commit()
    finally:
        database.close()
