"""Persistent, knowledge-base-scoped RAG conversations with streaming and management."""

import base64
import json
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from groq import APIError, Groq
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, undefer

from app.api.knowledge_base import owned_knowledge_base
from app.core.config import get_settings
from app.core.security import get_current_user
from app.database.connection import SessionLocal, get_db
from app.database.models import ChatMessage, ChatSession, Document, KnowledgeBase, User
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
from app.services.document_service import storage_path

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


def owned_session(database: Session, user: User, session_id: UUID) -> ChatSession:
    session = database.scalar(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user.id)
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return session


def share_serializer() -> URLSafeTimedSerializer:
    settings = get_settings()
    secret = settings.jwt_secret_key or settings.session_secret_key
    if not secret:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chat sharing is not configured.")
    return URLSafeTimedSerializer(secret, salt="cognitive-rag-chat-share-v1")


def message_response(message: ChatMessage) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        role=message.role,
        content=message.content,
        citations=decode_citations(message.citations),
        attachment_url=(
            f"/api/v1/chat/{message.session_id}/messages/{message.id}/image"
            if message.attachment_content_type else None
        ),
        attachment_filename=message.attachment_filename,
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


@router.post("/{session_id}/share")
def create_chat_share(
    session_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> dict[str, str]:
    """Create a signed, read-only bearer link for a conversation."""
    owned_session(database, user, session_id)
    token = share_serializer().dumps(str(session_id))
    return {"token": token}


@router.get("/shared")
def get_shared_chat(token: str, database: Session = Depends(get_db)) -> dict:
    """Return a read-only conversation for a valid, time-limited share link."""
    try:
        session_id = UUID(share_serializer().loads(token, max_age=60 * 60 * 24 * 365))
    except (BadSignature, SignatureExpired, ValueError, TypeError) as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This share link is invalid or has expired.") from error

    session = database.get(ChatSession, session_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This shared conversation is no longer available.")
    messages = database.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc())
    )
    return {
        "title": session.title,
        "messages": [
            {
                "role": message.role,
                "content": message.content,
                "citations": [citation.model_dump(mode="json") for citation in decode_citations(message.citations)],
                "created_at": message.created_at,
                "attachment_filename": message.attachment_filename,
            }
            for message in messages
        ],
    }


@router.patch("/{session_id}", response_model=ChatSessionResponse)
def rename_chat(
    session_id: UUID,
    payload: ChatSessionUpdate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatSessionResponse:
    """Update a conversation title or its attached knowledge base."""
    session = owned_session(database, user, session_id)
    if payload.title is not None:
        session.title = payload.title.strip()
    if "knowledge_base_id" in payload.model_fields_set:
        if payload.knowledge_base_id is not None:
            owned_knowledge_base(database, user, payload.knowledge_base_id)
        session.knowledge_base_id = payload.knowledge_base_id
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


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_all_chats(
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> None:
    """Clear all chat sessions for the current user."""
    database.execute(delete(ChatSession).where(ChatSession.user_id == user.id))
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


@router.get("/{session_id}/messages/{message_id}/image")
def get_message_image(
    session_id: UUID,
    message_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> Response:
    session = owned_session(database, user, session_id)
    message = database.scalar(
        select(ChatMessage)
        .options(undefer(ChatMessage.attachment_data))
        .where(ChatMessage.id == message_id, ChatMessage.session_id == session.id)
    )
    if not message or not message.attachment_content_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image attachment not found.")
    image_bytes = message.attachment_data
    if message.attachment_document_id:
        document = database.scalar(
            select(Document)
            .options(undefer(Document.file_data))
            .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
            .where(Document.id == message.attachment_document_id, KnowledgeBase.owner_id == user.id)
        )
        if document:
            image_bytes = document.file_data
            if image_bytes is None:
                path = storage_path(document.storage_key)
                image_bytes = path.read_bytes() if path.is_file() else None
    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image attachment not found.")
    return Response(
        content=image_bytes,
        media_type=message.attachment_content_type,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


def resolve_active_kb_id(session: ChatSession) -> UUID | None:
    """Use only the knowledge base explicitly attached to this conversation."""
    return session.knowledge_base_id


@router.post("/{session_id}/messages", response_model=ChatReply)
def send_message(
    session_id: UUID,
    payload: MessageCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatReply:
    """Send a user message and generate a RAG or assistant answer."""
    session = owned_session(database, user, session_id)
    kb_id = resolve_active_kb_id(session)

    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=payload.content.strip(),
        attachment_filename="\n".join(name[:180] for name in payload.attachment_filenames)[:255] or None,
    )
    database.add(user_message)
    database.flush()

    past_messages = list(database.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id, ChatMessage.id != user_message.id).order_by(ChatMessage.created_at.asc())
    ))
    history = [{"role": m.role, "content": m.content} for m in past_messages]

    try:
        answer, citations = answer_question(
            database=database,
            knowledge_base_id=kb_id,
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
        session.title = payload.content.strip()[:60] or "New conversation"
    session.updated_at = func.now()

    database.commit()
    database.refresh(user_message)
    database.refresh(assistant_message)
    return ChatReply(
        user_message=message_response(user_message),
        assistant_message=message_response(assistant_message),
    )


@router.post("/{session_id}/images", response_model=ChatReply)
def send_image(
    session_id: UUID,
    image: UploadFile | None = File(default=None),
    prompt: str = Form(default=""),
    document_id: UUID | None = Form(default=None),
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatReply:
    """Ask the configured Groq vision model about an image in this chat."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Image understanding is not configured on the server.")

    session = owned_session(database, user, session_id)
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    filename = "uploaded image"
    document: Document | None = None
    if document_id:
        if not session.knowledge_base_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attach the image to this conversation first.")
        owned_knowledge_base(database, user, session.knowledge_base_id)
        document = database.scalar(
            select(Document).options(undefer(Document.file_data)).where(
                Document.id == document_id,
                Document.knowledge_base_id == session.knowledge_base_id,
            )
        )
        if not document or document.content_type not in allowed_types:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved image not found in this workspace.")
        filename = document.original_filename
        image_bytes = document.file_data
        if image_bytes is None:
            path = storage_path(document.storage_key)
            image_bytes = path.read_bytes() if path.is_file() else None
        image_content_type = document.content_type
    else:
        if not image or image.content_type not in allowed_types:
            raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Choose a JPEG, PNG, or WebP image.")
        image_bytes = image.file.read(settings.max_image_bytes + 1)
        image_content_type = image.content_type
        filename = (image.filename or "uploaded image").replace("\\", "/").split("/")[-1][:180]

    if not image_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The selected image is empty.")
    if len(image_bytes) > settings.max_image_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Images must be 10 MB or smaller.")

    question = prompt.strip()[:4000] or "Describe this image and explain its important details."
    user_content = question
    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=user_content,
        attachment_data=image_bytes if document is None else None,
        attachment_document_id=document.id if document else None,
        attachment_content_type=image_content_type,
        attachment_filename=filename,
    )
    database.add(user_message)
    database.flush()

    history_rows = list(database.scalars(
        select(ChatMessage).where(
            ChatMessage.session_id == session.id,
            ChatMessage.id != user_message.id,
        ).order_by(ChatMessage.created_at.asc())
    ))
    messages = [{"role": "system", "content": "You are a helpful assistant. Answer questions about the user's uploaded image clearly and accurately. If the image does not contain enough information, say so."}]
    messages.extend({"role": row.role, "content": row.content} for row in history_rows[-8:])
    messages.append({
        "role": "user",
        "content": [
            {"type": "text", "text": question},
            {"type": "image_url", "image_url": {"url": f"data:{image_content_type};base64,{base64.b64encode(image_bytes).decode('ascii')}"}},
        ],
    })

    try:
        response = Groq(api_key=settings.groq_api_key).chat.completions.create(
            model=settings.vision_model,
            messages=messages,
            # Groq's Qwen vision examples use temperature=1. Keep the request
            # aligned with the model's documented multimodal settings.
            temperature=1,
            max_completion_tokens=1024,
        )
        answer = response.choices[0].message.content or "I could not read enough detail from that image. Try asking a more specific question."
    except APIError as error:
        database.rollback()
        logger.error(
            "Groq image analysis failed: status=%s request_id=%s model=%s",
            getattr(error, "status_code", None),
            getattr(error, "request_id", None),
            settings.vision_model,
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Groq image analysis failed: {error.message}") from error
    except Exception as error:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Image analysis failed. Please try another image.") from error

    assistant_message = ChatMessage(session_id=session.id, role="assistant", content=answer, citations="[]")
    database.add(assistant_message)
    if session.title == "New conversation":
        session.title = (prompt.strip() or "Image question")[:60]
    session.updated_at = func.now()
    database.commit()
    database.refresh(user_message)
    database.refresh(assistant_message)
    return ChatReply(user_message=message_response(user_message), assistant_message=message_response(assistant_message))


@router.post("/{session_id}/messages/stream")
def stream_message(
    session_id: UUID,
    payload: MessageCreate,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
):
    """Send a user message and stream back tokens via Server-Sent Events (SSE)."""
    session = owned_session(database, user, session_id)
    kb_id = resolve_active_kb_id(session)

    user_msg_content = payload.content.strip()
    user_message = ChatMessage(
        session_id=session.id,
        role="user",
        content=user_msg_content,
        attachment_filename="\n".join(name[:180] for name in payload.attachment_filenames)[:255] or None,
    )
    database.add(user_message)
    database.flush()

    past_messages = list(database.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id, ChatMessage.id != user_message.id).order_by(ChatMessage.created_at.asc())
    ))
    history = [{"role": m.role, "content": m.content} for m in past_messages]

    if session.title == "New conversation":
        session.title = user_msg_content[:60] or "New conversation"
    session.updated_at = func.now()

    database.commit()
    user_msg_id = user_message.id
    user_created_at = user_message.created_at.isoformat()
    sess_id = session.id
    current_user_id = user.id

    def event_stream():
        stream_db = SessionLocal()
        try:
            # First send user_message info event
            yield f"event: user_message\ndata: {json.dumps({'id': str(user_msg_id), 'role': 'user', 'content': user_msg_content, 'attachment_filename': user_message.attachment_filename, 'created_at': user_created_at})}\n\n"

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

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)


@router.post("/{session_id}/retry", response_model=ChatReply)
def retry_message(
    session_id: UUID,
    user: User = Depends(get_current_user),
    database: Session = Depends(get_db),
) -> ChatReply:
    """Regenerate the response for the most recent user message."""
    session = owned_session(database, user, session_id)
    kb_id = resolve_active_kb_id(session)

    messages = list(database.scalars(
        select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at.asc())
    ))
    if not messages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No messages to retry.")

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
            knowledge_base_id=kb_id,
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
