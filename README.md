# AI Knowledge Platform

This repository is being migrated from a learning-oriented Streamlit RAG app to a full-stack AI Knowledge Platform. The original Streamlit files remain in place and are not used by the new application foundation.

## Current foundation

```
frontend/                 React + Vite + Tailwind CSS
  src/
    components/           Reusable UI components
    context/ hooks/ pages/ Reserved for the next UI phases
    layouts/              Shared page layout
    services/             REST client
backend/
  app/
    api/                  Versioned REST routers
    core/                 Typed configuration and future security helpers
    database/             PostgreSQL/SQLAlchemy connection boundary
    services/             Future RAG, document, and chat use cases
    agents/               Reserved for LangGraph agents
    schemas/ utils/
```

The React page calls `GET /health` on FastAPI and renders the returned status. This establishes the browser-to-API integration without exposing any authentication, upload, or chat endpoint before its migration is designed and tested.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- PostgreSQL 16+ with the `vector` extension, required in a later database migration phase

## Run the backend

From the repository root, use a new Python environment (do not rely on the old `.venv` if it points to a removed Python installation):

```powershell
py -3.11 -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
Set-Location backend
uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/health`. It returns:

```json
{"status":"healthy"}
```

The interactive API documentation is at `http://localhost:8000/docs`.

## Run the frontend

In a second terminal from the repository root:

```powershell
Set-Location frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). The page shows `Backend: healthy` when FastAPI is running. Set `VITE_API_BASE_URL` in `frontend/.env` when the API runs elsewhere. `backend/.env` allows only that frontend origin by default.

## Legacy system retained for gradual migration

`app.py`, `auth.py`, and `rag.py` are untouched. They provide the current Streamlit experience:

- local username/password login using bcrypt and a Streamlit session user id;
- SQLite storage in `data/assistant.db` for users, raw document bytes, chunks with embedding blobs, and messages;
- TXT, Markdown, PDF, and DOCX extraction; whitespace-token chunks of 900 words with 150-word overlap;
- local `sentence-transformers` embeddings, in-memory brute-force cosine search, and Groq answer generation;
- per-user source listing, chat history, and destructive clear actions.

The stale ignored `data/chunks.json`, `data/vectors.npy`, and `data/conversation.json` files are legacy artifacts and conflict with the current SQLite implementation; they are intentionally not consumed by the new foundation.

## Migration plan

1. **Foundation (complete):** introduce React/Vite/Tailwind and FastAPI, strict CORS, environment templates, the health contract, and service/router boundaries. Preserve the legacy application untouched.
2. **Identity:** add Google OpenID Connect to FastAPI, PostgreSQL `users` and `oauth_accounts` tables, short-lived access JWTs plus rotated refresh tokens in HttpOnly/Secure/SameSite cookies, and React auth state. Map an existing legacy user only through an explicit, verified migration flow; never match solely by display name.
3. **PostgreSQL and pgvector:** provision PostgreSQL, enable `vector`, introduce Alembic migrations, tenant-aware users/knowledge bases/documents/chunks/messages tables, metadata, content hashes, and vector indexes. Import SQLite data with id mapping, checksums, row counts, and rollback backup.
4. **Document ingestion:** move uploads to authenticated REST endpoints plus private object storage. Validate content signatures and size, store generated object keys rather than user filenames, enqueue extraction/embedding jobs, record statuses/errors, deduplicate content, and show progress in React.
5. **RAG parity:** port the existing extraction, chunking, HuggingFace embedding, pgvector similarity retrieval, Groq prompt, citations, and conversation behavior behind backend services. Use evaluation cases from current documents before switching the UI; dual-read or feature-flag the new path until parity is proven.
6. **Product hardening:** add rate limits, audit logs, observability, backups, encryption/secrets management, authorization checks on every tenant-scoped query, tests, CI, and deployment configuration.
7. **Agents:** add LangGraph only after the RAG API is stable. Define typed tools, bounded permissions, run tracing, human approval for side effects, and isolated worker execution before allowing multi-agent orchestration.

## Why this sequencing is safe

The old RAG behavior is preserved verbatim while new interfaces are introduced beside it. The database model is not copied mechanically: the current SQLite schema has no migration history, vector metadata, document-ingestion states, or production indexes. Google OAuth is intentionally the next phase, not part of this foundation, so no insecure half-authentication is exposed.

For Google sign-in, use the authorization-code OIDC flow with exact HTTPS callback registration, issuer/audience/nonce validation, a minimal `openid profile email` scope, and server-held client secrets. Google’s OAuth guidance requires exact redirect URI matching and recommends state validation; Streamlit’s own OIDC guidance is also useful context for the current app, but the target architecture will implement this in FastAPI rather than keep auth in Streamlit. [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server) [Streamlit OIDC documentation](https://docs.streamlit.io/develop/concepts/connections/authentication)

The future upload service will follow defense in depth: authenticated authorization, allowed types verified by content, file and extraction limits, generated storage names, non-public private storage, parser isolation, and malware scanning where available. [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
