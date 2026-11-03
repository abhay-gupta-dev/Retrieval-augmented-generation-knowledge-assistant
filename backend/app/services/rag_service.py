"""Embedding, pgvector retrieval, and citation-aware answer generation."""

from __future__ import annotations

import json
from collections.abc import Generator
from functools import lru_cache
from typing import TYPE_CHECKING, Any
from uuid import UUID

from groq import APIError, Groq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.models import Document, DocumentChunk, KnowledgeBase
from app.schemas.rag import Citation

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


@lru_cache
def embedding_model() -> SentenceTransformer:
    # PyTorch and sentence-transformers consume substantial RAM at import and
    # model load time. Keep them out of web-service startup so auth, chat, and
    # health checks can run on small instances; load them only when indexing or
    # searching a document actually needs embeddings.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(get_settings().embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    vectors = embedding_model().encode(texts, normalize_embeddings=True, show_progress_bar=False)
    if vectors.shape[1] != 384:
        raise RuntimeError("This deployment expects a 384-dimensional embedding model.")
    return vectors.tolist()


def retrieve(
    database: Session,
    knowledge_base_id: UUID | None,
    question: str,
    user_id: UUID | None = None,
    limit: int = 5,
) -> list[tuple[DocumentChunk, Document, float]]:
    """Retrieve top-K similar document chunks using pgvector cosine distance with ownership defense."""
    if not knowledge_base_id:
        return []

    # Only embed a query when there is indexed content to search. Queued,
    # processing, failed, or empty documents should not make general chat
    # depend on loading the embedding model.
    indexed_chunk = database.scalar(
        select(DocumentChunk.id)
        .join(Document, Document.id == DocumentChunk.document_id)
        .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
        .where(
            Document.knowledge_base_id == knowledge_base_id,
            Document.status.in_(["ready", "indexed"]),
            *( [KnowledgeBase.owner_id == user_id] if user_id else [] )
        )
        .limit(1)
    )
    if indexed_chunk is None:
        return []

    query_embedding = embed_texts([question])[0]
    distance = DocumentChunk.embedding.cosine_distance(query_embedding).label("distance")

    rows = database.execute(
        select(DocumentChunk, Document, distance)
        .join(Document, Document.id == DocumentChunk.document_id)
        .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
        .where(
            Document.knowledge_base_id == knowledge_base_id,
            Document.status.in_(["ready", "indexed"]),
            *( [KnowledgeBase.owner_id == user_id] if user_id else [] )
        )
        .order_by(distance)
        .limit(limit)
    ).all()

    return [(chunk, document, float(val)) for chunk, document, val in rows]


def build_rag_prompt(
    sources: list[tuple[DocumentChunk, Document, float]],
    question: str,
    history: list[dict[str, str]],
) -> tuple[list[dict[str, str]], list[Citation]]:
    if sources:
        citations = [
            Citation(
                document_id=document.id,
                filename=document.original_filename,
                chunk_index=chunk.chunk_index,
                excerpt=chunk.content[:320],
            )
            for chunk, document, _ in sources
        ]

        context_blocks: list[str] = []
        for index, ((chunk, _, _), citation) in enumerate(zip(sources, citations, strict=True)):
            context_blocks.append(f"[Source {index + 1}: {citation.filename}, chunk {citation.chunk_index}]\n{chunk.content}")

        context_str = "\n\n".join(context_blocks)

        system_prompt = (
            "You are Cognitive Assistant, an intelligent, helpful, and precise AI knowledge assistant.\n"
            "Guidelines:\n"
            "1. Ground your answers primarily in the provided Document Context whenever relevant.\n"
            "2. When making factual claims supported by the context, cite the source using the exact tag [Source N] (e.g. [Source 1]).\n"
            "3. If the context does not contain enough information to fully answer, answer as helpfully and accurately as possible while noting what is not found in the documents. Do not invent citations.\n"
            "4. Format answers cleanly using Markdown (use headings, bullet points, bold text, tables, and code blocks where helpful).\n"
            "5. Maintain a professional, articulate, and friendly tone."
        )

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history[-8:])
        messages.append({
            "role": "user",
            "content": f"Document Context:\n{context_str}\n\nUser Question: {question}",
        })
        return messages, citations

    # General conversation without document context
    citations = []
    system_prompt = (
        "You are Cognitive Assistant, an intelligent, thoughtful, and articulate AI knowledge assistant inspired by Claude.\n"
        "Guidelines:\n"
        "1. Provide clear, comprehensive, and well-structured answers.\n"
        "2. Format answers beautifully using Markdown (use headings, bullet points, numbered lists, math notation, and syntax-highlighted code blocks where appropriate).\n"
        "3. If the user asks about specific uploaded files or personal knowledge but none are selected or uploaded, gently mention that they can upload files (TXT, Markdown, PDF, DOCX) to get grounded answers with source citations.\n"
        "4. Maintain a calm, friendly, and highly professional tone."
    )
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history[-8:])
    messages.append({"role": "user", "content": question})
    return messages, citations


def answer_question(
    database: Session,
    knowledge_base_id: UUID | None,
    question: str,
    history: list[dict[str, str]],
    user_id: UUID | None = None,
) -> tuple[str, list[Citation]]:
    """Synchronously generate a citation-backed RAG answer via Groq."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured on the server.")

    sources = retrieve(database, knowledge_base_id, question, user_id=user_id) if knowledge_base_id else []
    messages, citations = build_rag_prompt(sources, question, history)

    try:
        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.3,
            max_tokens=4096,
        )
        choice = response.choices[0]
        content = choice.message.content or ""
        # Support reasoning models where tokens went into reasoning
        if not content.strip() and hasattr(choice.message, "reasoning") and choice.message.reasoning:
            content = choice.message.reasoning

        if not content.strip():
            content = "I could not generate an answer from the available context. Please refine your question."

        return content, citations
    except APIError as error:
        raise RuntimeError(f"Groq API error ({error.status_code}): {error.message}") from error
    except Exception as error:
        raise RuntimeError(f"Error generating AI response: {error}") from error


def stream_answer_question(
    database: Session,
    knowledge_base_id: UUID | None,
    question: str,
    history: list[dict[str, str]],
    user_id: UUID | None = None,
) -> Generator[dict[str, Any], None, None]:
    """Stream token chunks and citations for SSE."""
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured on the server.")

    sources = retrieve(database, knowledge_base_id, question, user_id=user_id) if knowledge_base_id else []
    messages, citations = build_rag_prompt(sources, question, history)

    # First event: citations
    yield {"type": "citations", "citations": [c.model_dump(mode="json") for c in citations]}

    full_content = []
    try:
        client = Groq(api_key=settings.groq_api_key)
        stream = client.chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            temperature=0.3,
            max_tokens=4096,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta:
                token = delta.content or ""
                # Also handle reasoning delta if model streams reasoning
                if not token and hasattr(delta, "reasoning") and delta.reasoning:
                    token = delta.reasoning
                if token:
                    full_content.append(token)
                    yield {"type": "token", "token": token}

        final_text = "".join(full_content).strip()
        if not final_text:
            final_text = "I could not generate an answer from the available context."
            yield {"type": "token", "token": final_text}

        yield {"type": "done", "full_content": final_text}
    except APIError as error:
        yield {"type": "error", "error": f"Groq API error: {error.message}"}
    except Exception as error:
        yield {"type": "error", "error": f"Generation error: {error}"}


def encode_citations(citations: list[Citation]) -> str:
    return json.dumps([citation.model_dump(mode="json") for citation in citations])


def decode_citations(value: str | None) -> list[Citation]:
    if not value:
        return []
    try:
        return [Citation.model_validate(item) for item in json.loads(value)]
    except Exception:
        return []
