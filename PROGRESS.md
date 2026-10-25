# Lumina PMS — Progress

## Current status

- **Phase:** WP1 – Schema v2 + migrations (Completed and Verified).
- **Overall completion:** ~25%

## Completed

### WP0 – Stabilise & foundation
- [x] Initialized Git repository (`git init`).
- [x] Added `typecheck` script (`tsc --noEmit`) to `package.json`.
- [x] Installed missing dependencies: `clsx`, `class-variance-authority`, `@radix-ui/react-slot`, `tailwindcss-animate`, `@playwright/test`, `embedded-postgres`.
- [x] Fixed `jose` session & JWT verification (`lib/auth/jwt.ts`, `lib/auth/session.ts`) eliminating `verify` import error.
- [x] Configured native PostgreSQL support via `scripts/db.mjs` and `npm run db:start` on port 5432.
- [x] Implemented fail-fast Zod validation in `lib/env.ts` (enforces 32+ character secrets, rejects insecure defaults and zero keys in production runtime).
- [x] Hardened `prisma/seed.ts` against accidental production execution with explicit safety guards and configurable admin password.
- [x] Resolved React Server Component directives by adding missing `"use client"` in `login`, `register`, `forgot-password`, and `reset-password`.
- [x] Resolved all TypeScript compiler errors across components, API routes, and agent utilities.
- [x] Resolved ESLint build-blocking errors across all pages and API routes.
- [x] Verified complete login and session resolution pipeline (`tests/auth-login.test.ts`).

### WP1 – Schema v2 + migrations
- [x] Fully rewritten `prisma/schema.prisma` for PostgreSQL with 45 models and 18 status enums.
- [x] Configured native foreign key relations and referential integrity across all models.
- [x] Added `organizationId` scoping to all tenant-owned models (Room, RoomType, RatePlan, HousekeepingTask, MaintenanceTicket, Refund, InvoiceLineItem, GuestRequest, etc.).
- [x] Implemented indexes across foreign keys, status enums, and timestamp/date fields.
- [x] Implemented comprehensive RBAC models (`Permission`, `Role`, `RolePermission`).
- [x] Implemented `GuestProfile` model linked to `Guest` (and optional `User`) for loyalty, stay stats, and preferences.
- [x] Implemented financial precision with `@db.Decimal(12, 2)` across all monetary fields.
- [x] Created `RoomNight` model with unique constraint `@@unique([roomId, date])` for strict schema-level double-booking protection.
- [x] Added PostgreSQL Full-Text Search GIN indexes on `KnowledgeBaseDocument` and `KnowledgeBaseChunk` using `to_tsvector`.
- [x] Implemented `EncryptedCredential` shared credential storage for AI and integrations with `keyVersion` column.
- [x] Implemented `IdempotencyKey` table with expiration tracking for safe mutation retries.
- [x] Created initial baseline migration (`prisma/migrations/20261025162411_init/migration.sql`) including GIN indexes.
- [x] Authored comprehensive, idempotent dev-only seed script (`prisma/seed.ts`) populating Permissions, Roles, Admin User, Organization, Property, RoomTypes, Rooms, RatePlan, Guest, GuestProfile, Reservation, RoomNights, Invoice, Payment, HousekeepingTask, KnowledgeBase, and EncryptedCredential.
- [x] Connected `prisma.seed` in `package.json` ensuring automated seeding on `prisma migrate reset`.
- [x] Added automated gate tests (`tests/schema-v2.test.ts`) validating 45 spec models, unique constraint violation code `P2002` on duplicate `RoomNight`, `GuestProfile`, `EncryptedCredential`, `IdempotencyKey`, and PostgreSQL FTS queries.

## In progress

- WP2 – Auth, RBAC, tenancy (Next up per `SUPERVISION_PLAN.md`).

## Pending

- WP2: Central `getAuthContext()`, RBAC permissions matrix, multi-tenant DAL, security middleware.
- WP3: Properties, rooms, room types CRUD, rate plans, pricing engine.
- WP4: Reservations transaction engine with double-booking prevention.
- WP5: Front desk, housekeeping, maintenance workspaces.
- WP6: Billing, server-side invoice calculations, payments & gateway integration.
- WP7: Notifications service & email delivery queue.
- WP8: AI hub, provider adapters, approval workflows.
- WP9: Customer portal & chatbot.
- WP10: Reports, analytics, integrations, hardening.
- WP11: UI polish, Playwright journeys, production Dockerfile.

## Known limitations

- Docker engine is not installed on this host environment; local development PostgreSQL 18.4 runs via embedded binaries on port 5432 (`localhost:5432`).
- RoomNight reservation transaction engine enforcement across multi-room reservations will be fully integrated into the reservation workflow in WP4.

## Verified test results

- `npm run typecheck`: Passed (0 errors).
- `npm run lint`: Passed (0 errors, 86 lint warnings).
- `npm test`: 5 passed test files, 15 passed tests (`tests/permissions.test.ts`, `tests/reservations.test.ts`, `tests/utils.test.ts`, `tests/schema-v2.test.ts`, `tests/auth-login.test.ts`).
- `npm run build`: Passed (compiled 46 dynamic/static routes successfully).
- `npx prisma migrate reset --force`: Passed (resets database, applies migration cleanly from scratch, generates client, and executes seed).
- WP1 Gate: All 45 spec models verified, `RoomNight(roomId, date)` unique constraint verified rejecting double-bookings with Prisma P2002 error, and PostgreSQL FTS verified.
