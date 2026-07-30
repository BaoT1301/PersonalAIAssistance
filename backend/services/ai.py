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
# Angle brackets (not dashes) so the model doesn't turn it into a markdown rule.
_STREAM_SENTINEL = "<<<FOLLOWUPS>>>"
# Detection is lenient: we match this invariant token and strip any decoration
# (dashes, angle brackets, asterisks, whitespace) the model wraps around it.
_MARKER = "FOLLOWUPS"
_MARKER_DECOR = set("<>-*#:· \t\r\n")


def _fallback_payload(
    query: str,
    reason: str | None = None,
    retrieved_sources: list[SourceOut] | None = None,
) -> AIResearchPayload:
    sources = retrieved_sources or [
        SourceOut(
            title="FusionAI fallback synthesis",
            snippet="Generated locally because the OpenAI API key is not configured.",
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
            "To enable full GPT-powered answers, configure a funded `OPENAI_API_KEY`."
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
            "search tools before asking GPT to synthesize the final answer.\n\n"
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
    from langchain_openai import ChatOpenAI
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
- Set tools_used to include "wikipedia", "search", and/or "openai" as appropriate.
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

    llm = ChatOpenAI(
        model=settings.openai_model,
        max_tokens=settings.max_tokens,
        api_key=settings.openai_api_key,
        timeout=settings.openai_timeout_seconds,
        max_retries=2,
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
    if not settings.openai_api_key:
        return _fallback_payload(query, "OPENAI_API_KEY is missing", retrieved_sources)

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
        # Some providers return a list of content blocks instead of a plain string
        if isinstance(output, list):
            output = " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in output
            )
        payload = _parse_output(str(output), parser)
        if retrieved_sources and not payload.sources:
            payload.sources = retrieved_sources
        if "openai" not in payload.tools_used:
            payload.tools_used.append("openai")
        return payload
    except Exception as exc:
        logger.warning("AI inference failed, using fallback: %s", exc)
        return _fallback_payload(query, str(exc), retrieved_sources)


# ─── Streaming ────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _get_stream_llm_and_prompt():
    """Streaming chain that writes a Markdown answer directly (no JSON wrapper)."""
    from langchain_openai import ChatOpenAI
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

Cite as you write: when a statement is supported by one of the numbered sources above,
add its number inline in square brackets, like [1] or [2], right after the statement.
Cite only sources that are actually listed, and never invent a citation number. If no
sources are provided, do not add any brackets.

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

    llm = ChatOpenAI(
        model=settings.openai_model,
        max_tokens=settings.max_tokens,
        api_key=settings.openai_api_key,
        timeout=settings.openai_timeout_seconds,
        max_retries=2,
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

    if not settings.openai_api_key:
        payload = _fallback_payload(query, "OPENAI_API_KEY is missing", sources or None)
        yield from _stream_static(payload.answer, payload.follow_up_questions)
        return

    try:
        prompt, llm = _get_stream_llm_and_prompt()
        chain = prompt | llm
        buffer = ""
        emitted = 0
        marker_found = False
        holdback = len(_MARKER) + 8  # never emit a forming marker or its decoration
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
            if marker_found:
                continue
            idx = buffer.find(_MARKER)
            if idx == -1:
                safe = len(buffer) - holdback
                if safe > emitted:
                    yield {"type": "token", "text": buffer[emitted:safe]}
                    emitted = safe
            else:
                answer_end = idx
                while answer_end > emitted and buffer[answer_end - 1] in _MARKER_DECOR:
                    answer_end -= 1
                if answer_end > emitted:
                    yield {"type": "token", "text": buffer[emitted:answer_end]}
                emitted = answer_end
                marker_found = True

        follow_ups: list[str] = []
        marker_idx = buffer.find(_MARKER)
        if marker_idx == -1:
            if len(buffer) > emitted:
                yield {"type": "token", "text": buffer[emitted:]}
            answer = buffer
        else:
            answer_end = marker_idx
            while answer_end > 0 and buffer[answer_end - 1] in _MARKER_DECOR:
                answer_end -= 1
            answer = buffer[:answer_end]
            tail = buffer[marker_idx + len(_MARKER):]
            follow_ups = [line.strip("-•*<>#: \t").strip() for line in tail.splitlines() if line.strip()]
            follow_ups = [f for f in follow_ups if len(f) > 3][:3]
        answer = answer.strip()
        yield {"type": "final", "answer": answer, "follow_up_questions": follow_ups}
    except Exception as exc:
        logger.warning("AI streaming failed, using fallback: %s", exc)
        payload = _fallback_payload(query, str(exc), sources or None)
        yield from _stream_static(payload.answer, payload.follow_up_questions)
