"""Dashboard statistics API aggregating real user metrics."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.connection import get_db
from app.database.models import ChatMessage, ChatSession, Document, KnowledgeBase, User
from app.schemas.rag import DashboardStatsResponse, RecentChatItem, RecentDocumentItem

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> DashboardStatsResponse:
    """Return authentic statistics, recent documents, and recent chats for the authenticated user."""
    # 1. Total knowledge bases
    total_kbs = database.scalar(
        select(func.count(KnowledgeBase.id)).where(KnowledgeBase.owner_id == user.id)
    ) or 0

    # 2. Total documents and chunks
    doc_stats = database.execute(
        select(
            func.count(Document.id),
            func.coalesce(func.sum(Document.chunk_count), 0),
        )
        .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
        .where(KnowledgeBase.owner_id == user.id)
    ).first()
    total_docs = doc_stats[0] if doc_stats else 0
    total_chunks = doc_stats[1] if doc_stats else 0

    # 3. Total chats
    total_chats = database.scalar(
        select(func.count(ChatSession.id)).where(ChatSession.user_id == user.id)
    ) or 0

    # 4. Recent documents (latest 5)
    recent_docs_rows = database.execute(
        select(Document, KnowledgeBase.name.label("kb_name"))
        .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
        .where(KnowledgeBase.owner_id == user.id)
        .order_by(Document.created_at.desc())
        .limit(5)
    ).all()

    recent_documents = [
        RecentDocumentItem(
            id=doc.id,
            original_filename=doc.original_filename,
            knowledge_base_id=doc.knowledge_base_id,
            knowledge_base_name=kb_name,
            size_bytes=doc.size_bytes,
            status=doc.status,
            chunk_count=doc.chunk_count,
            created_at=doc.created_at,
        )
        for doc, kb_name in recent_docs_rows
    ]

    # 5. Recent chats (latest 5)
    recent_chats_rows = database.execute(
        select(
            ChatSession,
            KnowledgeBase.name.label("kb_name"),
            func.count(ChatMessage.id).label("msg_count"),
        )
        .outerjoin(KnowledgeBase, KnowledgeBase.id == ChatSession.knowledge_base_id)
        .outerjoin(ChatMessage, ChatMessage.session_id == ChatSession.id)
        .where(ChatSession.user_id == user.id)
        .group_by(ChatSession.id, KnowledgeBase.name)
        .order_by(ChatSession.updated_at.desc())
        .limit(5)
    ).all()

    recent_chats = [
        RecentChatItem(
            id=chat.id,
            title=chat.title,
            knowledge_base_id=chat.knowledge_base_id,
            knowledge_base_name=kb_name,
            message_count=msg_count,
            updated_at=chat.updated_at,
        )
        for chat, kb_name, msg_count in recent_chats_rows
    ]

    return DashboardStatsResponse(
        total_knowledge_bases=total_kbs,
        total_documents=total_docs,
        total_chunks=total_chunks,
        total_chat_sessions=total_chats,
        recent_documents=recent_documents,
        recent_chats=recent_chats,
    )
