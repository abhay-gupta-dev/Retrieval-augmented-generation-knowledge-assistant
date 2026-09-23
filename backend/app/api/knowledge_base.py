"""Tenant-scoped knowledge base API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.connection import get_db
from app.database.models import KnowledgeBase, User
from app.schemas.rag import KnowledgeBaseCreate, KnowledgeBaseResponse

router = APIRouter(prefix="/knowledge-bases", tags=["knowledge bases"])


def owned_knowledge_base(database: Session, user: User, knowledge_base_id: UUID) -> KnowledgeBase:
    knowledge_base = database.scalar(select(KnowledgeBase).where(KnowledgeBase.id == knowledge_base_id, KnowledgeBase.owner_id == user.id))
    if not knowledge_base:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge base not found.")
    return knowledge_base


@router.get("", response_model=list[KnowledgeBaseResponse])
def list_knowledge_bases(user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> list[KnowledgeBase]:
    return list(database.scalars(select(KnowledgeBase).where(KnowledgeBase.owner_id == user.id).order_by(KnowledgeBase.updated_at.desc())))


@router.post("", response_model=KnowledgeBaseResponse, status_code=status.HTTP_201_CREATED)
def create_knowledge_base(payload: KnowledgeBaseCreate, user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> KnowledgeBase:
    knowledge_base = KnowledgeBase(owner_id=user.id, name=payload.name.strip(), description=payload.description)
    database.add(knowledge_base)
    database.commit()
    database.refresh(knowledge_base)
    return knowledge_base


@router.delete("/{knowledge_base_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_base(knowledge_base_id: UUID, user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> None:
    database.delete(owned_knowledge_base(database, user, knowledge_base_id))
    database.commit()
