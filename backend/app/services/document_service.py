"""Safe local-storage ingestion, text cleaning, chunking, and embedding pipeline."""

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
        raise ValueError(f"The uploaded file exceeds the configured limit of {get_settings().max_upload_bytes // (1024 * 1024)}MB.")
    if extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise ValueError("The uploaded file is not a valid PDF.")
    if extension == ".docx" and not content.startswith(b"PK"):
        raise ValueError("The uploaded file is not a valid DOCX file.")


def persist_upload(filename: str, content: bytes) -> tuple[str, str]:
    validate_upload(filename, content)
    key = f"{uuid.uuid4()}{Path(filename).suffix.lower()}"
    storage_path(key).write_bytes(content)
    return key, hashlib.sha256(content).hexdigest()


def clean_text(text: str) -> str:
    """Sanitize and normalize extracted text for high-quality embedding."""
    if not text:
        return ""
    # Strip null characters which can corrupt database storage
    text = text.replace("\x00", "")
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Replace non-breaking spaces and other odd spaces with standard space
    text = re.sub(r"[\u00A0\u1680\u180e\u2000-\u200a\u202f\u205f\u3000]", " ", text)
    # Filter out control characters except tab and newline
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    # Collapse multiple consecutive blank lines into at most two
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse multiple spaces
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def extract_text(filename: str, content: bytes) -> str:
    """Extract raw text from supported document types with error resilience."""
    extension = Path(filename).suffix.lower()
    if extension in {".txt", ".md"}:
        try:
            raw = content.decode("utf-8")
        except UnicodeDecodeError:
            raw = content.decode("latin-1", errors="replace")
        return clean_text(raw)

    if extension == ".pdf":
        try:
            reader = PdfReader(BytesIO(content))
            extracted_pages: list[str] = []
            for page_index, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        extracted_pages.append(page_text.strip())
                except Exception:
                    continue
            return clean_text("\n\n".join(extracted_pages))
        except Exception as error:
            raise ValueError(f"Could not read PDF document: {error}") from error

    if extension == ".docx":
        try:
            doc = WordDocument(BytesIO(content))
            sections: list[str] = []
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    sections.append(paragraph.text.strip())
            for table in doc.tables:
                for row in table.rows:
                    row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                    if row_text:
                        sections.append(row_text)
            return clean_text("\n\n".join(sections))
        except Exception as error:
            raise ValueError(f"Could not read DOCX document: {error}") from error

    raise ValueError("Unsupported document type.")


def chunk_text(text: str, target_chunk_size: int = 500, overlap: int = 80) -> list[str]:
    """Boundary-aware text chunker that preserves sentence and paragraph flow."""
    if not text.strip():
        return []

    # First attempt to split on paragraphs
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks: list[str] = []
    current_chunk_words: list[str] = []

    for para in paragraphs:
        para_words = re.findall(r"\S+", para)
        if not para_words:
            continue

        # If a single paragraph is longer than target_chunk_size, break it into sentences
        if len(para_words) > target_chunk_size:
            sentences = re.split(r"(?<=[.!?])\s+", para)
            for sentence in sentences:
                sent_words = re.findall(r"\S+", sentence)
                if not sent_words:
                    continue
                if len(current_chunk_words) + len(sent_words) <= target_chunk_size:
                    current_chunk_words.extend(sent_words)
                else:
                    if current_chunk_words:
                        chunks.append(" ".join(current_chunk_words))
                        # Keep overlap from the end of current chunk
                        current_chunk_words = current_chunk_words[-overlap:] if len(current_chunk_words) > overlap else []
                    # If sentence itself is still huge, slice it
                    while len(sent_words) > target_chunk_size:
                        chunks.append(" ".join(sent_words[:target_chunk_size]))
                        sent_words = sent_words[target_chunk_size - overlap:]
                    current_chunk_words.extend(sent_words)
        else:
            if len(current_chunk_words) + len(para_words) <= target_chunk_size:
                current_chunk_words.extend(para_words)
            else:
                if current_chunk_words:
                    chunks.append(" ".join(current_chunk_words))
                    current_chunk_words = current_chunk_words[-overlap:] if len(current_chunk_words) > overlap else []
                current_chunk_words.extend(para_words)

    if current_chunk_words:
        chunks.append(" ".join(current_chunk_words))

    # Remove duplicates or whitespace-only chunks
    cleaned_chunks = [c.strip() for c in chunks if len(c.strip()) > 10]
    return cleaned_chunks if cleaned_chunks else ([text.strip()] if text.strip() else [])


def index_document(document_id: uuid.UUID) -> None:
    """Background task entry point. Manages its own transactional session."""
    database = SessionLocal()
    try:
        document = database.get(Document, document_id)
        if not document:
            return
        document.status = "processing"
        database.commit()

        file_content = storage_path(document.storage_key).read_bytes()
        text = extract_text(document.original_filename, file_content)
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
        document.status = "indexed"
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
