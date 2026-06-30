# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Mediwork 2.0 — a medical clinic management system for occupational health (medicina empresarial). It handles patients, appointments, medical exams, prescriptions, optical prescriptions, inventory, and sales. There is also an AI agent (Anthropic SDK) that responds to external channels (WhatsApp) to schedule corporate medical batches.

## Development commands

### Preferred: Docker (runs everything)

```bash
docker compose up --build   # first run
docker compose up           # subsequent runs
```

- App: http://localhost:3000 (nginx proxy)
- API: http://localhost:4000 (direct)

### Local (without Docker)

```bash
# Backend (http://localhost:4000)
cd backend
cp .env.example .env        # set JWT_SECRET and ANTHROPIC_API_KEY
npm install
npx prisma db push
npm run dev

# Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

### Backend scripts

```bash
npm run seed              # seed base data
npm run seed:frames       # seed optical frame products
npm run agent:token       # generate JWT for AGENT role (WhatsApp bot)
npx prisma db push        # apply schema changes to DB
```

### Schema changes while Docker is running

```bash
docker cp backend/prisma/schema.prisma mediwork-backend:/app/prisma/schema.prisma
docker exec mediwork-backend npx prisma db push
docker restart mediwork-backend
```

## Architecture

### Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript (`tsx watch`) |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Real-time | Socket.IO |
| Proxy | Nginx (routes `/api` → backend, `/` → frontend) |

### Role-based routing (frontend)

`frontend/src/App.tsx` is the single routing file. It reads `user.role` from Zustand and renders entirely different route trees:

- **ADMIN** → `pages/admin/*` + shared pages (patients, appointments)
- **DOCTOR** → `pages/doctor/*` + shared pages
- **PACIENTE** → `pages/tablet/*` only (kiosk mode, no sidebar)
- **No auth** → `/login` or `/encuesta` (public survey)

The public survey at `/encuesta` creates a `Patient` + `PatientSurvey` in a single atomic request without requiring login.

### Frontend state

- **`stores/auth.ts`** — Zustand store: `user` and `token`, persisted to `localStorage`. Use `useAuth()`.
- **`stores/theme.tsx`** — Zustand store: dark/light mode, persisted to `localStorage`. Use `useTheme()`.
- **TanStack Query** — all server state / data fetching.
- **`services/api.ts`** — axios instance with base URL `/api`. Interceptors auto-attach the JWT header and redirect to `/login` on 401.
- **`services/socket.ts`** — Socket.IO client; listen with `socket.on('event', handler)`.

### Backend structure

All routes live in `backend/src/routes/*.ts` and are mounted in `backend/src/index.ts`.

**Public routes** (no auth):
- `GET /api/public/companies` — company list for survey/bot
- `POST /api/public/survey` — submit patient medical survey

**Protected routes** use `authRequired` + `requireRole` from `backend/src/middleware/auth.ts`:
- `DOCTOR + ADMIN`: patients, appointments, prescriptions, surveys, medical-exams
- `ADMIN only`: inventory, movements, sales, dashboard, users, companies, batches
- `AGENT role`: `/api/agent/*` — for the WhatsApp bot (external JWT)

Middleware pattern:
```ts
router.get('/', authRequired, requireRole('ADMIN', 'DOCTOR'), handler);
```

### Key data models (Prisma)

- **`Patient`** — core entity; links to all other models. Has a `companyId` FK (preferred) and legacy `company` string field.
- **`MedicalExam`** — ophthalmology exam. Complex data (visual acuity, vital signs, X-rays, etc.) stored as JSON fields. One exam per visit.
- **`PatientSurvey`** — occupational health questionnaire (habits, family history, work exposures). Created at the tablet kiosk.
- **`Appointment`** — links Patient + Doctor (User). Can belong to a `CompanyBatch`.
- **`CompanyBatch`** — groups a set of corporate appointments for one company on one day (jornada empresarial). Optionally created by the AI agent.
- **`Conversation` / `ConversationMessage`** — persisted chat history for the AI agent (WhatsApp/Gmail channels).
- **`DayCapacity`** — per-day patient slot limits. Defaults to 20 if no record exists.
- **`Prescription`** — optical prescription (OD/OI sphere/cylinder/axis/add). Separate from `MedicalExam`.
- **`Sale` / `SaleItem` / `Product` / `Movement`** — inventory and POS system.

### AI agent

The backend `/api/agent` routes integrate with the Anthropic SDK (`@anthropic-ai/sdk`) to handle WhatsApp conversations. The agent can check availability, create `CompanyBatch` records, and schedule appointments. It uses the `AGENT` role JWT. Generate a token with `npm run agent:token`.

Socket.IO events (e.g., `batch:created`) are emitted when the agent creates records, so the frontend updates in real time without polling.

### Layouts

- **`MainLayout`** — sidebar navigation + `<Outlet>` for page content. Used by ADMIN and DOCTOR.
- **`PatientLayout`** — minimal layout for the tablet kiosk (PACIENTE role).
- **`BottomNav`** — mobile floating bottom navigation with grid menu overlay.

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | Yes | Token signing secret |
| `ANTHROPIC_API_KEY` | Yes (for agent) | Claude AI integration |
| `GOOGLE_API_KEY` | No | Alternative LLM |
| `WHATSAPP_ACCESS_TOKEN` | No | WhatsApp Business API |
| `WHATSAPP_PHONE_NUMBER_ID` | No | WhatsApp Business |
| `WHATSAPP_VERIFY_TOKEN` | No | Webhook verification |
| `CLINIC_NAME` | No | Shown in agent responses |

Database credentials (`DATABASE_URL`) are pre-configured in `docker-compose.yml` and do not need to be changed for local Docker development.
