import os
from dataclasses import dataclass, field
from functools import lru_cache

from dotenv import load_dotenv


load_dotenv()


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_name: str = field(default_factory=lambda: os.getenv("APP_NAME", "FusionAI"))
    environment: str = field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    port: int = field(default_factory=lambda: _env_int("PORT", 5001))
    default_workspace_id: str = field(default_factory=lambda: os.getenv("DEFAULT_WORKSPACE_ID", "anonymous"))
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    request_logging_enabled: bool = field(default_factory=lambda: _env_bool("REQUEST_LOGGING_ENABLED", True))

    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_model: str = field(
        default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    )
    max_tokens: int = field(default_factory=lambda: _env_int("MAX_TOKENS", 2000))

    # When set, the API trusts identity ONLY from a gateway that presents this
    # secret (via X-Gateway-Secret) and reads the user from X-Fusion-User.
    # Empty (default) keeps the legacy behavior of trusting the workspace header.
    gateway_shared_secret: str = field(default_factory=lambda: os.getenv("GATEWAY_SHARED_SECRET", ""))

    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./fusionai.db"))
    auto_create_tables: bool = field(
        default_factory=lambda: _env_bool(
            "AUTO_CREATE_TABLES",
            os.getenv("ENVIRONMENT", "development").lower() != "production",
        )
    )
    run_migrations_on_start: bool = field(
        default_factory=lambda: _env_bool(
            "RUN_MIGRATIONS_ON_START",
            os.getenv("ENVIRONMENT", "development").lower() == "production",
        )
    )
    redis_url: str = field(default_factory=lambda: os.getenv("REDIS_URL", ""))
    cache_ttl_seconds: int = field(default_factory=lambda: _env_int("CACHE_TTL_SECONDS", 1800))
    local_cache_enabled: bool = field(default_factory=lambda: _env_bool("LOCAL_CACHE_ENABLED", True))

    source_lookup_enabled: bool = field(default_factory=lambda: _env_bool("SOURCE_LOOKUP_ENABLED", True))
    wikipedia_results: int = field(default_factory=lambda: _env_int("WIKIPEDIA_RESULTS", 1))
    web_search_results: int = field(default_factory=lambda: _env_int("WEB_SEARCH_RESULTS", 3))
    source_timeout_seconds: int = field(default_factory=lambda: _env_int("SOURCE_TIMEOUT_SECONDS", 6))
    openai_timeout_seconds: int = field(default_factory=lambda: _env_int("OPENAI_TIMEOUT_SECONDS", 60))

    # Retrieval-augmented generation over uploaded documents.
    rag_enabled: bool = field(default_factory=lambda: _env_bool("RAG_ENABLED", True))
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
    rag_chunk_size: int = field(default_factory=lambda: _env_int("RAG_CHUNK_SIZE", 800))
    rag_chunk_overlap: int = field(default_factory=lambda: _env_int("RAG_CHUNK_OVERLAP", 120))
    rag_top_k: int = field(default_factory=lambda: _env_int("RAG_TOP_K", 4))
    max_upload_bytes: int = field(default_factory=lambda: _env_int("MAX_UPLOAD_BYTES", 5242880))
    max_document_chars: int = field(default_factory=lambda: _env_int("MAX_DOCUMENT_CHARS", 50000))

    frontend_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            _split_csv(
                os.getenv(
                    "FRONTEND_ORIGINS",
                    "http://localhost:3000,http://127.0.0.1:3000",
                )
            )
        )
    )

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def diagnostics(self) -> tuple[list[str], list[str]]:
        errors: list[str] = []
        warnings: list[str] = []

        if not 1 <= self.port <= 65535:
            errors.append("PORT must be between 1 and 65535.")
        if not self.default_workspace_id.strip():
            errors.append("DEFAULT_WORKSPACE_ID cannot be empty.")
        if len(self.default_workspace_id) > 120:
            errors.append("DEFAULT_WORKSPACE_ID must be 120 characters or fewer.")
        if self.max_tokens < 256:
            warnings.append("MAX_TOKENS is very low; answers may be truncated.")
        if self.cache_ttl_seconds < 0:
            errors.append("CACHE_TTL_SECONDS cannot be negative.")
        if self.max_upload_bytes < 1024:
            errors.append("MAX_UPLOAD_BYTES must allow at least 1KB uploads.")
        if self.max_document_chars < 1000:
            warnings.append("MAX_DOCUMENT_CHARS is low for document-backed research.")
        if not self.openai_api_key:
            if self.is_production:
                errors.append("OPENAI_API_KEY is required in production.")
            else:
                warnings.append("OPENAI_API_KEY is missing; local fallback answers will be used.")

        if self.is_production:
            if self.database_url.startswith("sqlite"):
                errors.append("Production DATABASE_URL should point to PostgreSQL, not SQLite.")
            if not self.frontend_origins or "*" in self.frontend_origins:
                errors.append("FRONTEND_ORIGINS must be explicit in production.")
            if self.auto_create_tables and not self.run_migrations_on_start:
                warnings.append("AUTO_CREATE_TABLES is enabled in production; Alembic migrations are preferred.")

        return errors, warnings


@lru_cache
def get_settings() -> Settings:
    return Settings()
