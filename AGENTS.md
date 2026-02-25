# AGENTS.md

## Cursor Cloud specific instructions

### Overview

AMI One-on-One is a Next.js 14 (App Router) meeting management web app with PostgreSQL/Prisma, NextAuth (Google OAuth), and Tailwind CSS. Single `package.json` at root — not a monorepo.

### Prerequisites

- **Node.js 20+** (22.x also works)
- **PostgreSQL 16** must be running locally (`sudo pg_ctlcluster 16 main start`)

### Database

- Connection string: `DATABASE_URL="postgresql://dev:dev@localhost:5432/ami_one_on_one"` in `.env`
- After installing dependencies, run `npx prisma generate && npx prisma db push` to sync the schema

### Environment variables

A `.env` file is required at the project root. Minimum required variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | App URL (use `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Session encryption secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (placeholder OK for dev) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (placeholder OK for dev) |

### Running the app

Standard commands from `package.json`:
- `npm run dev` — starts Next.js dev server on port 3000
- `npm run build` — production build
- `npm run lint` — ESLint

### Authentication in development

Google OAuth requires real credentials for full auth flow. For development/testing without Google credentials, use the **test login API**:

```bash
curl -X POST http://localhost:3000/api/auth/test-login \
  -H "Content-Type: application/json" \
  -d '{"role": "SUPER_ADMIN"}'
```

Valid roles: `EMPLOYEE`, `REPORTER`, `SUPER_ADMIN`. This endpoint creates a test user and session, returning a session cookie. It only works when `NODE_ENV !== 'production'`.

### Gotchas

- Build output shows "Error" messages for dynamic API routes during static generation — these are expected Next.js behavior (routes using `headers()` can't be statically rendered and are correctly served dynamically).
- PostgreSQL must be started manually after VM boot: `sudo pg_ctlcluster 16 main start`
- No `.env.example` exists in the repo; create `.env` manually with the variables above.
- The `ffmpeg-static` npm dependency provides ffmpeg; no system-level ffmpeg install needed.
