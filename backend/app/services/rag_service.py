"""Embedding, pgvector retrieval, and citation-aware answer generation."""

import json
from functools import lru_cache

from groq import Groq
from sentence_transformers import SentenceTransformer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.models import Document, DocumentChunk
from app.schemas.rag import Citation


@lru_cache
def embedding_model() -> SentenceTransformer:
    return SentenceTransformer(get_settings().embedding_model)


def embed_texts(texts: list[str]) -> list[list[float]]:
    vectors = embedding_model().encode(texts, normalize_embeddings=True, show_progress_bar=False)
    if vectors.shape[1] != 384:
        raise RuntimeError("This deployment expects a 384-dimensional embedding model.")
    return vectors.tolist()


def retrieve(database: Session, knowledge_base_id, question: str, limit: int = 5) -> list[tuple[DocumentChunk, Document, float]]:
    query_embedding = embed_texts([question])[0]
    distance = DocumentChunk.embedding.cosine_distance(query_embedding).label("distance")
    rows = database.execute(
        select(DocumentChunk, Document, distance)
        .join(Document, Document.id == DocumentChunk.document_id)
        .where(Document.knowledge_base_id == knowledge_base_id, Document.status == "ready")
        .order_by(distance)
        .limit(limit)
    ).all()
    return [(chunk, document, float(value)) for chunk, document, value in rows]


def answer_question(database: Session, knowledge_base_id, question: str, history: list[dict[str, str]]) -> tuple[str, list[Citation]]:
    sources = retrieve(database, knowledge_base_id, question)
    citations = [Citation(document_id=document.id, filename=document.original_filename, chunk_index=chunk.chunk_index, excerpt=chunk.content[:280]) for chunk, document, _ in sources]
    context = "\n\n".join(f"[Source {index + 1}: {citation.filename}, chunk {citation.chunk_index}]\n{chunk.content}" for index, ((chunk, _, _), citation) in enumerate(zip(sources, citations, strict=True)))
    if not get_settings().groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured on the server.")
    messages = [{"role": "system", "content": "You are a precise retrieval-augmented assistant. Answer only from the supplied document context. If the context is insufficient, say so. Cite factual claims using [Source N]."}]
    messages.extend(history[-8:])
    messages.append({"role": "user", "content": f"Document context:\n{context or 'No indexed documents are available.'}\n\nQuestion: {question}"})
    response = Groq(api_key=get_settings().groq_api_key).chat.completions.create(model=get_settings().chat_model, messages=messages, temperature=0.2)
    return response.choices[0].message.content or "I could not generate an answer.", citations


def encode_citations(citations: list[Citation]) -> str:
    return json.dumps([citation.model_dump(mode="json") for citation in citations])


def decode_citations(value: str | None) -> list[Citation]:
    return [Citation.model_validate(item) for item in json.loads(value or "[]")]
