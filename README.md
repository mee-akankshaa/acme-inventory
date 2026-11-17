# Acme Inventory

A stock-management app I built to practise getting the unglamorous parts of inventory right: stock that can never go negative, an audit trail you can't quietly edit, and a UI a warehouse person can use without training.

You can manage products, vendors and buyers, record stock-in and stock-out (with printable slips), get low-stock alerts, and export or import data as Excel, CSV or PDF.

Everything here runs on invented data. It's a clean-room rebuild of a system I originally worked on, redone with synthetic records so the code can be shown publicly.

## What I cared about

- **Stock can't go below zero.** `quantity_on_hand` has a database-level `CHECK (>= 0)`. The application validates too, but the database is the last line of defence.
- **Transactions are append-only.** Corrections are new rows, not edits, so history stays trustworthy.
- **Stock moves are atomic.** Each stock-in or stock-out runs in one transaction with row locks, so two people updating the same item at once don't corrupt the count.
- **Boring, solid auth.** JWT access and refresh tokens, bcrypt, rate-limited login, and an auth check on every route except health and login.
- **Alerts off the request path.** Low-stock checks go through a BullMQ queue on Redis instead of slowing down the request.

## Stack

| Layer | Tech |
|---|---|
| Web | React 18, Vite, Tailwind, React Router |
| API | Node 20, Fastify 4, Zod, TypeScript |
| Data | PostgreSQL 16, Prisma |
| Queue | Redis, BullMQ |
| Tests | Vitest, Supertest (87 API tests) |

## Run it locally

```bash
cp .env.example .env            # placeholders only, edit as you like
docker compose up -d            # Postgres + Redis
npm install
cp .env apps/api/.env           # the API reads its own .env
npm run db:migrate
npm run db:seed                 # demo users + a small dataset
npm run dev:api                 # http://localhost:4000
npm run dev:web                 # http://localhost:5173
```

Run the tests before loading the larger demo data, because they expect the small seed:

```bash
npm test
npm run seed:demo --workspace=apps/api   # optional: bigger synthetic dataset
```

## Demo logins

| Email | Password | Role |
|---|---|---|
| admin@example.com | Demo@12345 | admin |
| staff@example.com | Demo@12345 | staff |

These exist only in the seed data. Set `DEMO_PASSWORD` to change them, and never reuse them anywhere real.

## Project layout

```
apps/api   Fastify API: routes, services, queue workers, Prisma schema and migrations
apps/web   React app: pages for products, vendors, buyers, stock movements, alerts, reports
```

## How it was built

I built this with AI-assisted development (Claude Code) and reviewed, tested and adjusted the output myself. That workflow is a deliberate part of how I work, so I'm upfront about it.
