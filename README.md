# Canflow

A minimal, Cursor-inspired flowboard app for tasks, tickets, roadmaps, and beta testing.

- **Kanban boards** — tasks with priority, tags, due dates, drag-and-drop
- **Roadmap boards** — public boards with upvote/downvote from viewers
- **Beta-testing boards** — bug reports with severity/intensity, categories, and email invites
- **Public sharing** — share read-only boards via a link, with light/dark/auto theming
- Clean light/dark UI, inline rename, themed dialogs/date-pickers, no system chrome

## Stack

| Layer    | Tech                                            |
| -------- | ----------------------------------------------- |
| Frontend | React 19 + Vite + Tailwind (SPA)                |
| API      | Hono on a Vercel Edge Function (`/api/*`)       |
| Database | Neon (serverless Postgres)                      |

## Deploy to Vercel

1. **Create a Neon database** at [neon.tech](https://neon.tech) and copy the connection string
   (Connection Details → *Pooled connection*).

2. **Apply the schema** (creates tables + a starter board):

   ```bash
   npm install
   echo 'DATABASE_URL="postgresql://…?sslmode=require"' > .env
   npm run db:setup
   ```

3. **Import the repo on Vercel** (New Project → import this GitHub repo). Vercel auto-detects Vite.

4. **Add environment variables** in Vercel → Project → Settings → Environment Variables:
   - `DATABASE_URL` — your Neon connection string (required)
   - `RESEND_API_KEY` — optional, for sending beta-invite emails

5. **Deploy.** The SPA is served statically and `/api/*` runs as an Edge Function.

## Local development

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL (a Neon branch works great)
npm run db:setup            # one-time, applies schema.sql
vercel dev                  # runs the SPA + /api functions together (needs `npm i -g vercel`)
```

Prefer pure-frontend work? `npm run dev` runs Vite alone and proxies `/api` to `vercel dev` on port 3000.

## Scripts

| Script             | Does                                            |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Vite dev server (frontend)                      |
| `npm run build`    | Type-check + production build to `dist/`        |
| `npm run db:setup` | Apply `schema.sql` to `DATABASE_URL`            |
| `npm run lint`     | ESLint                                          |

## Project layout

```
api/index.ts          Vercel Edge entry → mounts the Hono app (all /api/* via rewrite)
src/server/app.ts     Hono API (boards, columns, tasks, public, invites)
src/server/db.ts      Neon Postgres client
src/shared/types.ts   Shared zod schemas + types
src/react-app/        React SPA (pages, components, hooks)
schema.sql            Postgres schema + seed
```
