# Atlas ERP

TanStack Start + React accounting and operations app backed by Supabase.

## Local Setup

1. Use Node `22.12.0` or newer.
   The repo includes `.nvmrc` for `nvm use`.
2. Install dependencies:
   `npm install`
3. Create your local env file:
   `cp .env.example .env`
4. Fill in the Supabase values in `.env.example`:
   `VITE_SUPABASE_URL`
   `VITE_SUPABASE_PUBLISHABLE_KEY`
   `SUPABASE_URL`
   `SUPABASE_PUBLISHABLE_KEY`
   `SUPABASE_SERVICE_ROLE_KEY`
5. If you want in-app document delivery enabled, also set:
   `APP_URL`
   `RESEND_API_KEY`
   `RESEND_WEBHOOK_SECRET`
   `MAIL_FROM_ADDRESS`
   `MAIL_REPLY_TO` (optional)
   `COMMUNICATIONS_CRON_SECRET` (for scheduled reminders / queue workers)
6. Start the app:
   `npm run dev`

The dev server runs on `http://localhost:8080/`.

## Scripts

- `npm run dev` starts the local Vite dev server.
- `npm run dev:proof` starts the dedicated proof runtime on `127.0.0.1:4173`.
- `npm run dev:storefront-proof` starts the dedicated storefront proof runtime on `127.0.0.1:4174`.
- `npm run build` builds the client and server bundles.
- `npm run lint` runs ESLint for TypeScript source files.
- `npm run format` runs Prettier across the repo.
- `npm run verify:proof` validates the proof tenant and proof dataset before any browser smoke runs.
- `npm run prepare:proof:controls` creates disposable Group 9 finance-control fixtures for the destructive control regression scenarios.
- `npm run prepare:proof:storefront` normalizes the proof storefront state, publishes a stable product/category, and writes the storefront manifest for Playwright.
- `npm run test:proof` builds the app, verifies proof-tenant health, prepares disposable finance-control fixtures, starts the strict-port proof runtime on `127.0.0.1:4173`, and runs the committed finance regression harness.
- `npm run verify:storefront` validates the proof storefront manifest and public-store prerequisites before storefront Playwright starts.
- `npm run test:storefront` builds the app, prepares/verifies the storefront proof dataset, starts the strict-port storefront runtime on `127.0.0.1:4174`, and runs the committed storefront regression harness.
- `npm run ci:finance` runs the local finance-trust gate: lint plus the full proof harness.
- `npm run test:proof:install` installs the Chromium browser used by the proof harness.

## Notes

- Client auth and data fetching use the `VITE_*` Supabase variables.
- Server-side document routes also require `SUPABASE_SERVICE_ROLE_KEY`.
- Group 10 document delivery uses secure share links plus Resend-based email sending from `/api/communications/send`.
- Group 11 collections automation adds scheduled reminder + statement endpoints at `/api/communications/run-scheduled` and `/api/communications/process-queue`, plus a Resend webhook endpoint at `/api/communications/webhooks/resend`.
- Group 14 storefront hardening adds Stripe Checkout + webhook settlement at `/api/storefront/payments/webhooks/stripe`, revocable draft preview URLs at `/api/storefront/preview`, merchant shipping-method controls, and a dedicated storefront regression harness.
- Delivery status, resend history, and reminder history are visible on invoice, credit note, bill, POS order, and customer statement screens.
- Email templates can be managed in `/settings/document-templates`.
- Collections work queue, failed-delivery retry, suppression management, and reminder cadence live in `/collections` and `/settings/collections`.
- If mail env vars are missing, send attempts fail safely and the failure is recorded in document communication history for diagnosis.
- The current remaining startup warning is a CSS import-order warning in `src/styles.css`.
- Proof harness setup and scope are documented in `docs/regression-harness.md`.
- Storefront regression harness setup and scope are documented in `docs/storefront-regression-harness.md`.
- Finance release enforcement and required CI secrets are documented in `docs/finance-release-checklist.md`.
- Group 9 migration reconciliation and future schema-alignment process are documented in `docs/group-9-deployment-reconciliation.md`.
- Group 11 collections scheduler, webhook, and batch-ops setup are documented in `docs/collections-automation.md`.
