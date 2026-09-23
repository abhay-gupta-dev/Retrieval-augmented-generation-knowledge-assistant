"""API contracts for knowledge bases, documents, and grounded chat."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class KnowledgeBaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    knowledge_base_id: UUID
    original_filename: str
    content_type: str | None
    size_bytes: int
    status: str
    error_message: str | None
    chunk_count: int
    created_at: datetime
    indexed_at: datetime | None


class Citation(BaseModel):
    document_id: UUID
    filename: str
    chunk_index: int
    excerpt: str


class ChatSessionCreate(BaseModel):
    knowledge_base_id: UUID | None = None
    title: str | None = Field(default=None, max_length=160)


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    knowledge_base_id: UUID | None
    title: str
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=12000)


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str
    content: str
    citations: list[Citation] = []
    created_at: datetime


class ChatReply(BaseModel):
    user_message: MessageResponse
    assistant_message: MessageResponse
