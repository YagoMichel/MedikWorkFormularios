# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Mediwork 2.0 — a medical clinic management system for occupational health (medicina empresarial). It handles patients, appointments, medical exams, prescriptions, optical prescriptions, inventory, and a point-of-sale (POS) system for optical products. An external WhatsApp bot and public website integrate with this backend through a dedicated `/api/agent/*` REST API.

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
cp .env.example .env        # set JWT_SECRET
npm install
npx prisma db push
npm run dev

# Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

There is no lint or test script configured in either package — `npm run build` (`tsc -b && vite build` on the frontend, `tsc` on the backend) is the only automated check available.

### Backend scripts

```bash
npm run seed               # seed base data (users, companies, etc.)
npm run seed:frames        # seed optical frame products
npm run seed:catalogo-pos  # sync POS price list (runs src/scripts/sync-lista-precios.ts)
npm run seed:servicios     # seed clinic services
npm run seed:perfiles      # seed company profiles / required-studies checklist (from PERFILES.xlsx)
npm run seed:sepomex       # download SEPOMEX postal-code data
npm run agent:token        # generate a JWT with the AGENT role, for the external bot/website
npx prisma db push         # apply schema changes to DB
```

Other one-off scripts live in `backend/prisma/*.ts` (e.g. `seed-pos.ts`, `seed-pos-demo.ts`, `add-etiquetas.ts`, `add-lentes.ts`) and `backend/src/scripts/*.ts` — run with `tsx <path>`; they aren't all wired into `package.json`.

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

- **ADMIN** → `pages/admin/*` (dashboard, inventory, movements, sales, users, companies, batches manager, calendar, reports) + `pages/pos/*` (point of sale) + shared pages
- **DOCTOR** → `pages/doctor/*` + shared pages
- **PACIENTE** → `pages/tablet/*` only (kiosk mode, no sidebar — just the medical survey)
- **No auth** → `/login` or `/encuesta` (public survey)

Shared pages (`pages/common/*`: Patients, PatientDetail, Profile) are used by both ADMIN and DOCTOR.

The public survey at `/encuesta` creates a `Patient` + `PatientSurvey` in a single atomic request without requiring login.

### Frontend state

- **`stores/auth.ts`** — Zustand store: `user` and `token`, persisted to `localStorage`. Use `useAuth()`.
- **`stores/theme.tsx`** — Zustand store: dark/light mode, persisted to `localStorage`. Use `useTheme()`.
- **TanStack Query** — all server state / data fetching.
- **`services/api.ts`** — axios instance with base URL `/api`. Interceptors auto-attach the JWT header and redirect to `/login` on 401.
- **`services/socket.ts`** — Socket.IO client; listen with `socket.on('event', handler)`.

### Backend structure

All routes live in `backend/src/routes/*.ts` and are mounted in `backend/src/index.ts`.

**Public routes** (no auth, mounted directly in `index.ts`):
- `GET /api/public/companies` — company list for the survey/bot
- `POST /api/public/survey` — submit patient medical survey (creates `Patient` + `PatientSurvey` atomically)
- `GET /api/public/cp/:codigo` — postal-code lookup proxy, tries three external APIs in cascade (copomex → icalialabs → zippopotam)

**Protected routes** use `authRequired` + `requireRole` from `backend/src/middleware/auth.ts`:
- `DOCTOR + ADMIN`: patients, appointments, prescriptions, surveys, medical-exams, documents, company-profiles
- `ADMIN only`: inventory, movements, sales, dashboard, users, companies, batches
- `AGENT role` (+ ADMIN): `/api/agent/*` — see below

Middleware pattern:
```ts
router.get('/', authRequired, requireRole('ADMIN', 'DOCTOR'), handler);
```

### Document storage: local disk vs. cloud sync (Drive/OneDrive)

`backend/src/routes/documents.ts` manages the patient's "expediente documental" (survey PDF, exam-results PDF, signed consent, and free-form uploads like lab results/X-rays). Storage behavior is controlled by `CLOUD_STORAGE_PROVIDER` (`none` default, `google`, or `onedrive`), resolved once per request via `services/storage/getCloudStorageProvider()`:

- **`none` (default)** — files are written to local disk (`UPLOAD_DIR/documents`) and served from there.
- **`google` / `onedrive` configured** — uploads go straight to the cloud (Google Drive OAuth2 acting as the account owner, or OneDrive via Microsoft Graph client-credentials); nothing is written to local disk on the happy path. Local disk is only used as a fallback if the cloud upload itself fails.

All cloud paths replicate the clinic's real OneDrive folder convention (`services/storage/folderPath.ts`): `Attachments/EXPEDIENTES {año}/{MES} {año}/{DD} {MES} {año}/{Nombre Paciente}` (Spanish month names, all caps, day zero-padded) — this exact structure must be preserved since the clinic's staff already navigates it by hand.

Key behaviors in `documents.ts`:
- `GET /:patientId/cloud-files?date=` — lists the *live* contents of a patient's cloud folder (via `provider.listFiles`), not just what's tracked in the `Document` table — this also surfaces files someone uploaded directly in Drive/OneDrive, outside the app.
- `DELETE /:id` and `DELETE /cloud-file/:fileId` — both delete the real file from the cloud provider, not just the DB row.
- `GET /:patientId/completo?date=&force=` — merges that day's documents into one PDF. By default it looks for and returns an already-saved `Expediente_completo_{date}.pdf` in that day's cloud folder instead of rebuilding (fast "consult" path, used when viewing a past visit); `force=1` always rebuilds from the live folder contents and overwrites the saved copy (used by the "generate today's expediente" button). `googleDriveProvider.uploadFile` upserts by filename (finds-and-updates instead of creating) so repeated saves don't accumulate duplicates.

`services/storage/types.ts` defines the provider-agnostic `CloudStorageProvider` interface (`uploadFile`, `listFiles`, `downloadFile`, `deleteFile`) implemented separately by `googleDriveProvider.ts` and `oneDriveProvider.ts`.

### Company profiles (required-studies checklist)

`CompanyProfile` / `CompanyProfileItem` (seeded from `PERFILES.xlsx` via `prisma/seed-perfiles.ts`) model, per company, a named profile (e.g. Sandvik → "Técnico plomo") with an ordered checklist of required studies. A `Patient.companyProfileId` assigns one profile to a patient; `GET /api/company-profiles?companyId=` (in `routes/companyProfiles.ts`) lists profiles with their items. In the frontend (`PatientDetail.tsx`'s `DocumentosTab`), each checklist item renders as an upload card — items with a pipe-separated `detail` field (e.g. "Laboratorio") expand into one card per sub-study instead of a single generic card. A card's "already uploaded" state is checked against the live cloud folder listing when cloud storage is configured, not just local DB records.

### External bot/website integration (`/api/agent/*`)

`backend/src/routes/agent.ts` is a plain REST API — **the backend itself does not call any LLM**. It exists purely to be consumed by:
- An external WhatsApp bot (a separate repo, "mediwork-bot", built by another engineer) that does its own LLM tool-calling and hits these endpoints with a JWT carrying the `AGENT` role (generate one with `npm run agent:token`).
- The public marketing site (mediworkzac.com) for the `POST /api/agent/cita-web` "book from the web form" flow.

Key endpoints: company lookup with fuzzy/Levenshtein matching (`/companies/find`), company registration, day-capacity queries, one-shot appointment booking (`/agendar`), and `CompanyBatch` creation/confirmation/cancellation for corporate exam days.

`@google/generative-ai` and the `Conversation`/`ConversationMessage` Prisma models are leftover from an earlier design — not referenced anywhere in `backend/src`. `_agent-files/` at the repo root is a **delivered, not-integrated** proposal for routing WhatsApp through a self-hosted n8n workflow instead of the external bot; it duplicates `backend/`, `docker-compose.yml`, and `nginx.conf` with n8n-specific changes and is not part of the running stack (the root `docker-compose.yml` has no n8n service).

Socket.IO events (e.g., `batch:created`) are emitted when `/api/agent` handlers create records, so the frontend dashboard updates in real time without polling.

### Key data models (Prisma)

- **`Patient`** — core entity; links to all other models. Has a `companyId` FK (preferred) and legacy `company` string field, plus an optional `companyProfileId`.
- **`MedicalExam`** — ophthalmology exam. Complex data (visual acuity, vital signs, X-rays, etc.) stored as JSON fields. One exam per visit.
- **`PatientSurvey`** — occupational health questionnaire (habits, family history, work exposures). Created at the tablet kiosk.
- **`Document`** — one row per file in a patient's expediente (survey/results/consent/free-form). Carries both a local `fileUrl` and, when cloud storage is configured, `cloudProvider`/`cloudFileId`/`cloudWebUrl` — see "Document storage" above.
- **`CompanyProfile` / `CompanyProfileItem`** — per-company named checklist of required studies (e.g. Sandvik → "Técnico plomo" → Laboratorio, Radiografía, Ruffier...), assignable to a `Patient`. Seeded from `PERFILES.xlsx`.
- **`Appointment`** — links Patient + Doctor (User). Can belong to a `CompanyBatch`.
- **`CompanyBatch`** — groups a set of corporate appointments for one company on one day (jornada empresarial), created either from the admin UI or via `/api/agent/batches`.
- **`DayCapacity`** — per-day patient slot limits. Defaults to `DEFAULT_DAILY_CAPACITY` (20) if no record exists.
- **`Prescription`** — optical prescription (OD/OI sphere/cylinder/axis/add). Separate from `MedicalExam`; can be attached to a `Sale`.
- **`Category` / `Product`** — POS catalog; `Category` supports nesting via `parentId`.
- **`Sale` / `SaleItem` / `Abono`** — POS transactions. A `Sale` can carry its own OD/OI prescription snapshot, a `deposit`/`balance` split for partial payments, and multiple `Abono` (installment) records.
- **`Movement`** — inventory stock movements (in/out), tied to a `Product` and the `User` who made it.

### Layouts

- **`MainLayout`** — sidebar navigation + `<Outlet>` for page content. Used by ADMIN and DOCTOR.
- **`PatientLayout`** — minimal layout for the tablet kiosk (PACIENTE role).
- **`BottomNav`** — mobile floating bottom navigation with grid menu overlay.

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | Yes | Token signing secret |
| `DEFAULT_DAILY_CAPACITY` | No | Fallback daily patient capacity when no `DayCapacity` row exists (default 20) |
| `CLINIC_NAME`, `CLINIC_ADDRESS`, `CLINIC_PHONE`, `CLINIC_HOURS_WEEKDAY`, `CLINIC_HOURS_SATURDAY` | No | Returned by `GET /api/agent/info` for the external bot/site |
| `SELF_URL` | No | This service's own URL |
| `GOOGLE_API_KEY` | No | Unused by current backend code; kept from an earlier design (see agent integration notes above) |
| `CLOUD_STORAGE_PROVIDER` | No | `none` (default) \| `google` \| `onedrive` — enables cloud sync for the document expediente, see "Document storage" above |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` | If `CLOUD_STORAGE_PROVIDER=google` | OAuth2 acting as the Drive account owner (not a service account — those have no storage quota and can't write to a personal Drive folder); refresh token obtained once via the OAuth Playground |
| `ONEDRIVE_TENANT_ID`, `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_DRIVE_USER` | If `CLOUD_STORAGE_PROVIDER=onedrive` | Microsoft Graph client-credentials (app-only) flow against `ONEDRIVE_DRIVE_USER`'s OneDrive |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | No | Referenced in `docker-compose.yml` but not consumed anywhere in `backend/src` — WhatsApp itself lives in the external "mediwork-bot" repo |

Database credentials (`DATABASE_URL`) are pre-configured in `docker-compose.yml` and do not need to be changed for local Docker development.
