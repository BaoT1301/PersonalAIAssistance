import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from config import get_settings  # noqa: E402
from database import check_database, database_type  # noqa: E402
from services.research import cache  # noqa: E402


def _mask(value: str) -> str:
    if not value:
        return "missing"
    return "set"


def main() -> int:
    settings = get_settings()
    db_ok = check_database()
    errors, warnings = settings.diagnostics()

    checks = [
        ("environment", settings.environment),
        ("port", str(settings.port)),
        ("run_migrations_on_start", "yes" if settings.run_migrations_on_start else "no"),
        ("database_type", database_type()),
        ("database_connected", "yes" if db_ok else "no"),
        ("auto_create_tables", "yes" if settings.auto_create_tables else "no"),
        ("openai_api_key", _mask(settings.openai_api_key)),
        ("cache", cache.status),
        ("source_lookup_enabled", "yes" if settings.source_lookup_enabled else "no"),
        ("frontend_origins", ",".join(settings.frontend_origins) or "not configured"),
    ]

    print("FusionAI backend doctor")
    print("-" * 28)
    for name, value in checks:
        print(f"{name}: {value}")

    for warning in warnings:
        print(f"warning: {warning}")

    if errors:
        print("\nConfiguration check failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    if not db_ok:
        print("\nDatabase check failed. Verify DATABASE_URL and network access.")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
