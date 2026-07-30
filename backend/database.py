from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from config import get_settings


Base = declarative_base()


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg2://", 1)
    if url.startswith("postgresql://") and "+psycopg" not in url:
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


settings = get_settings()
database_url = _normalize_database_url(settings.database_url)
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}

engine_kwargs = {"pool_pre_ping": True, "connect_args": connect_args}
if not database_url.startswith("sqlite"):
    # Tune the pool for real concurrent Postgres load (ignored by SQLite).
    engine_kwargs.update(pool_size=10, max_overflow=20, pool_recycle=1800)
engine = create_engine(database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    from models import Document, DocumentChunk, Message, ResearchResult, ResearchSession, Source

    _ = (Document, DocumentChunk, Message, ResearchResult, ResearchSession, Source)
    if not settings.auto_create_tables:
        return
    Base.metadata.create_all(bind=engine)


def database_type() -> str:
    if database_url.startswith(("postgres", "postgresql")):
        return "postgresql"
    if database_url.startswith("sqlite"):
        return "sqlite"
    return "unknown"


def check_database() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
