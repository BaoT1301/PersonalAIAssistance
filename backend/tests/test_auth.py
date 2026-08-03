import os
import sys
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("OPENAI_API_KEY", "")
os.environ.setdefault("DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'test_fusionai.db').as_posix()}")
os.environ.setdefault("REDIS_URL", "")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SOURCE_LOOKUP_ENABLED", "false")
os.environ.setdefault("AUTH_REQUIRED", "false")

from app import app  # noqa: E402

# Unique per run so re-runs against a persisted sqlite file don't collide.
SUFFIX = uuid4().hex[:8]


def _register(client, name, password="password123"):
    return client.post("/auth/register", json={"username": f"{name}_{SUFFIX}", "password": password})


def test_register_and_login_issue_tokens():
    with TestClient(app) as client:
        r = _register(client, "alice")
        assert r.status_code == 201, r.text
        assert r.json()["token"]
        assert r.json()["username"] == f"alice_{SUFFIX}"

        r2 = client.post("/auth/login", json={"username": f"alice_{SUFFIX}", "password": "password123"})
        assert r2.status_code == 200
        assert r2.json()["token"]


def test_duplicate_username_rejected():
    with TestClient(app) as client:
        assert _register(client, "bob").status_code == 201
        assert _register(client, "bob").status_code == 400


def test_wrong_password_rejected():
    with TestClient(app) as client:
        _register(client, "carol")
        r = client.post("/auth/login", json={"username": f"carol_{SUFFIX}", "password": "not-the-password"})
        assert r.status_code == 401


def test_short_password_rejected():
    with TestClient(app) as client:
        r = client.post("/auth/register", json={"username": f"dave_{SUFFIX}", "password": "short"})
        assert r.status_code == 400


def test_sessions_are_private_per_user():
    with TestClient(app) as client:
        t1 = _register(client, "userone").json()["token"]
        t2 = _register(client, "usertwo").json()["token"]
        h1 = {"Authorization": f"Bearer {t1}"}
        h2 = {"Authorization": f"Bearer {t2}"}

        created = client.post("/api/sessions", json={"title": "private"}, headers=h1)
        assert created.status_code == 201, created.text
        sid = created.json()["id"]

        assert client.get(f"/api/sessions/{sid}", headers=h1).status_code == 200   # owner sees it
        assert client.get(f"/api/sessions/{sid}", headers=h2).status_code == 404   # other user cannot
        others = client.get("/api/sessions", headers=h2).json()
        assert all(s["id"] != sid for s in others)                                  # not in their list


def test_auth_required_blocks_anonymous_allows_signed_in():
    """With AUTH_REQUIRED on, the chat rejects anonymous requests but accepts a token."""
    from config import get_settings

    os.environ["AUTH_REQUIRED"] = "true"
    get_settings.cache_clear()
    try:
        with TestClient(app) as client:
            anon = client.post("/api/research", json={"query": "what is the capital of france"})
            assert anon.status_code == 401

            token = _register(client, "gated").json()["token"]
            ok = client.post(
                "/api/research",
                json={"query": "what is the capital of france"},
                headers={"Authorization": f"Bearer {token}"},
            )
            assert ok.status_code == 200
    finally:
        os.environ["AUTH_REQUIRED"] = "false"
        get_settings.cache_clear()
