# Lumina PMS — Progress

## Current status

- **Phase:** WP3 – Properties, rooms, room types, rates (Completed and Verified).
- **Overall completion:** ~45%

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

### WP2 – Auth, RBAC, tenancy
- [x] Central `getAuthContext(request?)` resolving `SessionUser`, `organizationId`, `propertyIds`, `isOrgAdmin`, `isCustomer`, `hasPermission()`, and `hasPropertyAccess()`.
- [x] Granular `requirePermission(perm, { propertyId, request })` and `requireAuthContext(request?)` enforcing org scope and property scope (returning 401 for unauthorized, 403 for forbidden).
- [x] Dynamic permissions and role sync (`lib/permissions.ts`), distinguishing `customer` role with guest-portal boundaries from internal staff/manager roles.
- [x] Tenant-scoped Data Access Layer (`lib/dal.ts`) enforcing `organizationId` filtering and cross-tenant foreign ID ownership validation (`CrossTenantViolationError`).
- [x] Complete security middleware (`middleware.ts`) enforcing CSRF origin verification on mutating requests, strict security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), and unauthenticated path routing.
- [x] Secure registration route (`/api/auth/register`) with Zod schema validation, bcrypt(12) hashing, and automatic organization bootstrap with Owner/Admin role binding.
- [x] Cryptographic password reset lifecycle (`lib/auth/passwords.ts`, `/api/auth/forgot-password`, `/api/auth/reset-password`) using SHA-256 token hashing at rest, 1-hour expiration, and simulated notification dispatch.
- [x] Sliding-window rate limiting on auth endpoints (`lib/rate-limit.ts`).
- [x] Remediated all audit IDORs: `/api/properties/[id]`, `/api/rooms`, `/api/housekeeping`, `/api/maintenance`, `/api/maintenance/[id]`, `/api/invoices`, `/api/invoices/[id]`, `/api/payments`, `/app/(app)/reports` (eliminated `organizations[0]` leakage), AI tools in `lib/ai/tools.ts`, and SSRF safe URL guard in `lib/ai/providers.ts`.
- [x] High-converting, comprehensive landing page at `app/page.tsx` with Hero, operations suite, AI Hub showcase, double-booking shield architecture, multi-tenancy & security deep-dive, transparent pricing tiers, and interactive FAQ.
- [x] Automated WP2 gate test suite (`tests/auth-rbac-tenancy.test.ts`) validating Registration & Login bootstrap, RBAC matrix, Cross-tenant DAL isolation, Property-scope boundaries, Rate limiting, and Crypto-hashed password reset lifecycles.

### WP3 – Properties, rooms, room types, rates
- [x] Built missing room-type CRUD routes (`/api/roomtypes`, `/api/roomtypes/[id]`) with strict tenant scoping and property ownership checks.
- [x] Built rate plans API (`/api/rate-plans`, `/api/rate-plans/[id]`) with seasonal rate windows (`/api/rate-plans/[id]/seasons`).
- [x] Built discounts & coupons API (`/api/discounts`) supporting percentage and fixed discounts, redemption limits, and date validity.
- [x] Built amenities API (`/api/amenities`) with room assignment (`assign` / `unassign`).
- [x] Designed and implemented high-precision Decimal Pricing Engine (`lib/pricing/engine.ts`) with half-up rounding, multi-season splits, extra-guest surcharges, coupons, tax calculation, and leap-year/date boundaries.
- [x] Built real-time pricing quote calculation API (`/api/pricing/quote`).
- [x] Real property & operations Settings page (`app/(app)/settings/page.tsx`) managing timezone, currency, check-in/out hours, tax rates, cleaning fees, and contact details.
- [x] Step-by-step Setup Wizard & Onboarding page (`app/(app)/onboarding/page.tsx`) with atomic backend provisioning (`/api/setup-wizard` via `dal.onboarding.setupProperty`).
- [x] Enhanced Rooms & Room Types operational interface (`app/(app)/rooms/page.tsx`) with room category management and property filtering.
- [x] Automated WP3 gate test suite (`tests/pricing-and-properties.test.ts`): 12 comprehensive unit and integration tests for Decimal pricing, tax rounding, season splits, discount bounds, date validations, room-type CRUD, rate plans, and atomic setup wizard.

## In progress

- WP4 – Reservations engine (Next up per `SUPERVISION_PLAN.md`).

## Pending

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
- `npm run lint`: Passed (0 errors).
- `npm test`: 7 passed test files, 33 passed tests (`tests/permissions.test.ts`, `tests/reservations.test.ts`, `tests/utils.test.ts`, `tests/schema-v2.test.ts`, `tests/auth-login.test.ts`, `tests/auth-rbac-tenancy.test.ts`, `tests/pricing-and-properties.test.ts`).
- `npm run build`: Passed (compiled 53 dynamic/static routes successfully).
- WP3 Gate: Unit tests for pricing/tax rounding, multi-season splits, discount bounds, room-type CRUD, and setup wizard onboarding all passing (12/12 tests).
