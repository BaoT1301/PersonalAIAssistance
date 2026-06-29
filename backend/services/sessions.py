from sqlalchemy import func, select
from sqlalchemy.orm import Session

from models import Message, ResearchResult, ResearchSession, utc_now
from schemas import DocumentOut, MessageOut, ResearchResultSummary, SessionDetail, SessionOut, SessionUpdate


class WorkspaceAccessError(ValueError):
    pass


DEFAULT_SESSION_TITLE = "New research session"


def create_session(db: Session, title: str | None = None, owner_id: str = "anonymous") -> ResearchSession:
    session = ResearchSession(title=title or DEFAULT_SESSION_TITLE, owner_id=owner_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_or_create_session(
    db: Session,
    session_id: str | None,
    owner_id: str,
    title: str | None = None,
) -> ResearchSession:
    if session_id:
        existing = db.get(ResearchSession, session_id)
        if existing:
            if existing.owner_id != owner_id:
                raise WorkspaceAccessError("Session not found")
            # A session created via document upload starts with the default title;
            # give it a meaningful name from the first real query.
            if title and existing.title == DEFAULT_SESSION_TITLE:
                existing.title = title
                db.add(existing)
                db.commit()
                db.refresh(existing)
            return existing
    return create_session(db, title, owner_id)


def add_message(db: Session, session: ResearchSession, role: str, content: str) -> Message:
    message = Message(session_id=session.id, role=role, content=content)
    session.updated_at = utc_now()
    db.add(message)
    db.add(session)
    db.commit()
    db.refresh(message)
    return message


def get_recent_history(db: Session, session_id: str, limit: int = 8) -> list[dict[str, str]]:
    stmt = (
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    messages = list(db.scalars(stmt))
    messages.reverse()
    return [{"role": item.role, "content": item.content} for item in messages]


def list_sessions(db: Session, owner_id: str) -> list[SessionOut]:
    # Single query with a left-join count — avoids N+1 lazy-loading of results
    count_sq = (
        select(ResearchResult.session_id, func.count(ResearchResult.id).label("cnt"))
        .group_by(ResearchResult.session_id)
        .subquery()
    )
    stmt = (
        select(ResearchSession, func.coalesce(count_sq.c.cnt, 0).label("result_count"))
        .outerjoin(count_sq, ResearchSession.id == count_sq.c.session_id)
        .where(ResearchSession.owner_id == owner_id)
        .order_by(ResearchSession.updated_at.desc())
    )
    return [
        SessionOut(
            id=row.ResearchSession.id,
            owner_id=row.ResearchSession.owner_id,
            title=row.ResearchSession.title,
            created_at=row.ResearchSession.created_at,
            updated_at=row.ResearchSession.updated_at,
            result_count=row.result_count,
        )
        for row in db.execute(stmt).all()
    ]


def update_session_title(db: Session, session_id: str, title: str, owner_id: str) -> SessionOut | None:
    session = db.get(ResearchSession, session_id)
    if not session or session.owner_id != owner_id:
        return None
    session.title = title.strip()
    session.updated_at = utc_now()
    db.commit()
    db.refresh(session)
    return SessionOut(
        id=session.id,
        owner_id=session.owner_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        result_count=len(session.results),
    )


def get_session_detail(db: Session, session_id: str, owner_id: str) -> SessionDetail | None:
    session = db.get(ResearchSession, session_id)
    if not session or session.owner_id != owner_id:
        return None
    return SessionDetail(
        id=session.id,
        owner_id=session.owner_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[
            MessageOut(id=item.id, role=item.role, content=item.content, created_at=item.created_at)
            for item in session.messages
        ],
        results=[
            ResearchResultSummary(
                id=item.id,
                session_id=item.session_id,
                query=item.query,
                confidence=item.confidence,
                cached=item.cached,
                latency_ms=item.latency_ms,
                source_count=len(item.sources),
                created_at=item.created_at,
            )
            for item in session.results
        ],
        documents=[
            DocumentOut(
                id=item.id,
                session_id=item.session_id,
                title=item.title,
                content_preview=" ".join(item.content_text.split())[:280],
                content_length=len(item.content_text),
                source_type=item.source_type,
                created_at=item.created_at,
            )
            for item in session.documents
        ],
    )


def delete_session(db: Session, session_id: str, owner_id: str) -> bool:
    session = db.get(ResearchSession, session_id)
    if not session or session.owner_id != owner_id:
        return False
    db.delete(session)
    db.commit()
    return True
