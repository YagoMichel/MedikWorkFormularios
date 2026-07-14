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
npm run seed:master        # seed MASTER-role user
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
- **PACIENTE_TABLET** → `pages/tablet/*` only (kiosk mode, no sidebar — just the medical survey)
- **PACIENTE** → `pages/portal/*` — patient portal: sees only their own expediente + a button to fill their own survey (`/mi-encuesta`)
- **EMPRESA** → `pages/portal/CompanyResults` — company portal: sees results of its own employees only
- **No auth** → `/login`, `/signup` (patient self-registration), `/activar` (company account activation), `/verificar` (patient email verification), or `/encuesta` (public survey)

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

### Security hardening (login, uploads, anti-bot)

- **JWT_SECRET is mandatory in production** — the server throws at startup if `NODE_ENV=production` and no secret is set (`middleware/auth.ts`).
- **Session cookie** — login also sets an httpOnly `mw_token` cookie mirroring the JWT. It exists so `<img src="/uploads/...">` requests (which can't carry headers) can authenticate; `/uploads` is served behind `authRequiredCookieOrHeader`, never publicly. `POST /api/auth/logout` clears it (called by the frontend's `logout()`).
- **`/uploads/documents` is staff-only** — the static route authenticates but doesn't authorize per-file, so `/uploads/documents/*` (expediente files, when stored locally) is restricted to `ADMIN`/`DOCTOR`/`MASTER` via an inline role check in `index.ts`; portal roles (PACIENTE/EMPRESA) get 403 and must use their scoped download endpoints (`/api/portal/{patient,company}/results/:id/download`) which verify ownership + the doctor's visibility flag. Avatars (`/uploads/avatars`) stay readable by any authenticated user. With `CLOUD_STORAGE_PROVIDER=onedrive` documents live in the cloud (not on local disk); this closes the latent IDOR for the local-storage / cloud-fallback case.
- **Rate limits** (`middleware/rateLimits.ts`) — global `/api` limiter plus strict per-IP and per-email limiters on `/api/auth/login` (only *failed* attempts count, so shared clinic IPs aren't locked out by normal use), and limiters on the public survey and CP-lookup routes. Requires `app.set('trust proxy', 1)` + the `X-Forwarded-For` header set in `nginx.conf`.
- **Captcha (Cloudflare Turnstile)** — `middleware/turnstile.ts` verifies a `turnstileToken` body field on login and the public survey, but **only when `TURNSTILE_SECRET_KEY` is set**; unset = disabled (dev). The frontend widget (`components/TurnstileWidget.tsx`) likewise renders only when `VITE_TURNSTILE_SITE_KEY` is set.
- **Login page demo shortcuts** (prefilled credentials / quick-fill buttons) only render in dev (`import.meta.env.DEV`).
- `helmet` + restricted CORS (`CORS_ORIGIN` env, comma-separated; unset = allow all, dev only). `helmet()` protects `/api` and `/uploads` responses; the browser-facing frontend HTML/JS (served by nginx) is protected by the security headers in `nginx.prod.conf` instead — see below.
- **HTTP security headers (frontend)** — `nginx.prod.conf`'s `location /` sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a **Content-Security-Policy** tuned to the app's external origins (Google Fonts `fonts.googleapis.com`/`fonts.gstatic.com` + Cloudflare Turnstile `challenges.cloudflare.com`). If you add a new external script/style/font/API origin, update the CSP or the browser blocks it. `server_tokens off` hides the nginx version. nginx clears client-supplied `Forwarded`/`X-Forwarded-Host` (Host/header-injection defense).
- **DB / API network exposure** — in `docker-compose.prod.yml` neither Postgres nor the backend publishes a host port (only nginx, bound to `127.0.0.1:7000`); the backend reaches the DB over the internal Docker network. The dev `docker-compose.yml` binds the DB (`5432`) and backend (`4000`) to `127.0.0.1` so they're reachable only from the local machine, never the LAN.
- **Trust proxy / real client IP** — `app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1))`. This value **must equal the exact number of trusted proxies** in front of the backend, or `req.ip` (used by rate limits and the audit log) is wrong. `1` = the container nginx is the edge (local/dev, `127.0.0.1:7000` accessed directly). When a **host reverse proxy** (nginx/Caddy terminating TLS) sits in front, set `TRUST_PROXY_HOPS=2`. Setting it higher than the real hop count lets a client spoof its IP via a forged `X-Forwarded-For`. Behind Cloudflare/CDN, don't rely on this — read `CF-Connecting-IP` and allowlist the CDN's IP ranges. Confirm empirically after deploy: log in from an external network and check the IP column in `/auditoria` shows your real public IP (not a private/`172.x` or a single shared proxy IP).
- **SQL injection** — all queries go through Prisma (parameterized). The few raw queries use the tagged-template `$queryRaw` (auto-parameterized); no user input is ever concatenated into SQL. `$queryRawUnsafe` is intentionally avoided.
- **Session length** — the JWT lasts `SESSION_TTL` (default **12h**, was 30 days) since this holds sensitive health data; the login cookie mirrors that lifetime. The frontend adds an **inactivity auto-logout** (`hooks/useInactivityLogout.ts`, default 30 min, `VITE_INACTIVITY_MIN`) that closes the session before the token expires even if the tab stays open. The `PACIENTE_TABLET` kiosk role is exempt (no sensitive data on screen, captura must not be interrupted).

### Audit log (bitácora — LFPDPPP / NOM-024-SSA3-2012)

`AuditLog` (Prisma) is an **append-only** trail of who accessed the system and what they did to sensitive data — required by Mexican privacy/health-record norms. It is written through a single fire-and-forget helper, `services/audit.ts` → `logAudit(req, action, extra?)`, which never blocks or breaks the request (errors only hit the console) and never stores passwords/tokens. It captures actor (id/email/role snapshot — kept even if the user is later deleted; `userId` has no cascade FK), IP, user-agent, target (`Document`/`Patient`/`User`), `patientId`, and a short `detail`.

Hooked into: login success/failure/logout + password change (`routes/auth.ts`); document upload/preview/download/delete + expediente listing/merge (`routes/documents.ts`); portal downloads (`routes/portal.ts`); patient-file open (`routes/patients.ts` `GET /:id`); user create/update/delete + role change (`routes/users.ts`). Actions live in the `AuditAction` enum.

Read-only viewer: `GET /api/audit` (+ `/api/audit/actions`) in `routes/audit.ts`, `ADMIN`-gated (MASTER passes via the MASTER→ADMIN rule), with filters `userId`/`patientId`/`action`/`from`/`to` and `take`/`skip` paging. The frontend page is `pages/admin/AuditLog.tsx` at `/auditoria` (admin sidebar "Auditoría"). There are **no** edit/delete endpoints for the log on purpose (integrity of the trail).

### External portals: patient & company accounts

Two self-service portal roles, separate from the internal staff roles, added on top of the existing account system. `User` now carries `emailVerified`, an optional one-to-one `patientId` (portal patient → their expediente) and an optional `companyId` (portal company → the company whose employees it may see). One-time tokens (activation / email-verification) live in `AuthToken` — only the SHA-256 hash is stored; the raw token travels only in the email link (`services/authTokens.ts`).

- **PACIENTE (patient portal):** self-registers at `/signup` (`POST /api/auth/signup`, rate-limited + captcha) → must verify email (`POST /api/auth/verify-email`) before login. Staff manually links the account to a `Patient` expediente via `PATCH /api/users/:id/link-patient` (the "Ligar expediente" action in admin Users). Portal endpoints are under `/api/portal/patient/*` — every query is scoped to the account's linked `patientId` taken from the token, never from client input. They can also submit their own survey (`POST /api/portal/patient/survey`). **Document visibility is doctor-gated** (like the company portal): the patient only sees documents where `Document.patientVisible` is true; a DOCTOR/MASTER releases each result via `PATCH /api/documents/:id/patient-visibility` (the "Visibilidad para el paciente" card in `PatientDetail.tsx`). Private by default (occupational-health / NOM-004: results released after medical validation). Both the list (`GET /api/portal/patient/results`) and the download check `patientVisible`.
- **EMPRESA (company portal):** no self-registration — staff creates it via `POST /api/users/company-account` (admin Users → "Cuenta de empresa"), which links it to a `Company` and emails an activation link; the company sets its own password at `/activar` (`POST /api/auth/activate`). No password is ever emailed. Portal endpoints under `/api/portal/company/*` scope every query to the account's `companyId`. Document downloads verify the document's patient belongs to that company before streaming.
- The two portal routers are mounted on **distinct** sub-paths (`/patient`, `/company`) inside `routes/portal.ts` on purpose: a router mounted at `/` would run its role middleware for the *other* portal too.
- **Login gate:** PACIENTE/EMPRESA accounts cannot log in until `emailVerified` is true (returns 403 `code: UNVERIFIED`).
- **Email** (`services/email.ts`) is config-gated on `SMTP_*`: without SMTP it does not fail — it logs the activation/verification link to the server console, and `company-account` returns the link in the response so staff can share it manually.
- **Survey reuse:** `pages/public/SurveyPublic.tsx` takes optional props (`mode`, `onSubmitOverride`, `title`, `subtitle`); the patient portal renders it in `mode="portal"` to reuse the whole form while posting to the authenticated endpoint.
- **Password reset:** `POST /api/auth/forgot-password` (rate-limited + captcha) issues a `PASSWORD_RESET` one-time token (1h) and emails `${APP_URL}/restablecer?token=` — always returns a generic 200 (no account enumeration; returns the link in the body only when SMTP is unconfigured, dev). `POST /api/auth/reset-password` sets the new password, marks the email verified, and logs `PASSWORD_CHANGE`. Frontend pages: `pages/auth/ForgotPassword.tsx` (`/recuperar`) and `pages/auth/ResetPassword.tsx` (`/restablecer`), linked from Login.
- **Social login (Google/Microsoft):** built but **config-gated** — dormant unless the provider's `*_OAUTH_CLIENT_ID`/`SECRET` are set (then `GET /api/auth/oauth/config` reports it and the buttons render). OIDC authorization-code flow (confidential client) in `services/oauth.ts` + `routes/oauth.ts` (mounted at `/api/auth/oauth`, **before** `/api/auth`): `/:provider/start` 302s to the provider with a signed `state` (CSRF, JWT-signed, 10min); `/:provider/callback` exchanges the code server-side, requires a verified email, then **resolves the account** — existing portal role (PACIENTE/EMPRESA) logs in, existing internal role (ADMIN/DOCTOR) is rejected (`?error=oauth_staff`, staff use passwords), unknown email **auto-creates a PACIENTE** (verified, unusable password until they use password-reset). Issues the normal `signToken` + cookie, logs `LOGIN_SUCCESS` (`via google/microsoft`), and redirects to `${APP_URL}/oauth/callback#token=` (fragment). Frontend: `components/SocialLoginButtons.tsx` + `pages/auth/OAuthCallback.tsx`. **The Microsoft OAuth app is a separate registration from the OneDrive one** (that is app-only/client-credentials; this needs the delegated auth-code flow). Register the redirect URI `${APP_URL}/api/auth/oauth/{google|microsoft}/callback` in each console.

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
- **`PatientLayout`** — minimal layout for the tablet kiosk (PACIENTE_TABLET role).
- **`BottomNav`** — mobile floating bottom navigation with grid menu overlay.

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | Yes | Token signing secret — fatal error at startup if missing with `NODE_ENV=production` |
| `CORS_ORIGIN` | Production | Comma-separated allowed origins; unset = allow all (dev only) |
| `SESSION_TTL` | No | JWT/cookie lifetime (jsonwebtoken format, e.g. `12h`, `1d`); default `12h`. Pair with `VITE_INACTIVITY_MIN` (frontend inactivity auto-logout, default 30 min) |
| `TURNSTILE_SECRET_KEY` | No | Enables Cloudflare Turnstile captcha on login + public survey; pair with `VITE_TURNSTILE_SITE_KEY` in the frontend env |
| `APP_URL` | No | Public frontend URL used to build the links in activation/verification emails (default `http://localhost:3000`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | No | SMTP for portal emails (company activation, patient verification, password reset); unset = links logged to console instead of sent |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | No | Enables "Continue with Google" social login (config-gated). Register redirect URI `${APP_URL}/api/auth/oauth/google/callback` |
| `MICROSOFT_OAUTH_CLIENT_ID`, `MICROSOFT_OAUTH_CLIENT_SECRET`, `MICROSOFT_OAUTH_TENANT` | No | Enables "Continue with Microsoft" social login (config-gated). **Separate app registration from OneDrive.** `TENANT` defaults to `common`; redirect URI `${APP_URL}/api/auth/oauth/microsoft/callback` |
| `DEFAULT_DAILY_CAPACITY` | No | Fallback daily patient capacity when no `DayCapacity` row exists (default 20) |
| `CLINIC_NAME`, `CLINIC_ADDRESS`, `CLINIC_PHONE`, `CLINIC_HOURS_WEEKDAY`, `CLINIC_HOURS_SATURDAY` | No | Returned by `GET /api/agent/info` for the external bot/site |
| `SELF_URL` | No | This service's own URL |
| `GOOGLE_API_KEY` | No | Unused by current backend code; kept from an earlier design (see agent integration notes above) |
| `CLOUD_STORAGE_PROVIDER` | No | `none` (default) \| `google` \| `onedrive` — enables cloud sync for the document expediente, see "Document storage" above |
| `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN`, `GOOGLE_DRIVE_ROOT_FOLDER_ID` | If `CLOUD_STORAGE_PROVIDER=google` | OAuth2 acting as the Drive account owner (not a service account — those have no storage quota and can't write to a personal Drive folder); refresh token obtained once via the OAuth Playground |
| `ONEDRIVE_TENANT_ID`, `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_DRIVE_USER` | If `CLOUD_STORAGE_PROVIDER=onedrive` | Microsoft Graph client-credentials (app-only) flow against `ONEDRIVE_DRIVE_USER`'s OneDrive |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | No | Referenced in `docker-compose.yml` but not consumed anywhere in `backend/src` — WhatsApp itself lives in the external "mediwork-bot" repo |

Database credentials (`DATABASE_URL`) are pre-configured in `docker-compose.yml` and do not need to be changed for local Docker development.
