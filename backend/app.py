from contextlib import asynccontextmanager
import logging
import time
from uuid import uuid4

import uvicorn
from fastapi import Request, Response
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
import json

from config import get_settings
from database import check_database, database_type, get_db, init_db
from schemas import (
    ChatRequest,
    ChatResponse,
    DocumentCreate,
    DocumentDetail,
    DocumentOut,
    HealthResponse,
    InsightsResponse,
    ReadinessResponse,
    ResearchRequest,
    ResearchResponse,
    ResearchResultDetail,
    ResearchResultSummary,
    SessionCreate,
    SessionDetail,
    SessionOut,
    SessionUpdate,
)
from services.documents import add_document, delete_document, get_document, list_documents
from services.insights import get_insights
from services.operations import run_migrations
from services.research import (
    cache,
    chat_message,
    get_research_result,
    list_session_results,
    research_query,
    stream_research_events,
)
from services.sessions import WorkspaceAccessError, create_session, delete_session, get_session_detail, list_sessions, update_session_title
from services.uploads import DocumentUploadError, document_from_upload


settings = get_settings()
APP_VERSION = "2.1.0"
STARTED_AT = time.time()


def configure_logging() -> None:
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


configure_logging()
logger = logging.getLogger("fusionai.api")


def get_workspace_id(request: Request) -> str:
    workspace_id = request.headers.get("x-fusion-workspace-id", settings.default_workspace_id).strip()
    if not workspace_id:
        workspace_id = settings.default_workspace_id
    if len(workspace_id) > 120:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Workspace id is too long")
    return workspace_id


@asynccontextmanager
async def lifespan(_: FastAPI):
    errors, warnings = settings.diagnostics()
    for warning in warnings:
        logger.warning("configuration warning: %s", warning)
    if errors:
        for error in errors:
            logger.error("configuration error: %s", error)
        raise RuntimeError("Invalid FusionAI backend configuration: " + "; ".join(errors))
    if settings.run_migrations_on_start:
        logger.info("running Alembic migrations before startup")
        try:
            run_migrations()
            logger.info("Alembic migrations completed successfully")
        except Exception as exc:
            logger.exception("Alembic migration FAILED — %s: %s", type(exc).__name__, exc)
            raise
    logger.info("running init_db")
    init_db()
    logger.info("startup complete — serving requests")
    yield


app = FastAPI(
    title="FusionAI API",
    description="Research chatbot backend with LangChain, PostgreSQL-ready persistence, and optional Redis caching.",
    version=APP_VERSION,
    lifespan=lifespan,
)

cors_origins = list(settings.frontend_origins)
# In development only, fall back to wildcard when no origins are configured.
# Production requires explicit FRONTEND_ORIGINS (enforced by diagnostics()).
if not cors_origins and not settings.is_production:
    cors_origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials="*" not in cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_request_metadata(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    request.state.request_id = request_id
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        logger.exception(
            "request failed method=%s path=%s latency_ms=%s request_id=%s",
            request.method,
            request.url.path,
            elapsed_ms,
            request_id,
        )
        raise
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    response.headers["x-request-id"] = request_id
    response.headers["x-process-time-ms"] = str(elapsed_ms)
    if settings.request_logging_enabled:
        logger.info(
            "request completed method=%s path=%s status_code=%s latency_ms=%s request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", request.headers.get("x-request-id", str(uuid4())))
    if settings.is_production:
        detail = "Internal server error"
    else:
        detail = str(exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": detail, "request_id": request_id},
        headers={"x-request-id": request_id},
    )


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"message": "FusionAI API is running", "version": APP_VERSION}


@app.get("/api/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    db_connected = check_database()
    errors, warnings = settings.diagnostics()
    return HealthResponse(
        status="healthy" if db_connected and not errors else "degraded",
        message="FusionAI API is running",
        database=database_type(),
        database_connected=db_connected,
        cache=cache.status,
        environment=settings.environment,
        version=APP_VERSION,
        uptime_seconds=int(time.time() - STARTED_AT),
        warnings=warnings,
    )


@app.get("/api/ready", response_model=ReadinessResponse)
def readiness_check(response: Response) -> ReadinessResponse:
    db_connected = check_database()
    errors, warnings = settings.diagnostics()
    ready = db_connected and not errors
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return ReadinessResponse(
        status="ready" if ready else "not_ready",
        database_connected=db_connected,
        cache=cache.status,
        environment=settings.environment,
        errors=errors if not ready else [],
        warnings=warnings,
    )


@app.post("/api/research", response_model=ResearchResponse)
def research(
    payload: ResearchRequest,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> ResearchResponse:
    try:
        return research_query(db, payload.query.strip(), payload.session_id, workspace_id)
    except WorkspaceAccessError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found") from exc


@app.post("/api/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> ChatResponse:
    try:
        return chat_message(db, payload.message.strip(), payload.session_id, workspace_id)
    except WorkspaceAccessError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found") from exc


@app.post("/api/research/stream")
def research_stream(
    payload: ResearchRequest,
    workspace_id: str = Depends(get_workspace_id),
) -> StreamingResponse:
    """Stream a research answer as newline-delimited JSON events (token-by-token)."""

    def event_stream():
        for event in stream_research_events(payload.query.strip(), payload.session_id, workspace_id):
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_chat_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> SessionOut:
    session = create_session(db, payload.title, workspace_id)
    return SessionOut(
        id=session.id,
        owner_id=session.owner_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@app.get("/api/sessions", response_model=list[SessionOut])
def get_sessions(
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> list[SessionOut]:
    return list_sessions(db, workspace_id)


@app.get("/api/sessions/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> SessionDetail:
    session = get_session_detail(db, session_id, workspace_id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@app.get("/api/sessions/{session_id}/results", response_model=list[ResearchResultSummary])
def get_session_results(
    session_id: str,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> list[ResearchResultSummary]:
    results = list_session_results(db, session_id, workspace_id)
    if results is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return results


@app.post("/api/sessions/{session_id}/documents", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    session_id: str,
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> DocumentOut:
    document = add_document(db, session_id, payload, workspace_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return document


@app.get("/api/sessions/{session_id}/documents", response_model=list[DocumentOut])
def get_session_documents(
    session_id: str,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> list[DocumentOut]:
    documents = list_documents(db, session_id, workspace_id)
    if documents is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return documents


@app.post("/api/sessions/{session_id}/documents/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    session_id: str,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> DocumentOut:
    try:
        payload = document_from_upload(file.filename or "", await file.read(), title)
    except DocumentUploadError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    document = add_document(db, session_id, payload, workspace_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return document


@app.get("/api/documents/{document_id}", response_model=DocumentDetail)
def get_saved_document(
    document_id: str,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> DocumentDetail:
    document = get_document(db, document_id, workspace_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@app.delete("/api/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document(
    document_id: str,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> None:
    deleted = delete_document(db, document_id, workspace_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


@app.get("/api/results/{result_id}", response_model=ResearchResultDetail)
def get_result(
    result_id: str,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> ResearchResultDetail:
    result = get_research_result(db, result_id, workspace_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Research result not found")
    return result


@app.delete("/api/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_session(
    session_id: str,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> None:
    deleted = delete_session(db, session_id, workspace_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")


@app.patch("/api/sessions/{session_id}", response_model=SessionOut)
def rename_session(
    session_id: str,
    payload: SessionUpdate,
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> SessionOut:
    updated = update_session_title(db, session_id, payload.title, workspace_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return updated


@app.get("/api/insights", response_model=InsightsResponse)
def get_app_insights(
    db: Session = Depends(get_db),
    workspace_id: str = Depends(get_workspace_id),
) -> InsightsResponse:
    return InsightsResponse(**get_insights(db, workspace_id))


if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=settings.port, reload=not settings.is_production)
