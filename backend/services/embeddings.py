from __future__ import annotations

import logging
from functools import lru_cache

from config import get_settings

logger = logging.getLogger("fusionai.embeddings")


@lru_cache(maxsize=1)
def _client():
    from openai import OpenAI

    return OpenAI(api_key=get_settings().openai_api_key, timeout=get_settings().openai_timeout_seconds)


def embed_texts(texts: list[str]) -> list[list[float]] | None:
    """Embed a batch of texts. Returns None if no API key is configured or the
    call fails, so callers can fall back gracefully."""
    settings = get_settings()
    if not settings.openai_api_key or not texts:
        return None
    try:
        response = _client().embeddings.create(model=settings.embedding_model, input=texts)
        return [item.embedding for item in response.data]
    except Exception as exc:  # noqa: BLE001 - embedding is best-effort
        logger.warning("embedding request failed: %s", exc)
        return None
