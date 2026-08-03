"""Native authentication: username/password accounts with JWT sessions.

Passwords are hashed with PBKDF2-HMAC-SHA256 (standard library — no native
dependency), and sessions are stateless JWTs signed with the configured secret.
Each user's id becomes their data owner id, so sessions/documents are private.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from config import get_settings
from models import User

logger = logging.getLogger("fusionai.auth")

_PBKDF2_ITERATIONS = 240_000
_DEV_SECRET = "dev-insecure-change-me"


class AuthError(ValueError):
    """Raised for expected auth failures (bad credentials, taken username, …)."""


# ─── Password hashing (PBKDF2-HMAC-SHA256) ─────────────────────────────────────


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, hash_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), hash_hex)
    except Exception:  # noqa: BLE001 — any malformed hash means "does not verify"
        return False


# ─── JWT sessions ──────────────────────────────────────────────────────────────


def create_access_token(user: User) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.id,
        "username": user.username,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    """Return the token payload if valid and unexpired, else None."""
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    except Exception:  # noqa: BLE001 — expired / tampered / malformed all mean "no identity"
        return None


# ─── User accounts ─────────────────────────────────────────────────────────────


def _normalize_username(username: str) -> str:
    return username.strip().lower()


def register_user(db: Session, username: str, password: str) -> User:
    username = _normalize_username(username)
    if not 3 <= len(username) <= 80:
        raise AuthError("Username must be 3–80 characters.")
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters.")
    if db.scalar(select(User).where(User.username == username)):
        raise AuthError("That username is already taken.")
    user = User(username=username, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("registered new user %s", user.id)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = db.scalar(select(User).where(User.username == _normalize_username(username)))
    if not user or not verify_password(password, user.password_hash):
        raise AuthError("Invalid username or password.")
    return user


def identity_from_bearer(authorization_header: str | None) -> str | None:
    """Extract the user id from a 'Bearer <jwt>' header, or None if absent/invalid."""
    if not authorization_header or not authorization_header.startswith("Bearer "):
        return None
    payload = decode_token(authorization_header[len("Bearer "):].strip())
    if payload and payload.get("sub"):
        return str(payload["sub"])
    return None
