from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Document, ResearchSession, utc_now
from schemas import DocumentCreate, DocumentDetail, DocumentOut, SourceOut


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
