"""Persistent, knowledge-base-scoped RAG conversations."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.knowledge_base import owned_knowledge_base
from app.core.security import get_current_user
from app.database.connection import get_db
from app.database.models import ChatMessage, ChatSession, User
from app.schemas.rag import ChatReply, ChatSessionCreate, ChatSessionResponse, MessageCreate, MessageResponse
from app.services.rag_service import answer_question, decode_citations, encode_citations

router = APIRouter(prefix="/chat", tags=["chat"])


def owned_session(database: Session, user: User, session_id: UUID) -> ChatSession:
    session = database.scalar(select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id))
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return session


def message_response(message: ChatMessage) -> MessageResponse:
    return MessageResponse(id=message.id, role=message.role, content=message.content, citations=decode_citations(message.citations), created_at=message.created_at)


@router.get("", response_model=list[ChatSessionResponse])
def list_chats(user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> list[ChatSession]:
    return list(database.scalars(select(ChatSession).where(ChatSession.user_id == user.id).order_by(ChatSession.updated_at.desc())))


@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_chat(payload: ChatSessionCreate, user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> ChatSession:
    if payload.knowledge_base_id:
        owned_knowledge_base(database, user, payload.knowledge_base_id)
    session = ChatSession(user_id=user.id, knowledge_base_id=payload.knowledge_base_id, title=payload.title or "New conversation")
    database.add(session)
    database.commit()
    database.refresh(session)
    return session


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
def list_messages(session_id: UUID, user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> list[MessageResponse]:
    return [message_response(message) for message in owned_session(database, user, session_id).messages]


@router.post("/{session_id}/messages", response_model=ChatReply)
def send_message(session_id: UUID, payload: MessageCreate, user: User = Depends(get_current_user), database: Session = Depends(get_db)) -> ChatReply:
    session = owned_session(database, user, session_id)
    if not session.knowledge_base_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Select a knowledge base before asking a question.")
    user_message = ChatMessage(session_id=session.id, role="user", content=payload.content.strip())
    database.add(user_message)
    database.flush()
    history = [{"role": message.role, "content": message.content} for message in session.messages if message.id != user_message.id]
    try:
        answer, citations = answer_question(database, session.knowledge_base_id, user_message.content, history)
    except RuntimeError as error:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error
    assistant_message = ChatMessage(session_id=session.id, role="assistant", content=answer, citations=encode_citations(citations))
    database.add(assistant_message)
    if session.title == "New conversation":
        session.title = payload.content.strip()[:160]
    database.commit()
    database.refresh(user_message)
    database.refresh(assistant_message)
    return ChatReply(user_message=message_response(user_message), assistant_message=message_response(assistant_message))
