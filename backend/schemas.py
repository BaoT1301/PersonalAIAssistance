from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class HealthResponse(BaseModel):
    status: str
    message: str
    database: str
    database_connected: bool
    cache: str
    environment: str
    version: str = "2.0.0"
    uptime_seconds: int = 0
    warnings: list[str] = Field(default_factory=list)


class ReadinessResponse(BaseModel):
    status: str
    database_connected: bool
    cache: str
    environment: str
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class SourceOut(BaseModel):
    title: str = "Source"
    url: str | None = None
    snippet: str = ""
    source_type: str = "research"


class ResearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1200)
    session_id: str | None = None
    # When true, run the multi-step "Deep Research" workflow (plan sub-questions
    # → search each → synthesize a structured, cited report) instead of a single
    # streamed answer. Rides the same streaming endpoint.
    deep: bool = False

    @field_validator("query")
    @classmethod
    def query_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("query must not be blank")
        return v


class ResearchResponse(BaseModel):
    topic: str
    answer: str | None = None
    summary: str
    sources: list[str] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    confidence: str = "medium"
    cached: bool = False
    latency_ms: int = 0
    session_id: str | None = None
    result_id: str | None = None
    citations: list[SourceOut] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1200)
    session_id: str | None = None

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be blank")
        return v


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    sources: list[str] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    confidence: str = "medium"
    cached: bool = False
    latency_ms: int = 0
    result_id: str | None = None
    citations: list[SourceOut] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)


class AuthCredentials(BaseModel):
    username: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=1, max_length=200)


class AuthResponse(BaseModel):
    token: str
    username: str


class SessionCreate(BaseModel):
    title: str | None = Field(default=None, max_length=180)


class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=240)
    content: str = Field(..., min_length=20, max_length=50000)
    source_type: str = Field(default="document", max_length=40)


class DocumentOut(BaseModel):
    id: str
    session_id: str
    title: str
    content_preview: str
    content_length: int
    source_type: str
    created_at: datetime


class DocumentDetail(DocumentOut):
    content_text: str


class MessageOut(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime


class SessionUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=180)


class SessionOut(BaseModel):
    id: str
    owner_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    result_count: int = 0


class ResearchResultSummary(BaseModel):
    id: str
    session_id: str
    query: str
    confidence: str
    cached: bool
    latency_ms: int
    source_count: int
    created_at: datetime


class ResearchResultDetail(ResearchResultSummary):
    answer: str
    summary: str
    tools_used: list[str] = Field(default_factory=list)
    citations: list[SourceOut] = Field(default_factory=list)


class SessionDetail(SessionOut):
    messages: list[MessageOut] = Field(default_factory=list)
    results: list[ResearchResultSummary] = Field(default_factory=list)
    documents: list[DocumentOut] = Field(default_factory=list)


class InsightsResponse(BaseModel):
    total_sessions: int
    total_queries: int
    total_documents: int
    confidence_breakdown: dict[str, int]
    top_tools: list[dict]
    avg_latency_ms: float
    cache_hit_rate: float
    recent_activity: list[dict]


class AIResearchPayload(BaseModel):
    answer: str
    summary: str
    key_points: list[str] = Field(default_factory=list)
    sources: list[SourceOut] = Field(default_factory=list)
    tools_used: list[str] = Field(default_factory=list)
    confidence: str = "medium"
    follow_up_questions: list[str] = Field(default_factory=list)
