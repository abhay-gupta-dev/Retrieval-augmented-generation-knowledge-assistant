"""Persistent, knowledge-base-scoped RAG conversations with streaming and management."""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.knowledge_base import owned_knowledge_base
from app.core.security import get_current_user
from app.database.connection import SessionLocal, get_db
from app.database.models import ChatMessage, ChatSession, KnowledgeBase, User
from app.schemas.rag import (
    ChatReply,
    ChatSessionCreate,
    ChatSessionResponse,
    ChatSessionUpdate,
    MessageCreate,
    MessageResponse,
)
from app.services.rag_service import (
    answer_question,
    decode_citations,
    encode_citations,
    stream_answer_question,
)

router = APIRouter(prefix="/chat", tags=["chat"])


def owned_session(database: Session, user: User, session_id: UUID) -> ChatSession:
    session = database.scalar(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return session


def message_response(message: ChatMessage) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        role=message.role,
        content=message.content,
        citations=decode_citations(message.citations),
        created_at=message.created_at,
    )


def session_to_response(session: ChatSession, kb_name: str | None = None, msg_count: int = 0) -> ChatSessionResponse:
    return ChatSessionResponse(
        id=session.id,
        knowledge_base_id=session.knowledge_base_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        knowledge_base_name=kb_name,
        message_count=msg_count,
    )


@router.get("", response_model=list[ChatSessionResponse])
def list_chats(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[ChatSessionResponse]:
    """List all chat sessions for the current user with KB name and message counts."""
    query = (
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
    )
    results = database.execute(query).all()
    return [session_to_response(session, kb_name, msg_count) for session, kb_name, msg_count in results]


@router.post("", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
def create_chat(
    payload: ChatSessionCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatSessionResponse:
    """Create a new chat session."""
    kb_name = None
    if payload.knowledge_base_id:
        kb = owned_knowledge_base(database, user, payload.knowledge_base_id)
        kb_name = kb.name

    session = ChatSession(
        user_id=user.id,
        knowledge_base_id=payload.knowledge_base_id,
        title=payload.title.strip() if payload.title and payload.title.strip() else "New conversation",
    )
    database.add(session)
    database.commit()
    database.refresh(session)
    return session_to_response(session, kb_name, 0)


@router.get("/{session_id}", response_model=ChatSessionResponse)
def get_chat(
    session_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatSessionResponse:
    """Retrieve details for a specific chat session."""
    session = owned_session(database, user, session_id)
    kb_name = None
    if session.knowledge_base_id:
        kb = database.get(KnowledgeBase, session.knowledge_base_id)
        if kb:
            kb_name = kb.name
    msg_count = database.scalar(select(func.count(ChatMessage.id)).where(ChatMessage.session_id == session.id)) or 0
    return session_to_response(session, kb_name, msg_count)


@router.patch("/{session_id}", response_model=ChatSessionResponse)
def rename_chat(
    session_id: UUID,
    payload: ChatSessionUpdate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatSessionResponse:
    """Rename a chat session."""
    session = owned_session(database, user, session_id)
    session.title = payload.title.strip()
    database.commit()
    database.refresh(session)

    kb_name = None
    if session.knowledge_base_id:
        kb = database.get(KnowledgeBase, session.knowledge_base_id)
        if kb:
            kb_name = kb.name
    msg_count = database.scalar(select(func.count(ChatMessage.id)).where(ChatMessage.session_id == session.id)) or 0
    return session_to_response(session, kb_name, msg_count)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat(
    session_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    """Delete a chat session and all messages within it."""
    session = owned_session(database, user, session_id)
    database.delete(session)
    database.commit()


@router.get("/{session_id}/messages", response_model=list[MessageResponse])
def list_messages(
    session_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> list[MessageResponse]:
    """List all messages in a chat session ordered chronologically."""
    session = owned_session(database, user, session_id)
    messages = list(database.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc())
    ))
    return [message_response(m) for m in messages]


@router.post("/{session_id}/messages", response_model=ChatReply)
def send_message(
    session_id: UUID,
    payload: MessageCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatReply:
    """Send a user message and synchronously generate a RAG answer."""
    session = owned_session(database, user, session_id)
    if not session.knowledge_base_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Select a knowledge base before asking a question.",
        )

    user_message = ChatMessage(session_id=session.id, role="user", content=payload.content.strip())
    database.add(user_message)
    database.flush()

    past_messages = list(database.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id, ChatMessage.id != user_message.id).order_by(ChatMessage.created_at.asc())
    ))
    history = [{"role": m.role, "content": m.content} for m in past_messages]

    try:
        answer, citations = answer_question(
            database=database,
            knowledge_base_id=session.knowledge_base_id,
            question=user_message.content,
            history=history,
            user_id=user.id,
        )
    except Exception as error:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    assistant_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=answer,
        citations=encode_citations(citations),
    )
    database.add(assistant_message)

    if session.title == "New conversation":
        session.title = payload.content.strip()[:100]
    session.updated_at = func.now()

    database.commit()
    database.refresh(user_message)
    database.refresh(assistant_message)
    return ChatReply(
        user_message=message_response(user_message),
        assistant_message=message_response(assistant_message),
    )


@router.post("/{session_id}/messages/stream")
def stream_message(
    session_id: UUID,
    payload: MessageCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
):
    """Send a user message and stream back tokens via Server-Sent Events (SSE)."""
    session = owned_session(database, user, session_id)
    if not session.knowledge_base_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Select a knowledge base before asking a question.",
        )

    user_msg_content = payload.content.strip()
    user_message = ChatMessage(session_id=session.id, role="user", content=user_msg_content)
    database.add(user_message)
    database.flush()

    past_messages = list(database.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id, ChatMessage.id != user_message.id).order_by(ChatMessage.created_at.asc())
    ))
    history = [{"role": m.role, "content": m.content} for m in past_messages]

    if session.title == "New conversation":
        session.title = user_msg_content[:100]
    session.updated_at = func.now()

    database.commit()
    user_msg_id = user_message.id
    user_created_at = user_message.created_at.isoformat()
    kb_id = session.knowledge_base_id
    sess_id = session.id
    current_user_id = user.id

    def event_stream():
        stream_db = SessionLocal()
        try:
            # First send user_message info event
            yield f"event: user_message\ndata: {json.dumps({'id': str(user_msg_id), 'role': 'user', 'content': user_msg_content, 'created_at': user_created_at})}\n\n"

            accumulated_citations = []
            generator = stream_answer_question(
                database=stream_db,
                knowledge_base_id=kb_id,
                question=user_msg_content,
                history=history,
                user_id=current_user_id,
            )

            for event in generator:
                event_type = event.get("type")
                if event_type == "citations":
                    accumulated_citations = event.get("citations", [])
                    yield f"event: citations\ndata: {json.dumps(accumulated_citations)}\n\n"
                elif event_type == "token":
                    yield f"event: token\ndata: {json.dumps({'token': event.get('token', '')})}\n\n"
                elif event_type == "error":
                    yield f"event: error\ndata: {json.dumps({'error': event.get('error', 'Unknown error')})}\n\n"
                elif event_type == "done":
                    full_content = event.get("full_content", "")
                    # Persist assistant message in database
                    ast_msg = ChatMessage(
                        session_id=sess_id,
                        role="assistant",
                        content=full_content,
                        citations=json.dumps(accumulated_citations),
                    )
                    stream_db.add(ast_msg)
                    stream_db.commit()
                    stream_db.refresh(ast_msg)

                    yield f"event: done\ndata: {json.dumps({'id': str(ast_msg.id), 'role': 'assistant', 'content': full_content, 'citations': accumulated_citations, 'created_at': ast_msg.created_at.isoformat()})}\n\n"
        except Exception as err:
            yield f"event: error\ndata: {json.dumps({'error': str(err)})}\n\n"
        finally:
            stream_db.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/{session_id}/retry", response_model=ChatReply)
def retry_message(
    session_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatReply:
    """Regenerate the response for the most recent user message."""
    session = owned_session(database, user, session_id)
    if not session.knowledge_base_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No knowledge base selected.")

    # Find the last assistant message and last user message
    messages = list(database.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc())
    ))
    if not messages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No messages to retry.")

    # Find last user message
    last_user_idx = None
    for i in range(len(messages) - 1, -1, -1):
        if messages[i].role == "user":
            last_user_idx = i
            break

    if last_user_idx is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No user message found to retry.")

    user_message = messages[last_user_idx]

    # Delete any assistant messages after this user message
    for msg in messages[last_user_idx + 1:]:
        database.delete(msg)
    database.flush()

    history = [{"role": m.role, "content": m.content} for m in messages[:last_user_idx]]

    try:
        answer, citations = answer_question(
            database=database,
            knowledge_base_id=session.knowledge_base_id,
            question=user_message.content,
            history=history,
            user_id=user.id,
        )
    except Exception as error:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)) from error

    assistant_message = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=answer,
        citations=encode_citations(citations),
    )
    database.add(assistant_message)
    session.updated_at = func.now()
    database.commit()
    database.refresh(assistant_message)

    return ChatReply(
        user_message=message_response(user_message),
        assistant_message=message_response(assistant_message),
    )
