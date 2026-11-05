"""Embedding, pgvector retrieval, and citation-aware answer generation."""

from __future__ import annotations

import json
import hashlib
import re
from collections.abc import Generator
from typing import Any
from uuid import UUID

from groq import APIError, Groq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.models import Document, DocumentChunk, KnowledgeBase
from app.schemas.rag import Citation


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Build small hashed vectors without loading PyTorch or downloading a model.

    PostgreSQL full-text ranking below is the primary retrieval path. These
    vectors preserve the existing pgvector column and provide a cheap fallback
    score without exhausting memory on small hosted instances.
    """
    vectors: list[list[float]] = []
    for text in texts:
        vector = [0.0] * 384
        words = re.findall(r"[\w]+", text.casefold(), flags=re.UNICODE)
        features = words + [f"{left} {right}" for left, right in zip(words, words[1:])]
        for feature in features:
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
            index = int.from_bytes(digest[:4], "little") % len(vector)
            vector[index] += 1.0 if digest[4] & 1 else -1.0
        magnitude = sum(value * value for value in vector) ** 0.5
        if magnitude:
            vector = [value / magnitude for value in vector]
        vectors.append(vector)
    return vectors


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

    scope = [
        Document.knowledge_base_id == knowledge_base_id,
        Document.status.in_(["ready", "indexed"]),
        *([KnowledgeBase.owner_id == user_id] if user_id else []),
    ]
    simple_vector = func.to_tsvector("simple", DocumentChunk.content)
    simple_query = func.plainto_tsquery("simple", question)
    english_vector = func.to_tsvector("english", DocumentChunk.content)
    english_query = func.plainto_tsquery("english", question)
    rank = (
        func.ts_rank_cd(simple_vector, simple_query)
        + func.ts_rank_cd(english_vector, english_query)
    ).label("rank")
    lexical_rows = database.execute(
        select(DocumentChunk, Document, rank)
        .join(Document, Document.id == DocumentChunk.document_id)
        .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
        .where(*scope, simple_vector.op("@@")(simple_query) | english_vector.op("@@")(english_query))
        .order_by(rank.desc())
        .limit(limit)
    ).all()
    if lexical_rows:
        return [(chunk, document, float(score)) for chunk, document, score in lexical_rows]

    # If stemming/token matching finds nothing, fall back to the compact
    # feature-hashed vectors so related word combinations can still surface.
    query_embedding = embed_texts([question])[0]
    distance = DocumentChunk.embedding.cosine_distance(query_embedding).label("distance")
    vector_rows = database.execute(
        select(DocumentChunk, Document, distance)
        .join(Document, Document.id == DocumentChunk.document_id)
        .join(KnowledgeBase, KnowledgeBase.id == Document.knowledge_base_id)
        .where(*scope)
        .order_by(distance)
        .limit(limit)
    ).all()
    return [(chunk, document, float(score)) for chunk, document, score in vector_rows]


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
