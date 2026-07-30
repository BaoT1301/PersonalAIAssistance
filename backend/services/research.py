import logging
import re
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor, as_completed

from sqlalchemy import select
from sqlalchemy.orm import Session

from config import get_settings
from database import SessionLocal
from models import ResearchResult, ResearchSession, Source
from schemas import (
    AIResearchPayload,
    ChatResponse,
    ResearchResponse,
    ResearchResultDetail,
    ResearchResultSummary,
    SourceOut,
)
from services.ai import plan_subquestions, run_report_stream, run_research, run_research_stream
from services.cache import ResearchCache
from services.documents import document_cache_key, document_sources_for_session, retrieve_document_context
from services.sessions import WorkspaceAccessError, add_message, get_or_create_session, get_recent_history
from services.sources import gather_sources, needs_search
from services.text import normalize_query, title_from_query


logger = logging.getLogger("fusionai.research")
cache = ResearchCache()


def _payload_to_cache(payload: AIResearchPayload) -> dict:
    return payload.model_dump(mode="json")


def _payload_from_cache(data: dict) -> AIResearchPayload:
    return AIResearchPayload.model_validate(data)


def _persist_result(
    db: Session,
    session_id: str,
    query: str,
    payload: AIResearchPayload,
    cached: bool,
    latency_ms: int,
) -> ResearchResult:
    result = ResearchResult(
        session_id=session_id,
        query=query,
        answer=payload.answer,
        summary=payload.summary,
        confidence=payload.confidence,
        tools_used=payload.tools_used,
        cached=cached,
        latency_ms=latency_ms,
    )
    db.add(result)
    db.flush()

    for source in payload.sources:
        db.add(
            Source(
                research_result_id=result.id,
                title=source.title,
                url=source.url,
                snippet=source.snippet,
                source_type=source.source_type,
            )
        )

    db.commit()
    db.refresh(result)
    return result


def _source_strings(sources: list[SourceOut]) -> list[str]:
    values: list[str] = []
    for source in sources:
        label = source.title or source.source_type
        if source.url:
            label = f"{label} - {source.url}"
        if source.snippet:
            label = f"{label}: {source.snippet}"
        values.append(label)
    return values or ["FusionAI research synthesis"]


def _source_to_out(source: Source) -> SourceOut:
    return SourceOut(
        title=source.title,
        url=source.url,
        snippet=source.snippet,
        source_type=source.source_type,
    )


def result_to_summary(result: ResearchResult) -> ResearchResultSummary:
    return ResearchResultSummary(
        id=result.id,
        session_id=result.session_id,
        query=result.query,
        confidence=result.confidence,
        cached=result.cached,
        latency_ms=result.latency_ms,
        source_count=len(result.sources),
        created_at=result.created_at,
    )


def result_to_detail(result: ResearchResult) -> ResearchResultDetail:
    summary = result_to_summary(result)
    return ResearchResultDetail(
        **summary.model_dump(),
        answer=result.answer,
        summary=result.summary,
        tools_used=result.tools_used or [],
        citations=[_source_to_out(source) for source in result.sources],
    )


def get_research_result(db: Session, result_id: str, owner_id: str) -> ResearchResultDetail | None:
    result = db.get(ResearchResult, result_id)
    if not result or result.session.owner_id != owner_id:
        return None
    return result_to_detail(result)


def list_session_results(db: Session, session_id: str, owner_id: str) -> list[ResearchResultSummary] | None:
    session_exists = db.get(ResearchSession, session_id)
    if not session_exists or session_exists.owner_id != owner_id:
        return None
    stmt = (
        select(ResearchResult)
        .where(ResearchResult.session_id == session_id)
        .order_by(ResearchResult.created_at.desc())
    )
    return [result_to_summary(result) for result in db.scalars(stmt)]


def research_query(
    db: Session,
    query: str,
    session_id: str | None = None,
    owner_id: str = "anonymous",
) -> ResearchResponse:
    started = time.perf_counter()
    normalized_query = normalize_query(query)
    session = get_or_create_session(db, session_id, owner_id, title=title_from_query(query))
    add_message(db, session, "user", query)

    cached = False
    document_sources = document_sources_for_session(db, session.id)
    doc_key = document_cache_key(db, session.id)
    cache_mode = "research" if not doc_key else f"research:session:{session.id}:docs:{doc_key}"
    cached_payload = cache.get(normalized_query, mode=cache_mode)
    if cached_payload:
        payload = _payload_from_cache(cached_payload)
        cached = True
    else:
        history = get_recent_history(db, session.id)
        web_sources = gather_sources(query) if needs_search(query) else []
        sources = [*document_sources, *web_sources]
        payload = run_research(query, history, sources)
        if document_sources and "documents" not in payload.tools_used:
            payload.tools_used.append("documents")
        cache.set(normalized_query, _payload_to_cache(payload), mode=cache_mode)

    latency_ms = int((time.perf_counter() - started) * 1000)
    result = _persist_result(db, session.id, query, payload, cached, latency_ms)
    add_message(db, session, "assistant", payload.answer)

    return ResearchResponse(
        topic=query.strip(),
        answer=payload.answer,
        summary=payload.summary,
        sources=_source_strings(payload.sources),
        tools_used=payload.tools_used,
        confidence=payload.confidence,
        cached=cached,
        latency_ms=latency_ms,
        session_id=session.id,
        result_id=result.id,
        citations=payload.sources,
        follow_up_questions=payload.follow_up_questions,
    )


def chat_message(
    db: Session,
    message: str,
    session_id: str | None = None,
    owner_id: str = "anonymous",
) -> ChatResponse:
    response = research_query(db, message, session_id, owner_id)
    return ChatResponse(
        session_id=response.session_id or "",
        answer=response.answer or response.summary,
        sources=response.sources,
        tools_used=response.tools_used,
        confidence=response.confidence,
        cached=response.cached,
        latency_ms=response.latency_ms,
        result_id=response.result_id,
        citations=response.citations,
        follow_up_questions=response.follow_up_questions,
    )


# ─── Streaming ────────────────────────────────────────────────────────────────


def _plain_summary(answer: str, limit: int = 400) -> str:
    text = " ".join(answer.split())
    return text[:limit].rstrip() + ("…" if len(text) > limit else "")


def _confidence_reason(confidence: str, n_sources: int) -> str:
    if n_sources == 0:
        return "No external sources found. This answer draws on general model knowledge only."
    if confidence == "high":
        return f"Corroborated by {n_sources} sources."
    return f"Based on {n_sources} source{'s' if n_sources != 1 else ''}."


def _stream_text_events(text: str) -> Iterator[dict]:
    for part in re.split(r"(\s+)", text):
        if part:
            yield {"type": "token", "text": part}


def stream_research_events(
    query: str,
    session_id: str | None,
    owner_id: str,
) -> Iterator[dict]:
    """Generator of NDJSON-ready events driving the streaming chat experience.

    Manages its own DB session (StreamingResponse keeps generating after the
    request's dependency-injected session would have closed).
    """
    db = SessionLocal()
    try:
        started = time.perf_counter()
        normalized_query = normalize_query(query)
        try:
            session = get_or_create_session(db, session_id, owner_id, title=title_from_query(query))
        except WorkspaceAccessError:
            yield {"type": "error", "message": "Session not found"}
            return

        add_message(db, session, "user", query)
        yield {"type": "session", "session_id": session.id}

        doc_key = document_cache_key(db, session.id)
        cache_mode = "research" if not doc_key else f"research:session:{session.id}:docs:{doc_key}"

        cached_payload = cache.get(normalized_query, mode=cache_mode)
        if cached_payload:
            payload = _payload_from_cache(cached_payload)
            cached = True
            document_sources = []
            for event in _stream_text_events(payload.answer):
                yield event
        else:
            cached = False
            # Retrieve only the most relevant chunks of the user's documents.
            document_sources = retrieve_document_context(db, session.id, query)
            if needs_search(query):
                yield {"type": "status", "message": "Searching the web & Wikipedia…"}
                web_sources = gather_sources(query)
            else:
                web_sources = []
            sources = [*document_sources, *web_sources]

            yield {"type": "status", "message": "Synthesizing with GPT-4o mini…"}
            history = get_recent_history(db, session.id)

            answer_parts: list[str] = []
            follow_ups: list[str] = []
            for event in run_research_stream(query, history, sources):
                if event["type"] == "token":
                    answer_parts.append(event["text"])
                    yield event
                elif event["type"] == "final":
                    follow_ups = event.get("follow_up_questions", [])
                    if event.get("answer"):
                        answer_parts = [event["answer"]]

            answer = "".join(answer_parts).strip() or "No answer was generated."
            has_key = bool(get_settings().openai_api_key)
            tools_used: list[str] = []
            if any(s.source_type == "wikipedia" for s in sources):
                tools_used.append("wikipedia")
            if any(s.source_type == "web" for s in sources):
                tools_used.append("search")
            if document_sources:
                tools_used.append("documents")
            tools_used.append("openai" if has_key else "fallback")

            n_sources = len(sources)
            if not has_key:
                confidence = "low"
            elif n_sources >= 3:
                confidence = "high"
            elif n_sources >= 1:
                confidence = "medium"
            else:
                confidence = "low"

            payload = AIResearchPayload(
                answer=answer,
                summary=_plain_summary(answer),
                sources=sources,
                tools_used=tools_used,
                confidence=confidence,
                follow_up_questions=follow_ups,
            )
            cache.set(normalized_query, _payload_to_cache(payload), mode=cache_mode)

        latency_ms = int((time.perf_counter() - started) * 1000)
        result = _persist_result(db, session.id, query, payload, cached, latency_ms)
        add_message(db, session, "assistant", payload.answer)

        yield {
            "type": "done",
            "session_id": session.id,
            "result_id": result.id,
            "citations": [source.model_dump(mode="json") for source in payload.sources],
            "tools_used": payload.tools_used,
            "confidence": payload.confidence,
            "confidence_reason": _confidence_reason(payload.confidence, len(payload.sources)),
            "follow_up_questions": payload.follow_up_questions,
            "cached": cached,
            "latency_ms": latency_ms,
        }
    except Exception as exc:  # noqa: BLE001 — surface a clean error event to the client
        logger.exception("streaming research failed: %s", exc)
        yield {"type": "error", "message": str(exc)}
    finally:
        db.close()


def _dedupe_source_list(sources: list[SourceOut]) -> list[SourceOut]:
    seen: set[tuple[str, str | None]] = set()
    unique: list[SourceOut] = []
    for source in sources:
        key = (source.title.lower().strip(), source.url)
        if key in seen:
            continue
        seen.add(key)
        unique.append(source)
    return unique


def stream_deep_research_events(
    query: str,
    session_id: str | None,
    owner_id: str,
    max_sources: int = 12,
) -> Iterator[dict]:
    """Deep Research: plan sub-questions, search each in turn, then synthesize a
    single structured, cited report. Emits progress events (plan / step / status)
    around the same token/final/done contract as the single-shot stream, so the
    client renders a live checklist while the investigation runs.

    Not cached — every deep run is a fresh, multi-search investigation.
    """
    db = SessionLocal()
    try:
        started = time.perf_counter()
        try:
            session = get_or_create_session(db, session_id, owner_id, title=title_from_query(query))
        except WorkspaceAccessError:
            yield {"type": "error", "message": "Session not found"}
            return

        add_message(db, session, "user", query)
        yield {"type": "session", "session_id": session.id}
        has_key = bool(get_settings().openai_api_key)

        # 1. Plan — break the question into focused sub-questions.
        yield {"type": "status", "message": "Planning the investigation…"}
        subquestions = plan_subquestions(query)
        yield {"type": "plan", "steps": subquestions}
        search_targets = subquestions or [query]

        # 2. Retrieve the user's document context once for the overall question.
        document_sources = retrieve_document_context(db, session.id, query)
        aggregated: list[SourceOut] = list(document_sources)

        # 3. Search every sub-question concurrently, so total latency is roughly
        #    one search instead of N in series — important behind a single prod
        #    worker where sequential searches would risk a request timeout.
        results_by_index: dict[int, list[SourceOut]] = {}
        with ThreadPoolExecutor(max_workers=min(len(search_targets), 4)) as pool:
            future_to_index: dict = {}
            for index, sub in enumerate(search_targets):
                yield {"type": "step", "index": index, "total": len(search_targets), "label": sub, "state": "searching"}
                if needs_search(sub):
                    future_to_index[pool.submit(gather_sources, sub)] = index
                else:
                    results_by_index[index] = []
                    yield {"type": "step", "index": index, "total": len(search_targets), "label": sub, "state": "done", "found": 0}
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                try:
                    found = future.result()
                except Exception as exc:  # noqa: BLE001 — a failed search step is non-fatal
                    logger.warning("deep search step %d failed: %s", index, exc)
                    found = []
                results_by_index[index] = found
                yield {
                    "type": "step",
                    "index": index,
                    "total": len(search_targets),
                    "label": search_targets[index],
                    "state": "done",
                    "found": len(found),
                }

        # Merge in sub-question order for a deterministic, de-duplicated source list.
        for index in range(len(search_targets)):
            aggregated.extend(results_by_index.get(index, []))
        aggregated = _dedupe_source_list(aggregated)
        sources = aggregated[:max_sources]

        # 4. Synthesize the report, streaming tokens to the client.
        yield {"type": "status", "message": "Writing the report…"}
        history = get_recent_history(db, session.id)
        answer_parts: list[str] = []
        follow_ups: list[str] = []
        for event in run_report_stream(query, subquestions, sources, history):
            if event["type"] == "token":
                answer_parts.append(event["text"])
                yield event
            elif event["type"] == "final":
                follow_ups = event.get("follow_up_questions", [])
                if event.get("answer"):
                    answer_parts = [event["answer"]]

        answer = "".join(answer_parts).strip() or "No report was generated."
        tools_used: list[str] = []
        if any(s.source_type == "wikipedia" for s in sources):
            tools_used.append("wikipedia")
        if any(s.source_type == "web" for s in sources):
            tools_used.append("search")
        if document_sources:
            tools_used.append("documents")
        tools_used.append("deep-research")
        tools_used.append("openai" if has_key else "fallback")

        n_sources = len(sources)
        if not has_key:
            confidence = "low"
        elif n_sources >= 3:
            confidence = "high"
        elif n_sources >= 1:
            confidence = "medium"
        else:
            confidence = "low"

        payload = AIResearchPayload(
            answer=answer,
            summary=_plain_summary(answer),
            sources=sources,
            tools_used=tools_used,
            confidence=confidence,
            follow_up_questions=follow_ups,
        )

        latency_ms = int((time.perf_counter() - started) * 1000)
        result = _persist_result(db, session.id, query, payload, False, latency_ms)
        add_message(db, session, "assistant", payload.answer)

        yield {
            "type": "done",
            "session_id": session.id,
            "result_id": result.id,
            "citations": [source.model_dump(mode="json") for source in payload.sources],
            "tools_used": payload.tools_used,
            "confidence": payload.confidence,
            "confidence_reason": _confidence_reason(payload.confidence, len(payload.sources)),
            "follow_up_questions": payload.follow_up_questions,
            "cached": False,
            "latency_ms": latency_ms,
            "deep": True,
        }
    except Exception as exc:  # noqa: BLE001 — surface a clean error event to the client
        logger.exception("deep research failed: %s", exc)
        yield {"type": "error", "message": str(exc)}
    finally:
        db.close()
