"""Tenant-scoped knowledge base API with statistics and update operations."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.connection import get_db
from app.database.models import Document, KnowledgeBase, User
from app.schemas.rag import KnowledgeBaseCreate, KnowledgeBaseResponse, KnowledgeBaseUpdate

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge bases"])


def owned_knowledge_base(database: Session, user: User, knowledge_base_id: UUID) -> KnowledgeBase:
    knowledge_base = database.scalar(
        select(KnowledgeBase).where(KnowledgeBase.id == knowledge_base_id, KnowledgeBase.owner_id == user.id)
    )
    if not knowledge_base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found.")
    return knowledge_base


def kb_to_response(kb: KnowledgeBase, doc_count: int = 0, total_chunks: int = 0) -> KnowledgeBaseResponse:
    return KnowledgeBaseResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description,
        created_at=kb.created_at,
        updated_at=kb.updated_at,
        document_count=doc_count,
        total_chunks=total_chunks,
    )


@router.get("", response_model=list[KnowledgeBaseResponse])
def list_knowledge_bases(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[KnowledgeBaseResponse]:
    """List all knowledge bases for the current user with aggregated document and chunk counts."""
    query = (
        select(
            KnowledgeBase,
            func.count(Document.id).label("doc_count"),
            func.coalesce(func.sum(Document.chunk_count), 0).label("total_chunks"),
        )
        .outerjoin(Document, Document.knowledge_base_id == KnowledgeBase.id)
        .where(KnowledgeBase.owner_id == user.id)
        .group_by(KnowledgeBase.id)
        .order_by(KnowledgeBase.updated_at.desc())
    )
    results = database.execute(query).all()
    return [kb_to_response(kb, doc_count, total_chunks) for kb, doc_count, total_chunks in results]


@router.get("/{knowledge_base_id}", response_model=KnowledgeBaseResponse)
def get_knowledge_base(
    knowledge_base_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> KnowledgeBaseResponse:
    """Retrieve a single knowledge base with its document and chunk count."""
    kb = owned_knowledge_base(database, user, knowledge_base_id)
    stats = database.execute(
        select(
            func.count(Document.id).label("doc_count"),
            func.coalesce(func.sum(Document.chunk_count), 0).label("total_chunks"),
        ).where(Document.knowledge_base_id == kb.id)
    ).first()
    doc_count = stats[0] if stats else 0
    total_chunks = stats[1] if stats else 0
    return kb_to_response(kb, doc_count, total_chunks)


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(
    payload: KnowledgeBaseCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> KnowledgeBaseResponse:
    """Create a new knowledge base."""
    # Check if user already has a knowledge base with the same name
    existing = database.scalar(
        select(KnowledgeBase).where(KnowledgeBase.owner_id == user.id, KnowledgeBase.name == payload.name.strip())
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A knowledge base named '{payload.name.strip()}' already exists.",
        )

    knowledge_base = KnowledgeBase(
        owner_id=user.id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    database.add(knowledge_base)
    database.commit()
    database.refresh(knowledge_base)
    return kb_to_response(knowledge_base, 0, 0)


@router.patch("/{knowledge_base_id}", response_model=KnowledgeBaseResponse)
def update_knowledge_base(
    knowledge_base_id: UUID,
    payload: KnowledgeBaseUpdate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> KnowledgeBaseResponse:
    """Rename or update the description of an owned knowledge base."""
    kb = owned_knowledge_base(database, user, knowledge_base_id)
    if payload.name is not None and payload.name.strip():
        # Check name collision with another KB owned by the same user
        conflict = database.scalar(
            select(KnowledgeBase).where(
                KnowledgeBase.owner_id == user.id,
                KnowledgeBase.name == payload.name.strip(),
                KnowledgeBase.id != kb.id,
            )
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Another knowledge base named '{payload.name.strip()}' already exists.",
            )
        kb.name = payload.name.strip()

    if payload.description is not None:
        kb.description = payload.description.strip() if payload.description.strip() else None

    database.commit()
    database.refresh(kb)

    stats = database.execute(
        select(
            func.count(Document.id).label("doc_count"),
            func.coalesce(func.sum(Document.chunk_count), 0).label("total_chunks"),
        ).where(Document.knowledge_base_id == kb.id)
    ).first()
    return kb_to_response(kb, stats[0] if stats else 0, stats[1] if stats else 0)


@router.delete("/{knowledge_base_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(
    knowledge_base_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    """Delete a knowledge base and all associated documents and chunks."""
    kb = owned_knowledge_base(database, user, knowledge_base_id)
    database.delete(kb)
    database.commit()
