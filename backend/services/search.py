from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from models import ResearchResult, ResearchSession
from schemas import SessionOut


def search_sessions(db: Session, owner_id: str, query: str, limit: int = 30) -> list[SessionOut]:
    """Full-text-ish search across a user's session titles and the questions
    they asked, returning matching sessions newest-first."""
    q = query.strip()
    if not q:
        return []
    like = f"%{q}%"
    sessions_with_matching_query = (
        select(ResearchResult.session_id).where(ResearchResult.query.ilike(like))
    )
    stmt = (
        select(ResearchSession)
        .where(ResearchSession.owner_id == owner_id)
        .where(or_(
            ResearchSession.title.ilike(like),
            ResearchSession.id.in_(sessions_with_matching_query),
        ))
        .order_by(ResearchSession.updated_at.desc())
        .limit(limit)
    )
    return [
        SessionOut(
            id=session.id,
            owner_id=session.owner_id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            result_count=len(session.results),
        )
        for session in db.scalars(stmt)
    ]
