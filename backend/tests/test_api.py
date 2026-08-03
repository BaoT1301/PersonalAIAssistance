import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

TEST_DB = BACKEND_DIR / "test_fusionai.db"
if TEST_DB.exists():
    TEST_DB.unlink()

os.environ["OPENAI_API_KEY"] = ""
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["REDIS_URL"] = ""
os.environ["ENVIRONMENT"] = "test"
os.environ["SOURCE_LOOKUP_ENABLED"] = "false"
os.environ["AUTH_REQUIRED"] = "false"  # this suite scopes by workspace header, not tokens

from app import app  # noqa: E402
from schemas import SourceOut  # noqa: E402
from services.research import cache  # noqa: E402


def setup_function():
    cache.clear()


def test_health_endpoint():
    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["database"] == "sqlite"
    assert body["database_connected"] is True
    assert body["environment"] == "test"
    assert response.headers["x-request-id"]
    assert response.headers["x-process-time-ms"].isdigit()


def test_readiness_endpoint_reports_deploy_status():
    with TestClient(app) as client:
        response = client.get("/api/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["database_connected"] is True
    assert body["environment"] == "test"
    assert "OPENAI_API_KEY is missing" in body["warnings"][0]


def test_research_endpoint_returns_frontend_compatible_shape():
    with TestClient(app) as client:
        response = client.post("/api/research", json={"query": "LangChain retrieval"})

        assert response.status_code == 200
        body = response.json()
        result_response = client.get(f"/api/results/{body['result_id']}")

    assert body["topic"] == "LangChain retrieval"
    assert isinstance(body["summary"], str)
    assert isinstance(body["sources"], list)
    assert isinstance(body["tools_used"], list)
    assert body["session_id"]
    assert body["result_id"]
    assert body["answer"]
    assert result_response.status_code == 200
    result = result_response.json()
    assert result["id"] == body["result_id"]
    assert result["session_id"] == body["session_id"]
    assert result["query"] == "LangChain retrieval"
    assert isinstance(result["citations"], list)


def test_research_persists_retrieved_source_attribution(monkeypatch):
    def fake_sources(query: str):
        return [
            SourceOut(
                title="Railway PostgreSQL",
                url="https://railway.example/postgres",
                snippet=f"Source context for {query}",
                source_type="web",
            )
        ]

    monkeypatch.setattr("services.research.gather_sources", fake_sources)

    with TestClient(app) as client:
        response = client.post("/api/research", json={"query": "Railway PostgreSQL attribution"})
        body = response.json()
        result_response = client.get(f"/api/results/{body['result_id']}")

    assert response.status_code == 200
    assert body["citations"][0]["title"] == "Railway PostgreSQL"
    assert body["citations"][0]["source_type"] == "web"
    assert result_response.json()["source_count"] == 1


def test_research_uses_normalized_query_cache_key():
    with TestClient(app) as client:
        first = client.post("/api/research", json={"query": "Cache Probe Topic"})
        second = client.post("/api/research", json={"query": "  cache   probe   topic  "})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["cached"] is False
    assert second.json()["cached"] is True


def test_chat_endpoint_creates_session_history():
    with TestClient(app) as client:
        chat_response = client.post("/api/chat", json={"message": "Explain research agents"})
        assert chat_response.status_code == 200
        session_id = chat_response.json()["session_id"]

        session_response = client.get(f"/api/sessions/{session_id}")

    assert session_response.status_code == 200
    detail = session_response.json()
    messages = detail["messages"]
    assert [message["role"] for message in messages] == ["user", "assistant"]
    assert len(detail["results"]) == 1


def test_session_can_be_reused_and_results_can_be_listed():
    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Reusable research"})
        assert session_response.status_code == 201
        session_id = session_response.json()["id"]

        first = client.post("/api/research", json={"query": "PostgreSQL on Railway", "session_id": session_id})
        second = client.post("/api/research", json={"query": "Redis query caching", "session_id": session_id})
        results_response = client.get(f"/api/sessions/{session_id}/results")
        detail_response = client.get(f"/api/sessions/{session_id}")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["session_id"] == session_id
    assert second.json()["session_id"] == session_id
    assert results_response.status_code == 200
    assert len(results_response.json()) == 2
    assert len(detail_response.json()["messages"]) == 4


def test_sessions_are_scoped_by_workspace_header():
    workspace_a = {"x-fusion-workspace-id": "workspace-a"}
    workspace_b = {"x-fusion-workspace-id": "workspace-b"}

    with TestClient(app) as client:
        session_response = client.post(
            "/api/sessions",
            json={"title": "Private workspace"},
            headers=workspace_a,
        )
        session_id = session_response.json()["id"]

        a_sessions = client.get("/api/sessions", headers=workspace_a)
        b_sessions = client.get("/api/sessions", headers=workspace_b)
        b_detail = client.get(f"/api/sessions/{session_id}", headers=workspace_b)

    assert session_response.status_code == 201
    assert session_response.json()["owner_id"] == "workspace-a"
    assert len(a_sessions.json()) == 1
    assert b_sessions.json() == []
    assert b_detail.status_code == 404


def test_workspace_scope_protects_documents_results_and_research():
    workspace_a = {"x-fusion-workspace-id": "workspace-a-docs"}
    workspace_b = {"x-fusion-workspace-id": "workspace-b-docs"}

    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Private docs"}, headers=workspace_a)
        session_id = session_response.json()["id"]
        document_response = client.post(
            f"/api/sessions/{session_id}/documents",
            json={
                "title": "Private Plan",
                "content": "This private document belongs only to workspace A and should not leak.",
            },
            headers=workspace_a,
        )
        document_id = document_response.json()["id"]
        result_response = client.post(
            "/api/research",
            json={"query": "private plan summary", "session_id": session_id},
            headers=workspace_a,
        )
        result_id = result_response.json()["result_id"]

        blocked_document = client.get(f"/api/documents/{document_id}", headers=workspace_b)
        blocked_result = client.get(f"/api/results/{result_id}", headers=workspace_b)
        blocked_research = client.post(
            "/api/research",
            json={"query": "private plan summary", "session_id": session_id},
            headers=workspace_b,
        )

    assert document_response.status_code == 201
    assert result_response.status_code == 200
    assert blocked_document.status_code == 404
    assert blocked_result.status_code == 404
    assert blocked_research.status_code == 404


def test_session_documents_can_be_managed():
    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Document session"})
        session_id = session_response.json()["id"]
        document_response = client.post(
            f"/api/sessions/{session_id}/documents",
            json={
                "title": "Architecture Notes",
                "content": "FusionAI stores research sessions, messages, results, and document context for QA.",
            },
        )
        document_id = document_response.json()["id"]

        list_response = client.get(f"/api/sessions/{session_id}/documents")
        detail_response = client.get(f"/api/documents/{document_id}")
        session_detail = client.get(f"/api/sessions/{session_id}")
        delete_response = client.delete(f"/api/documents/{document_id}")
        missing_response = client.get(f"/api/documents/{document_id}")

    assert document_response.status_code == 201
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1
    assert detail_response.json()["title"] == "Architecture Notes"
    assert session_detail.json()["documents"][0]["id"] == document_id
    assert delete_response.status_code == 204
    assert missing_response.status_code == 404


def test_text_document_upload_creates_document():
    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Upload session"})
        session_id = session_response.json()["id"]

        upload_response = client.post(
            f"/api/sessions/{session_id}/documents/upload",
            data={"title": "Uploaded Notes"},
            files={
                "file": (
                    "notes.txt",
                    b"FusionAI can accept uploaded text notes and use them as session document context.",
                    "text/plain",
                )
            },
        )
        document_id = upload_response.json()["id"]
        detail_response = client.get(f"/api/documents/{document_id}")

    assert upload_response.status_code == 201
    assert upload_response.json()["title"] == "Uploaded Notes"
    assert upload_response.json()["source_type"] == "document"
    assert detail_response.json()["content_length"] >= 20


def test_docx_document_upload_extracts_text():
    from io import BytesIO

    from docx import Document as DocxDocument

    doc = DocxDocument()
    doc.add_paragraph("Project Zephyr launches in March. The lead engineer is Dana Cruz.")
    buffer = BytesIO()
    doc.save(buffer)

    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Docx session"})
        session_id = session_response.json()["id"]

        upload_response = client.post(
            f"/api/sessions/{session_id}/documents/upload",
            files={
                "file": (
                    "memo.docx",
                    buffer.getvalue(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            },
        )

    assert upload_response.status_code == 201
    body = upload_response.json()
    assert body["source_type"] == "docx"
    assert "Dana Cruz" in body["content_preview"]


def test_legacy_doc_upload_is_rejected_with_guidance():
    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Legacy doc"})
        session_id = session_response.json()["id"]

        upload_response = client.post(
            f"/api/sessions/{session_id}/documents/upload",
            files={"file": ("old.doc", b"\xd0\xcf\x11\xe0 legacy word binary", "application/msword")},
        )

    assert upload_response.status_code == 400
    assert ".docx" in upload_response.json()["detail"]


def test_document_upload_rejects_unsupported_file_type():
    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Upload validation"})
        session_id = session_response.json()["id"]

        upload_response = client.post(
            f"/api/sessions/{session_id}/documents/upload",
            files={"file": ("data.csv", b"name,value\nfusion,ai", "text/csv")},
        )

    assert upload_response.status_code == 400
    assert "Unsupported file type" in upload_response.json()["detail"]


def test_research_uses_session_documents_as_citations():
    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Document QA"})
        session_id = session_response.json()["id"]
        client.post(
            f"/api/sessions/{session_id}/documents",
            json={
                "title": "Caching Plan",
                "content": (
                    "FusionAI uses normalized cache keys and separates document-backed cache entries "
                    "from general research answers to avoid cross-session context leakage."
                ),
            },
        )

        response = client.post(
            "/api/research",
            json={"query": "How does FusionAI avoid cache leakage?", "session_id": session_id},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["cached"] is False
    assert "documents" in body["tools_used"]
    assert body["citations"][0]["title"] == "Document: Caching Plan"
    assert body["citations"][0]["source_type"] == "document"


def test_research_uses_uploaded_document_as_citation():
    with TestClient(app) as client:
        session_response = client.post("/api/sessions", json={"title": "Uploaded Document QA"})
        session_id = session_response.json()["id"]
        client.post(
            f"/api/sessions/{session_id}/documents/upload",
            files={
                "file": (
                    "uploaded-plan.md",
                    b"Uploaded documents are transformed into source context for research answers.",
                    "text/markdown",
                )
            },
        )

        response = client.post(
            "/api/research",
            json={"query": "How are uploaded documents used?", "session_id": session_id},
        )

    assert response.status_code == 200
    body = response.json()
    assert "documents" in body["tools_used"]
    assert body["citations"][0]["title"] == "Document: uploaded-plan"


def test_session_delete_removes_history():
    with TestClient(app) as client:
        response = client.post("/api/research", json={"query": "Delete session history"})
        session_id = response.json()["session_id"]

        delete_response = client.delete(f"/api/sessions/{session_id}")
        missing_response = client.get(f"/api/sessions/{session_id}")

    assert delete_response.status_code == 204
    assert missing_response.status_code == 404


def test_blank_query_is_rejected():
    with TestClient(app) as client:
        r_spaces = client.post("/api/research", json={"query": "   "})
        r_chat_spaces = client.post("/api/chat", json={"message": "   "})
        r_tabs = client.post("/api/research", json={"query": "\t\n "})
        r_valid = client.post("/api/research", json={"query": "valid query here"})

    assert r_spaces.status_code == 422
    assert r_chat_spaces.status_code == 422
    assert r_tabs.status_code == 422
    assert r_valid.status_code == 200
