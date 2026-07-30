# FusionAI Gateway

A Java **Spring Boot** API gateway that sits in front of the FusionAI FastAPI backend. It provides:

- **Authentication** — user registration/login with BCrypt-hashed passwords and signed **JWTs**.
- **Rate limiting** — per-user token buckets, with a stricter limit on the expensive LLM endpoints.
- **Reverse proxy** — forwards `/api/**` to FastAPI, streaming NDJSON responses through unbuffered.
- **Trusted identity** — strips any client-supplied identity header and injects a verified `X-Fusion-User` the backend can trust.

```
Browser ──> Gateway (:8080)  ──proxies /api/**──>  FastAPI (:5001)
             • JWT auth                             (trusts X-Fusion-User
             • per-user rate limits                  only from the gateway)
             • CORS
```

## Prerequisites

- **JDK 21 or newer** (you have JDK 25 — fine; the project compiles to Java 21 bytecode).
- **Maven** (there is no wrapper committed). Install once:
  - Windows: `winget install Apache.Maven`  (or `scoop install maven` / `choco install maven`)
  - Verify: `mvn -version`

> If the app misbehaves at runtime on the very new JDK 25, install JDK 21 (LTS) and point `JAVA_HOME` at it — Spring Boot officially supports 17–23.

## Run

Start the FastAPI backend first (so the gateway has something to proxy to):

```bash
# from backend/
./venv/Scripts/python.exe -m uvicorn app:app --host 127.0.0.1 --port 5001
```

Then start the gateway:

```bash
# from gateway/
mvn spring-boot:run
```

It starts on **http://localhost:8080**. The first build downloads dependencies (a few minutes, needs internet). Given limited RAM, run it when other heavy apps are closed.

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `FUSIONAI_BACKEND_URL` | `http://localhost:5001` | FastAPI base URL |
| `FUSIONAI_JWT_SECRET` | dev placeholder | **Set a long random value in production** (min 32 chars) |
| `FUSIONAI_JWT_EXPIRY_MINUTES` | `1440` | Token lifetime |
| `FUSIONAI_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Allowed frontend origins |
| `FUSIONAI_RATELIMIT_DEFAULT` | `120` | Requests/min per user (non-LLM) |
| `FUSIONAI_RATELIMIT_LLM` | `20` | Requests/min per user for `/api/research`, `/api/chat`, `/api/research/stream` |

Users are stored in a local H2 file database at `gateway/data/gateway` (gitignored).

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | public | `{username, password}` → `{token, username}` |
| POST | `/auth/login` | public | `{username, password}` → `{token, username}` |
| GET | `/auth/me` | Bearer | current username |
| GET | `/health` | public | liveness |
| ANY | `/api/**` | Bearer | rate-limited, proxied to FastAPI with a verified identity |

Send the token as `Authorization: Bearer <token>` on `/api/**` calls.

## Running in "gateway mode" (auth on) — end to end

The trust boundary is implemented with a shared secret. Turn it on by setting the
**same** secret on the gateway and FastAPI, and enabling auth in the frontend.
Pick a long random value for `<secret>` and a different one for `<jwt-secret>`.

1. **FastAPI** (rejects any `/api` call that isn't from the gateway):
   ```
   GATEWAY_SHARED_SECRET=<secret> ./venv/Scripts/python.exe -m uvicorn app:app --host 127.0.0.1 --port 5001
   ```
2. **Gateway** (validates JWTs, rate limits, forwards the secret):
   ```
   FUSIONAI_GATEWAY_SECRET=<secret> FUSIONAI_JWT_SECRET=<jwt-secret> mvn spring-boot:run
   ```
3. **Frontend** (shows a login screen, routes `/api` + `/auth` through the gateway):
   ```
   VITE_AUTH_ENABLED=true BACKEND_URL=http://localhost:8080 npm run dev
   ```

Leave `GATEWAY_SHARED_SECRET` and `VITE_AUTH_ENABLED` **unset** to run the app
directly against FastAPI with no gateway (the default dev flow — no Java needed).
