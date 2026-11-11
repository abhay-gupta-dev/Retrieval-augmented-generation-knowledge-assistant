# Cognitive RAG

**Live app:** [retrieval-augmented-generation-know.vercel.app](https://retrieval-augmented-generation-know.vercel.app/)

Cognitive RAG is a responsive AI knowledge assistant for chatting with documents, keeping conversations, and getting cited answers from retrieved content. It supports guest access as well as email/password and Google authentication. Optional Razorpay checkout lets users purchase AI reply credits or a usage plan.

## Features

- AI chat powered by Groq, with configurable chat and vision models
- Upload PDFs and other supported documents, then ask questions about their contents
- Upload images for vision-enabled chat
- Conversation history, saved documents, and shareable chat links
- Guest sessions, email/password accounts, and Google sign-in
- Responsive desktop and mobile interface; installable Progressive Web App
- Usage limits, billing history, and Razorpay checkout
- Owner dashboard for application activity and confirmed payments

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Python, FastAPI, SQLAlchemy, Alembic
- **Database:** PostgreSQL with pgvector
- **AI:** Groq API, Sentence Transformers
- **Payments:** Razorpay
- **Deployment:** Vercel (frontend), Render (API and PostgreSQL)

## Run locally

Prerequisites: Node.js and npm, Python 3.11+, and Docker Desktop.

### 1. Start PostgreSQL and the API

From the repository root in PowerShell:

```powershell
docker compose up -d postgres
py -3.11 -m venv backend\.venv
.\backend\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
Set-Location backend
uvicorn app.main:app --reload --port 8000
```

The API applies database migrations at startup. Check `http://127.0.0.1:8000/health` or open the interactive API docs at `http://127.0.0.1:8000/docs`.

Set at least `GROQ_API_KEY` in `backend/.env` to use AI chat. Google sign-in requires Google OAuth credentials and a redirect URI matching the local callback. Email/password and guest access can be used without Google OAuth configuration.

### 2. Start the frontend

Open a second PowerShell terminal from the repository root:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (usually `http://localhost:5173`). The Vite development proxy forwards API requests to the local backend on port 8000.

## Configuration

Use `backend/.env.example` as the reference for backend settings. Important variables include:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `GROQ_API_KEY` | Enables AI chat and vision requests |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in credentials |
| `GOOGLE_REDIRECT_URI` | OAuth callback registered with Google |
| `JWT_SECRET_KEY`, `SESSION_SECRET_KEY` | Authentication and session secrets |
| `CORS_ORIGINS`, `FRONTEND_URL` | Allowed frontend origins |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay checkout credentials |
| `RAZORPAY_WEBHOOK_SECRET` | Secret for validating Razorpay webhooks |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Optional transactional email delivery |

Keep backend secrets in the backend host’s environment settings. Never put secret keys in frontend variables or commit `.env` files. For local development, Razorpay and Google credentials are optional unless you are testing those specific integrations.

## Plans and payments

The app currently offers:

| Plan | Price | Included usage |
| --- | ---: | --- |
| Single reply | ₹3 | 1 AI reply |
| Reply pack | ₹20 | 15 AI replies |
| Monthly plan | ₹60 | 100 replies per 30-day period for 30 days |
| Six-month plan | ₹300 | 100 replies per 30-day period for 180 days |

The backend creates Razorpay orders and grants credits only after confirming a captured payment. Configure the Razorpay webhook at `/api/v1/billing/webhook` and subscribe to `payment.captured` and `payment.failed`. Use test-mode credentials for simulated checkout; live payments require Razorpay activation and Live Mode credentials. Razorpay API secrets and webhook secrets must remain on the backend.

## Deployment

- **Frontend:** deploy the `frontend` directory to Vercel. The Vercel rewrite configuration forwards `/api/*` and `/health` to the Render API.
- **Backend:** deploy the `backend` directory to Render using the included `render.yaml` as a reference. Configure required secrets and production origins in the Render environment.
- **Database:** use PostgreSQL with pgvector and set `DATABASE_URL` on the backend service.
- After changing code, push to the connected GitHub branch and confirm the Vercel and Render deployments complete successfully.

## Security notes

- User data and conversations are scoped to the authenticated account or guest workspace.
- Purchase records are tied to the signed-in account; only captured payments count as completed purchases.
- Keep API keys, database URLs, OAuth secrets, and webhook secrets out of source control and the browser.
- Verify that production CORS origins and OAuth redirect URLs match the deployed app domains.

## License

Add a license before permitting reuse or redistribution. Until then, all rights are reserved by the repository owner.
