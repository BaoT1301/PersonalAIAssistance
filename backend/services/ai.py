from __future__ import annotations

import logging
import re
from collections.abc import Iterator, Sequence
from functools import lru_cache

from config import get_settings
from schemas import AIResearchPayload, SourceOut
from services.sources import source_context

logger = logging.getLogger("fusionai.ai")

# Marker the streaming prompt emits between the answer body and follow-up questions.
_STREAM_SENTINEL = "---FOLLOWUPS---"


def _fallback_payload(
    query: str,
    reason: str | None = None,
    retrieved_sources: list[SourceOut] | None = None,
) -> AIResearchPayload:
    sources = retrieved_sources or [
        SourceOut(
            title="FusionAI fallback synthesis",
            snippet="Generated locally because the Anthropic API key is not configured.",
            source_type="system",
        )
    ]
    note = f" Local AI execution was skipped because {reason}." if reason else ""
    source_note = (
        f" FusionAI attached {len(sources)} retrieved source(s) for citation tracking."
        if retrieved_sources
        else ""
    )
    return AIResearchPayload(
        answer=(
            "**FusionAI is running in fallback mode.**\n\n"
            f"Your question — _{query.strip()}_ — can be researched through a structured workflow "
            "that combines source discovery, evidence extraction, synthesis, and citation tracking."
            f"{note}{source_note}\n\n"
            "To enable full Claude-powered answers, configure a funded `ANTHROPIC_API_KEY`."
        ),
        summary=(
            f"1. Research Focus\n"
            f"   - The requested topic is: {query}.\n"
            "   - FusionAI prepares this kind of request by retrieving supporting context, "
            "checking available sources, and producing a structured response.\n\n"
            "2. Backend Workflow\n"
            "   - The API validates the query, checks the cache, creates or updates a research "
            "session, and stores the user and assistant messages.\n"
            "   - When the model API key is available, LangChain coordinates Wikipedia and web "
            "search tools before asking Claude to synthesize the final answer.\n\n"
            "3. Production Behavior\n"
            "   - PostgreSQL persistence keeps session history and research results available "
            "across requests.\n"
            "   - Optional Redis caching can serve repeated queries faster without changing the "
            "public API contract."
        ),
        key_points=[
            "Validated query intake",
            "Session-backed research history",
            "Structured AI response contract",
            "PostgreSQL persistence with optional Redis caching",
        ],
        sources=sources,
        tools_used=["fallback", "source-retrieval", "postgresql-ready"],
        confidence="medium",
        follow_up_questions=[
            "Can you summarize the key points?",
            "What are the main limitations or counterarguments?",
            "What related topics should I explore next?",
        ],
    )


@lru_cache(maxsize=1)
def _get_llm_and_prompt():
    """Build the LLM and prompt once per process and cache them."""
    from langchain_anthropic import ChatAnthropic
    from langchain_core.output_parsers import PydanticOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    settings = get_settings()
    parser = PydanticOutputParser(pydantic_object=AIResearchPayload)
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are FusionAI, a concise but comprehensive research assistant.

Use the retrieved source context below to write an accurate, well-sourced answer.
Prefer useful evidence over filler. Do not invent facts not present in the context.

Formatting rules:
- Return ONLY valid JSON that matches the schema — no markdown fences around the JSON, no extra text.
- The "answer" field should be well-formatted Markdown: use short paragraphs, **bold** for
  key terms, bullet or numbered lists where helpful, and `inline code` or fenced code blocks
  for code. Use second-level headings (##) only when the answer has clearly distinct sections.
- The "summary" field must stay plain text (a few sentences, no markdown).
- Include source objects for every source that informs the answer.
- Set tools_used to include "wikipedia", "search", and/or "claude" as appropriate.
- Confidence must be exactly one of: low, medium, or high.

Retrieved source context:
{retrieved_context}

Chat history:
{chat_history}

{format_instructions}""",
            ),
            ("human", "{query}"),
        ]
    ).partial(format_instructions=parser.get_format_instructions())

    llm = ChatAnthropic(
        model=settings.anthropic_model,
        max_tokens=settings.max_tokens,
        api_key=settings.anthropic_api_key,
    )
    return prompt, llm, parser


def _parse_output(text: str, parser) -> AIResearchPayload:
    text = text.replace("```json", "").replace("```", "").strip()
    try:
        return parser.parse(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return AIResearchPayload.model_validate_json(text[start:end])
        raise


def run_research(
    query: str,
    chat_history: Sequence[dict[str, str]] | None = None,
    retrieved_sources: list[SourceOut] | None = None,
) -> AIResearchPayload:
    settings = get_settings()
    if not settings.anthropic_api_key:
        return _fallback_payload(query, "ANTHROPIC_API_KEY is missing", retrieved_sources)

    prompt, llm, parser = _get_llm_and_prompt()
    chain = prompt | llm

    history_text = "\n".join(
        f"{item.get('role', 'user')}: {item.get('content', '')}"
        for item in (chat_history or [])[-8:]
    )

    try:
        response = chain.invoke(
            {
                "query": query,
                "chat_history": history_text,
                "retrieved_context": source_context(retrieved_sources or []),
            }
        )
        output = response.content
        # Claude occasionally returns a list of content blocks instead of a plain string
        if isinstance(output, list):
            output = " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in output
            )
        payload = _parse_output(str(output), parser)
        if retrieved_sources and not payload.sources:
            payload.sources = retrieved_sources
        if "claude" not in payload.tools_used:
            payload.tools_used.append("claude")
        return payload
    except Exception as exc:
        logger.warning("AI inference failed, using fallback: %s", exc)
        return _fallback_payload(query, str(exc), retrieved_sources)


# ─── Streaming ────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _get_stream_llm_and_prompt():
    """Streaming chain that writes a Markdown answer directly (no JSON wrapper)."""
    from langchain_anthropic import ChatAnthropic
    from langchain_core.prompts import ChatPromptTemplate

    settings = get_settings()
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                """You are FusionAI, a concise but comprehensive research assistant.

Use the retrieved source context below to write an accurate, well-sourced answer.
Prefer useful evidence over filler. Do not invent facts not present in the context.

Write the answer as clean Markdown: short paragraphs, **bold** for key terms, bullet or
numbered lists where helpful, and `inline code` or fenced code blocks for code. Use
second-level headings (##) only when the answer clearly has multiple sections.

After the answer, output a line containing exactly {sentinel} and then up to three short,
specific follow-up questions the user might ask next — one per line, no numbering.

Retrieved source context:
{retrieved_context}

Chat history:
{chat_history}""",
            ),
            ("human", "{query}"),
        ]
    ).partial(sentinel=_STREAM_SENTINEL)

    llm = ChatAnthropic(
        model=settings.anthropic_model,
        max_tokens=settings.max_tokens,
        api_key=settings.anthropic_api_key,
    )
    return prompt, llm


def _stream_static(answer: str, follow_ups: list[str]) -> Iterator[dict]:
    """Emit a fixed answer as token events (used for fallback / offline mode)."""
    for part in re.split(r"(\s+)", answer):
        if part:
            yield {"type": "token", "text": part}
    yield {"type": "final", "answer": answer, "follow_up_questions": follow_ups or []}


def run_research_stream(
    query: str,
    chat_history: Sequence[dict[str, str]] | None = None,
    retrieved_sources: list[SourceOut] | None = None,
) -> Iterator[dict]:
    """Yield {'type':'token','text':...} events, then one {'type':'final', ...}."""
    settings = get_settings()
    sources = retrieved_sources or []
    history_text = "\n".join(
        f"{item.get('role', 'user')}: {item.get('content', '')}"
        for item in (chat_history or [])[-8:]
    )

    if not settings.anthropic_api_key:
        payload = _fallback_payload(query, "ANTHROPIC_API_KEY is missing", sources or None)
        yield from _stream_static(payload.answer, payload.follow_up_questions)
        return

    try:
        prompt, llm = _get_stream_llm_and_prompt()
        chain = prompt | llm
        buffer = ""
        emitted = 0
        sentinel_found = False
        for chunk in chain.stream(
            {"query": query, "chat_history": history_text, "retrieved_context": source_context(sources)}
        ):
            piece = chunk.content
            if isinstance(piece, list):
                piece = "".join(
                    block.get("text", "") if isinstance(block, dict) else str(block) for block in piece
                )
            if not piece:
                continue
            buffer += piece
            if sentinel_found:
                continue
            idx = buffer.find(_STREAM_SENTINEL)
            if idx == -1:
                # Hold back the tail in case the sentinel is split across chunks.
                safe = len(buffer) - len(_STREAM_SENTINEL)
                if safe > emitted:
                    yield {"type": "token", "text": buffer[emitted:safe]}
                    emitted = safe
            else:
                if idx > emitted:
                    yield {"type": "token", "text": buffer[emitted:idx]}
                emitted = idx
                sentinel_found = True

        answer, separator, tail = buffer.partition(_STREAM_SENTINEL)
        if not separator and len(buffer) > emitted:
            yield {"type": "token", "text": buffer[emitted:]}
        answer = answer.strip()
        follow_ups: list[str] = []
        if separator:
            follow_ups = [line.strip("-•* \t").strip() for line in tail.splitlines() if line.strip()][:3]
        yield {"type": "final", "answer": answer, "follow_up_questions": follow_ups}
    except Exception as exc:
        logger.warning("AI streaming failed, using fallback: %s", exc)
        payload = _fallback_payload(query, str(exc), sources or None)
        yield from _stream_static(payload.answer, payload.follow_up_questions)
