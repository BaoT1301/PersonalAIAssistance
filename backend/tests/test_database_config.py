import importlib
import os
import sys
from pathlib import Path

from sqlalchemy import inspect


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))


def _reload_database_for_env(database_url: str, auto_create_tables: str):
    os.environ["DATABASE_URL"] = database_url
    os.environ["AUTO_CREATE_TABLES"] = auto_create_tables
    os.environ["ENVIRONMENT"] = "production"

    import config
    import database

    config.get_settings.cache_clear()
    importlib.reload(database)
    if "models" in sys.modules:
        importlib.reload(sys.modules["models"])
    return database


def test_init_db_can_skip_auto_create_tables(tmp_path):
    db_path = tmp_path / "no_auto_create.db"
    database = _reload_database_for_env(f"sqlite:///{db_path.as_posix()}", "false")

    database.init_db()

    inspector = inspect(database.engine)
    assert inspector.get_table_names() == []


def test_init_db_can_auto_create_tables(tmp_path):
    db_path = tmp_path / "auto_create.db"
    database = _reload_database_for_env(f"sqlite:///{db_path.as_posix()}", "true")

    database.init_db()

    inspector = inspect(database.engine)
    assert {"sessions", "messages", "research_results", "sources", "documents"}.issubset(
        set(inspector.get_table_names())
    )


def test_production_diagnostics_reject_sqlite_database(tmp_path):
    db_path = tmp_path / "production.db"
    database = _reload_database_for_env(f"sqlite:///{db_path.as_posix()}", "false")
    settings = database.get_settings()

    errors, warnings = settings.diagnostics()

    assert "Production DATABASE_URL should point to PostgreSQL, not SQLite." in errors
    assert "OPENAI_API_KEY is required in production." in errors
