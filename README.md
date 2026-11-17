# Acme Inventory

A stock-management web app: products, vendors, buyers, stock-in / stock-out with print slips,
low-stock alerts, reports, and Excel/CSV/PDF export and import. All data in this repo is synthetic.

## Stack
React 18 + Vite + Tailwind + React Router (web) / Node 20 + Fastify 4 + Zod (api) /
PostgreSQL 16 + Prisma / Redis + BullMQ (alert queue) / Vitest + Supertest.

Design notes: transactions are append-only, `inventory.quantity_on_hand` has a DB-level `CHECK (>= 0)`,
stock operations run in transactions with row locks, JWT access + refresh tokens, bcrypt, login rate-limiting.

## Run locally
```bash
cp .env.example .env            # edit placeholders
docker compose up -d            # local Postgres + Redis
npm install
cp .env apps/api/.env           # api reads its own .env
npm run db:migrate              # applies Prisma migrations
npm run db:seed                 # demo users + small dataset
npm run dev:api                 # http://localhost:4000
npm run dev:web                 # http://localhost:5173
npm test                        # needs the small seeded DB (run before seed:demo)
npm run seed:demo --workspace=apps/api   # optional: larger synthetic dataset (do this AFTER tests)
```

## Demo logins (seed data only)
| Email | Password | Role |
|---|---|---|
| admin@example.com | Demo@12345 | admin |
| staff@example.com | Demo@12345 | staff |

Override the seed password with `DEMO_PASSWORD`. Never reuse these outside a local demo.
