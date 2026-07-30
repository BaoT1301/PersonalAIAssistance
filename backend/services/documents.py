import json
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import get_settings
from models import Document, DocumentChunk, ResearchSession, utc_now
from schemas import DocumentCreate, DocumentDetail, DocumentOut, SourceOut

logger = logging.getLogger("fusionai.documents")


def _preview(content: str, limit: int = 280) -> str:
    text = " ".join(content.split())
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def _snippet(content: str, limit: int = 1200) -> str:
    text = " ".join(content.split())
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def document_to_out(document: Document) -> DocumentOut:
    return DocumentOut(
        id=document.id,
        session_id=document.session_id,
        title=document.title,
        content_preview=_preview(document.content_text),
        content_length=len(document.content_text),
        source_type=document.source_type,
        created_at=document.created_at,
    )


def add_document(db: Session, session_id: str, payload: DocumentCreate, owner_id: str) -> DocumentOut | None:
    session = db.get(ResearchSession, session_id)
    if not session or session.owner_id != owner_id:
        return None

    document = Document(
        session_id=session.id,
        title=payload.title.strip(),
        content_text=payload.content.strip(),
        source_type=payload.source_type.strip() or "document",
    )
    session.updated_at = utc_now()
    db.add(document)
    db.add(session)
    db.commit()
    db.refresh(document)
    return document_to_out(document)


def list_documents(db: Session, session_id: str, owner_id: str) -> list[DocumentOut] | None:
    session = db.get(ResearchSession, session_id)
    if not session or session.owner_id != owner_id:
        return None
    stmt = select(Document).where(Document.session_id == session_id).order_by(Document.created_at.desc())
    return [document_to_out(document) for document in db.scalars(stmt)]


def get_document(db: Session, document_id: str, owner_id: str) -> DocumentDetail | None:
    document = db.get(Document, document_id)
    if not document or not document.session or document.session.owner_id != owner_id:
        return None
    out = document_to_out(document)
    return DocumentDetail(**out.model_dump(), content_text=document.content_text)


def delete_document(db: Session, document_id: str, owner_id: str) -> bool:
    document = db.get(Document, document_id)
    if not document or not document.session or document.session.owner_id != owner_id:
        return False
    db.delete(document)
    db.commit()
    return True


def list_owner_documents(db: Session, owner_id: str) -> list[DocumentOut]:
    """Every document the user has uploaded, across all their sessions."""
    stmt = (
        select(Document)
        .join(ResearchSession, Document.session_id == ResearchSession.id)
        .where(ResearchSession.owner_id == owner_id)
        .order_by(Document.created_at.desc())
    )
    return [document_to_out(document) for document in db.scalars(stmt)]


def reuse_document(db: Session, document_id: str, target_session_id: str, owner_id: str) -> DocumentOut | None:
    """Copy an existing document (from any of the user's sessions) into another
    session, so uploads can be reused without re-uploading."""
    source = db.get(Document, document_id)
    if not source or not source.session or source.session.owner_id != owner_id:
        return None
    payload = DocumentCreate(
        title=source.title,
        content=source.content_text,
        source_type=source.source_type or "document",
    )
    return add_document(db, target_session_id, payload, owner_id)


def index_document(document_id: str) -> None:
    """Chunk a document and store per-chunk embeddings for retrieval. Runs with
    its own DB session so it can be offloaded to a threadpool. No-ops if there's
    no API key (retrieval then falls back to whole-document context)."""
    from database import SessionLocal
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from services.embeddings import embed_texts

    settings = get_settings()
    if not settings.rag_enabled:
        return
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if not document or not document.content_text.strip():
            return
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.rag_chunk_size,
            chunk_overlap=settings.rag_chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        chunks = [c for c in splitter.split_text(document.content_text) if c.strip()]
        if not chunks:
            return
        vectors = embed_texts(chunks)
        if not vectors:
            return  # no key or failure: leave unindexed, retrieval falls back
        db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
        for index, (content, vector) in enumerate(zip(chunks, vectors)):
            db.add(DocumentChunk(
                document_id=document.id,
                session_id=document.session_id,
                chunk_index=index,
                content=content,
                embedding=json.dumps(vector),
            ))
        db.commit()
        logger.info("indexed document %s into %d chunks", document.id, len(chunks))
    except Exception as exc:  # noqa: BLE001
        logger.warning("failed to index document %s: %s", document_id, exc)
        db.rollback()
    finally:
        db.close()


def retrieve_document_context(db: Session, session_id: str, query: str) -> list[SourceOut]:
    """Return the most relevant document chunks for the query (top-k by cosine
    similarity), falling back to whole-document context if nothing is indexed."""
    settings = get_settings()
    if not settings.rag_enabled:
        return document_sources_for_session(db, session_id)

    chunks = list(db.scalars(select(DocumentChunk).where(DocumentChunk.session_id == session_id)))
    if not chunks:
        return document_sources_for_session(db, session_id)

    import numpy as np

    from services.embeddings import embed_texts

    query_vectors = embed_texts([query])
    if not query_vectors:
        return document_sources_for_session(db, session_id)

    q = np.asarray(query_vectors[0], dtype=float)
    q_norm = float(np.linalg.norm(q)) or 1.0

    scored: list[tuple[float, DocumentChunk]] = []
    for chunk in chunks:
        try:
            v = np.asarray(json.loads(chunk.embedding), dtype=float)
        except Exception:  # noqa: BLE001
            continue
        denom = q_norm * (float(np.linalg.norm(v)) or 1.0)
        scored.append((float(np.dot(q, v) / denom), chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    top = scored[: settings.rag_top_k]

    docs: dict[str, Document | None] = {}
    sources: list[SourceOut] = []
    for _, chunk in top:
        if chunk.document_id not in docs:
            docs[chunk.document_id] = db.get(Document, chunk.document_id)
        document = docs[chunk.document_id]
        sources.append(SourceOut(
            title=f"Document: {document.title}" if document else "Document",
            url=None,
            snippet=_snippet(chunk.content),
            source_type=(document.source_type if document else "document") or "document",
        ))
    return sources


def document_sources_for_session(db: Session, session_id: str) -> list[SourceOut]:
    stmt = select(Document).where(Document.session_id == session_id).order_by(Document.created_at.asc())
    sources: list[SourceOut] = []
    for document in db.scalars(stmt):
        sources.append(
            SourceOut(
                title=f"Document: {document.title}",
                url=None,
                snippet=_snippet(document.content_text),
                source_type=document.source_type or "document",
            )
        )
    return sources


def document_cache_key(db: Session, session_id: str) -> str:
    stmt = select(Document).where(Document.session_id == session_id).order_by(Document.id.asc())
    parts = [f"{document.id}:{len(document.content_text)}" for document in db.scalars(stmt)]
    return "|".join(parts)
