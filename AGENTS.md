# Repository Guidelines

## Project Structure & Module Organization

Mediwork is a TypeScript clinic-management application split into two packages. `frontend/src/` contains the React/Vite client: role-based screens live in `pages/`, shared UI in `components/`, API and Socket.IO clients in `services/`, and Zustand state in `stores/`. Static files belong in `frontend/public/`; imported images in `frontend/src/assets/`.

`backend/src/` contains the Express API. Add endpoints under `routes/`, guards under `middleware/`, and integrations under `services/`. Prisma models and seeds live in `backend/prisma/`. Root Docker Compose and Nginx files define the stack. Treat `_agent-files/` as a reference snapshot, not active application code.

## Build, Test, and Development Commands

- `docker compose up --build`: build and run PostgreSQL, API, frontend, and proxy; open `http://localhost:3000`.
- `cd backend && npm install && npx prisma db push && npm run dev`: run the API locally on port 4000.
- `cd frontend && npm install && npm run dev`: run Vite locally on port 5173.
- `npm run build` in each package: run strict TypeScript checks; the frontend also creates the Vite bundle.
- `cd backend && npm run prisma:generate`: regenerate Prisma Client after schema changes.

## Coding Style & Naming Conventions

Follow existing TypeScript: two-space indentation, semicolons, single quotes, and strict typing. Use `PascalCase` for React components, `camelCase` for functions and variables, and plural route modules such as `appointments.ts`. Keep authorization explicit with `authRequired` and `requireRole(...)`. No ESLint or Prettier configuration is committed, so match neighboring code and rely on builds for validation.

## Testing Guidelines

No automated test framework or coverage threshold is configured. Before submitting, run `npm run build` in both packages and manually exercise affected roles and API paths. For database changes, verify Prisma generation and schema updates against a disposable database. If adding tests, use `*.test.ts` or `*.test.tsx` beside the module and add the runner command to its `package.json`.

## Commit & Pull Request Guidelines

Recent commits use concise Spanish imperative summaries, for example `Agrega rol MASTER...` or `Actualiza CLAUDE.md...`. Keep each commit focused and describe the user-visible outcome. Pull requests should include a short rationale, affected roles/routes, setup or schema steps, and verification commands. Link the issue when applicable and attach screenshots for UI changes. Never commit `.env`, credentials, generated builds, uploads, or patient data.
