# Culina

Culina is a restaurant operations platform with a Next.js frontend and a Node.js backend service that also runs Python-based inventory prediction workflows.

## Repository Structure

```
culina/
  backend/                  # Express service + scheduled jobs + Python insights pipeline
  frontend/culina-frontend/ # Next.js app (dashboards, billing, auth, API routes)
  shared/                   # Shared project types
```

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI
- Frontend Data/Auth: Supabase client and server integrations
- Backend API: Express 5, Node.js 20+
- Backend Data: Supabase service role access
- Analytics Pipeline: Python 3.11+, pandas, numpy, lightgbm, scikit-learn

## Prerequisites

Install the following before local development:

- Node.js 20+
- npm 10+
- Python 3.11+
- Access to a Supabase project

## Environment Variables

Create environment files for both apps.

### Frontend (`frontend/culina-frontend/.env.local`)

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `JWT_SECRET`

Optional (features that call backend jobs or AI summaries):

- `BACKEND_BASE_URL` (default used in code: `http://localhost:8080`)
- `INVENTORY_INSIGHTS_JOB_SECRET` (or `MONTH_CLOSE_JOB_SECRET` fallback)
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (default: `gemini-1.5-flash`)

### Backend (`backend/.env` or `backend/.env.local`)

Required:

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL` fallback)
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_KEY` fallback)
- `MONTH_CLOSE_JOB_SECRET`

Optional:

- `PORT` (default: `8080`)
- `ENABLE_MONTH_CLOSE_AUTOMATION` (set `false` to disable scheduler)
- `MONTH_CLOSE_CHECK_INTERVAL_MS` (default: hourly)
- `MONTH_CLOSE_STATE_FILE`
- `PYTHON_BIN` (default: `python`)
- `INVENTORY_INSIGHTS_JOB_SECRET`

## Setup

Install dependencies in each app:

```powershell
Set-Location C:/Projects/culina/backend
npm install

Set-Location C:/Projects/culina/frontend/culina-frontend
npm install
```

Install Python dependencies for backend analytics:

```powershell
Set-Location C:/Projects/culina/backend
python -m pip install -r requirements.txt
```

## Run Locally

Use two terminals.

### Terminal 1: Backend

```powershell
Set-Location C:/Projects/culina/backend
npm start
```

Expected output:

- `Server running on http://localhost:8080`

### Terminal 2: Frontend

```powershell
Set-Location C:/Projects/culina/frontend/culina-frontend
npm run dev
```

Open:

- `http://localhost:3000`

## Core Workflows

### Restaurant UI and API

- Frontend app provides manager, waiter, billing, inventory, and staff workflows.
- Next.js API routes in the frontend project handle most business operations.

### Backend Job Endpoints

The backend service exposes job endpoints:

- `GET /` health check
- `GET /jobs/month-close/status` scheduler and state information
- `POST /jobs/month-close/run` manual month-close trigger (`x-job-secret` required)
- `POST /jobs/inventory-insights/run` generates insights CSV (`x-job-secret` or Bearer token required)

### Python Inventory Insights

The backend writes `inventory_snapshots.csv` and `restocks.csv`, then runs:

- `backend/invetory_prediction.py`

The script generates restock recommendations consumed by the backend response flow.

## Helpful Commands

Frontend (`frontend/culina-frontend`):

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - run built app
- `npm run lint` - lint checks

Backend (`backend`):

- `npm start` - start Express server

## Troubleshooting

### Frontend fails to start from wrong directory

Always run commands from the correct folder. In multi-folder workspaces on Windows, use explicit `Set-Location` paths before `npm run dev`.

### Port 3000 or 8080 already in use

Check processes and stop conflicting services, or run with a different port.

### Supabase configuration errors

If you see unauthorized or missing-client errors, verify all required Supabase variables are set in the correct `.env` file.

### Python runtime not found in backend job

Set `PYTHON_BIN` or install Python so one of `python`, `python3`, or `py` is available.

### Inventory insights endpoint returns 401

Ensure `x-job-secret` (or Bearer token) matches `INVENTORY_INSIGHTS_JOB_SECRET` or `MONTH_CLOSE_JOB_SECRET`.

## Notes

- The backend file name is currently `invetory_prediction.py` and is referenced by the service with that same name.
- Root orchestration scripts are not yet defined; run frontend and backend separately.

## Contributing

1. Create a feature branch.
2. Keep changes scoped to one area when possible.
3. Run lint/build checks for touched projects.
4. Open a pull request with a clear summary and testing notes.
