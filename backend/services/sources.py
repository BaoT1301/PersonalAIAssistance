from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor

from config import get_settings
from schemas import SourceOut

logger = logging.getLogger("fusionai.sources")

# Patterns that indicate a conversational message that doesn't need web search
_CONVERSATIONAL_PATTERNS = re.compile(
    r"^("
    r"hi+|hello+|hey+|howdy|greetings|sup|yo|"
    r"good\s+(morning|afternoon|evening|night)|"
    r"my name is|i('m| am) |i feel|i think|i want|i need|i like|i love|i hate|"
    r"thank(s| you)|thx|ty\b|"
    r"bye|goodbye|see you|cya|"
    r"yes|no|ok|okay|sure|alright|got it|understood|"
    r"what('s| is) your name|who are you|what can you do|help me|"
    r"nice|cool|great|awesome|wow|interesting"
    r")",
    re.IGNORECASE,
)


def needs_search(query: str) -> bool:
    """Return True if the query likely benefits from external web/wiki sources."""
    stripped = query.strip()
    # Very short messages are almost always conversational
    if len(stripped) < 10:
        return False
    # Match known conversational openers
    if _CONVERSATIONAL_PATTERNS.match(stripped):
        return False
    return True


def _trim(value: str | None, limit: int = 700) -> str:
    text = " ".join((value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def _dedupe_sources(sources: list[SourceOut]) -> list[SourceOut]:
    seen: set[tuple[str, str | None]] = set()
    unique: list[SourceOut] = []
    for source in sources:
        key = (source.title.lower().strip(), source.url)
        if key in seen:
            continue
        seen.add(key)
        unique.append(source)
    return unique


def lookup_wikipedia(query: str, max_results: int) -> list[SourceOut]:
    if max_results <= 0:
        return []

    try:
        import wikipedia

        titles = wikipedia.search(query, results=max_results)
        sources: list[SourceOut] = []
        for title in titles:
            try:
                page = wikipedia.page(title, auto_suggest=False)
                # page.summary is already fetched by page(); no extra HTTP call needed
                sources.append(
                    SourceOut(
                        title=page.title,
                        url=page.url,
                        snippet=_trim(page.summary),
                        source_type="wikipedia",
                    )
                )
            except Exception:
                continue
        return sources
    except Exception:
        return []


def lookup_web(query: str, max_results: int) -> list[SourceOut]:
    if max_results <= 0:
        return []

    try:
        from ddgs import DDGS

        sources: list[SourceOut] = []
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=max_results)
            for item in results:
                title = item.get("title") or item.get("source") or "Web result"
                url = item.get("href") or item.get("url")
                snippet = item.get("body") or item.get("snippet") or ""
                sources.append(
                    SourceOut(
                        title=_trim(title, 180),
                        url=url,
                        snippet=_trim(snippet),
                        source_type="web",
                    )
                )
        return sources
    except Exception:
        return []


def gather_sources(query: str) -> list[SourceOut]:
    settings = get_settings()
    if not settings.source_lookup_enabled:
        return []

    # Run Wikipedia and web search concurrently; bound each so a hung source
    # can't stall the request (and, on a sync route, the shared threadpool).
    timeout = settings.source_timeout_seconds
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {
            "wikipedia": pool.submit(lookup_wikipedia, query, settings.wikipedia_results),
            "web": pool.submit(lookup_web, query, settings.web_search_results),
        }
        sources: list[SourceOut] = []
        for name, future in futures.items():
            try:
                sources.extend(future.result(timeout=timeout))
            except Exception as exc:  # noqa: BLE001 - a slow/failed source is non-fatal
                logger.warning("source lookup '%s' failed or timed out: %s", name, exc)

    return _dedupe_sources(sources)


def source_context(sources: list[SourceOut]) -> str:
    if not sources:
        return "No external source context was available."

    blocks: list[str] = []
    for index, source in enumerate(sources, start=1):
        url = f"\nURL: {source.url}" if source.url else ""
        blocks.append(
            f"{index}. {source.title} ({source.source_type}){url}\nSnippet: {source.snippet}"
        )
    return "\n\n".join(blocks)
