<div align="center">

# FusionAI

### AI-powered research assistant that thinks, searches, and synthesizes — instantly.

[![Live Site](https://img.shields.io/badge/Live_Site-fusionai.studio-6d3bdf?style=for-the-badge&logo=vercel&logoColor=white)](https://www.fusionai.studio)
[![Frontend](https://img.shields.io/badge/Vercel-Frontend-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://fusion-ai-alpha.vercel.app)
[![Backend](https://img.shields.io/badge/Railway-Backend-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)](https://railway.app)
[![License](https://img.shields.io/badge/License-MIT-a078ff?style=for-the-badge)](LICENSE)

</div>

---

## What is FusionAI?

FusionAI combines **Wikipedia**, **DuckDuckGo web search**, and **OpenAI GPT-4o mini** into a single research assistant that synthesizes multi-source answers in seconds. Ask anything — it finds, verifies, and explains it in plain language with cited sources.

- Conversational interface with full session history
- Smart intent detection — skips search for greetings, only fetches when needed
- Parallel source fetching (Wikipedia + DuckDuckGo simultaneously)
- Upload documents (PDF, Markdown, TXT) for document-backed Q&A
- Fully animated UI with Framer Motion

---

## Tech Stack

<div align="center">

![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite_5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Framer](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)

![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)
![OpenAI](https://img.shields.io/badge/GPT--4o_mini-412991?style=for-the-badge&logo=openai&logoColor=white)

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-FF4438?style=for-the-badge&logo=redis&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)

</div>

| Layer | Technology |
|-------|------------|
| Frontend | React 18 · Vite 5 · Tailwind CSS v4 · Framer Motion |
| Backend | Python 3.12 · FastAPI · LangChain · OpenAI |
| AI Model | gpt-4o-mini via LangChain `prompt \| llm` chain (streamed) |
| Database | PostgreSQL (Railway) · SQLite fallback for local dev |
| ORM | SQLAlchemy 2.x · Alembic migrations · psycopg2-binary |
| Cache | Redis (optional) · in-memory fallback |
| Hosting | Railway (backend) · Vercel (frontend) |

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
copy .env.example .env       # fill in your values
python app.py
```

> Backend runs on **http://localhost:5001**

Verify your setup:
```bash
python scripts/doctor.py
```

For local dev, leave `DATABASE_URL` unset to use SQLite with `AUTO_CREATE_TABLES=true`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> Frontend runs on **http://localhost:3000**

The Vite dev server proxies `/api/*` to `localhost:5001` automatically. No `VITE_API_URL` needed locally.

---

## Environment Variables

### Backend — `backend/.env`

```env
# Required
OPENAI_API_KEY=your_key_here
DATABASE_URL=postgresql://user:password@host:5432/dbname
ENVIRONMENT=production
FRONTEND_ORIGINS=https://www.fusionai.studio,https://your-app.vercel.app

# AI
OPENAI_MODEL=gpt-4o-mini
MAX_TOKENS=2000

# Database
AUTO_CREATE_TABLES=false
RUN_MIGRATIONS_ON_START=false   # migrations run via Procfile before uvicorn

# Sources
SOURCE_LOOKUP_ENABLED=true
WIKIPEDIA_RESULTS=1
WEB_SEARCH_RESULTS=3

# Cache
LOCAL_CACHE_ENABLED=true
CACHE_TTL_SECONDS=1800
```

### Frontend — `frontend/.env`

```env
VITE_API_URL=https://your-railway-backend.up.railway.app
VITE_WORKSPACE_ID=web-client
```

---

## Deployment

### Railway (Backend)

1. Create a Railway project → add a **PostgreSQL** service
2. Add backend as a new service → set **Root Directory** to `backend`
3. Railway auto-detects Python via `runtime.txt` and uses the `Procfile`
4. Set environment variables in the **Variables** tab
5. Set `DATABASE_URL` to `${{Postgres.DATABASE_URL}}` (Railway reference variable)

The `Procfile` runs Alembic migrations before starting the server:
```
web: alembic upgrade head && uvicorn app:app --host 0.0.0.0 --port $PORT
```

> `/api/ready` is a readiness endpoint — returns `503` if the database is down or config is invalid.

### Vercel (Frontend)

1. Import repo in Vercel → set **Root Directory** to `frontend`, framework to **Vite**
2. Add env vars: `VITE_API_URL` and `VITE_WORKSPACE_ID`
3. Deploy — `VITE_*` vars are baked into the bundle at build time, so redeploy after any change

---

## Database Migrations

Migrations live in `backend/migrations/` and are managed by Alembic.

```bash
# Apply all pending migrations
cd backend
alembic upgrade head

# Generate a new migration after changing models
alembic revision --autogenerate -m "describe your change"
```

In production, the Procfile runs `alembic upgrade head` automatically before the app starts.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check + system status |
| `GET` | `/api/ready` | Readiness check (used by Railway) |
| `POST` | `/api/research` | Submit a research query |
| `POST` | `/api/chat` | Send a follow-up chat message |
| `POST` | `/api/sessions` | Create a new session |
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/{id}` | Get session with messages |
| `DELETE` | `/api/sessions/{id}` | Delete a session |
| `GET` | `/api/sessions/{id}/results` | Get research results for session |
| `POST` | `/api/sessions/{id}/documents` | Add a document to session |
| `POST` | `/api/sessions/{id}/documents/upload` | Upload a file (PDF/MD/TXT) |
| `GET` | `/api/documents/{id}` | Get a document |
| `DELETE` | `/api/documents/{id}` | Delete a document |
| `GET` | `/api/results/{id}` | Get a research result |
| `GET` | `/api/insights` | Usage analytics |

**Research request body:**
```json
{ "query": "what is quantum computing", "session_id": "optional-existing-id" }
```

All routes accept an optional workspace header for data isolation:
```
x-fusion-workspace-id: your-workspace-id
```

---

## Project Structure

```
FusionAI/
├── backend/
│   ├── app.py                  # FastAPI app + lifespan startup
│   ├── config.py               # Settings dataclass + diagnostics
│   ├── database.py             # SQLAlchemy engine + session factory
│   ├── models.py               # ORM models (Session, Message, Result, Source, Document)
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── services/
│   │   ├── ai.py               # LangChain chain + OpenAI integration (cached, streamed)
│   │   ├── sources.py          # Wikipedia + DuckDuckGo + intent detection
│   │   ├── research.py         # Research orchestration + session handling
│   │   ├── sessions.py         # Session CRUD + message history
│   │   ├── cache.py            # Redis + in-memory cache layer
│   │   ├── documents.py        # Document storage + retrieval
│   │   ├── uploads.py          # PDF/Markdown/TXT parsing
│   │   ├── insights.py         # Usage analytics aggregation
│   │   └── operations.py       # Alembic migration runner
│   ├── migrations/             # Alembic version files
│   ├── scripts/
│   │   └── doctor.py           # Config health checker CLI
│   ├── tests/                  # pytest suite (SQLite, no API key needed)
│   ├── requirements.txt
│   ├── Procfile                # Railway: alembic upgrade head && uvicorn
│   ├── runtime.txt             # python-3.12.8
│   └── alembic.ini
└── frontend/
    ├── src/
    │   ├── App.jsx             # Entire app — landing page + research UI
    │   ├── App.css             # Global styles + Tailwind config
    │   └── main.jsx            # React entry point
    ├── package.json
    └── vite.config.js
```

---

## Testing

```bash
cd backend
python -m pytest tests
```

Tests use SQLite and disable live source lookup — no OpenAI key or network access required.

---

## Author

**Bao Tran** — George Mason University
