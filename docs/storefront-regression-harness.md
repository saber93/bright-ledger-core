# Storefront Regression Harness

Date: 2026-04-21

## Purpose

This harness makes the public storefront, draft preview flow, cart, checkout, and customer-account foundation regression-testable with one committed command.

It covers:

- storefront home
- category browsing
- product detail
- published theme rendering
- add to cart
- cart quantity update and remove
- checkout page load
- pay-later order creation
- order confirmation
- customer account access
- order / invoice / statement visibility
- draft preview link generation and unpublished-vs-published behavior

## One-time setup

1. Install the shared Playwright browser runtime:

```bash
npm run test:proof:install
```

2. Create a local regression env file:

```bash
cp .env.regression.example .env.regression.local
```

3. Fill the proof-user credentials and service-role key in `.env.regression.local`:

```bash
PLAYWRIGHT_PROOF_EMAIL=...
PLAYWRIGHT_PROOF_PASSWORD=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Optional for manual pay-now validation outside the deterministic suite:

```bash
APP_URL=http://127.0.0.1:4174
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

The suite also reads the shared Supabase browser config from `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## Run command

```bash
npm run test:storefront
```

What that command does:

1. builds the app
2. runs `npm run prepare:proof:storefront` to normalize the proof storefront state
3. runs `npm run verify:storefront` to fail fast on missing/stale storefront prerequisites
4. starts the dedicated storefront runtime on `http://127.0.0.1:4174`
5. runs the committed Playwright storefront suite

If you want the fast-fail health check by itself, run:

```bash
npm run verify:storefront
```

## Port behavior

The storefront harness uses a dedicated strict port:

- storefront runtime: `127.0.0.1:4174`

If `4174` is already in use, the suite fails fast instead of hopping to another port or reusing a stale server.

## Seeded vs browser-driven

Seeded by `npm run prepare:proof:storefront`:

- storefront enabled state
- stable storefront slug
- published storefront design
- draft storefront design
- published category/product anchors
- merchant shipping methods

Browser-driven in Playwright:

- public browsing
- cart interactions
- pay-later checkout
- order confirmation
- customer account access via order/email/postal code
- order / invoice / statement visibility
- merchant draft-preview link generation
- draft preview validation
- preview revocation validation

The suite is safe to rerun, but the pay-later checkout scenario intentionally creates additional proof-tenant orders and invoices over time.

## Storefront health verification

`npm run verify:storefront` validates the proof storefront before Playwright starts.

It checks:

- storefront is enabled
- stable store slug exists
- published and draft design signatures match the storefront manifest
- shipping methods are configured
- a published product exists for the public routes

This keeps schema/setup failures obvious instead of surfacing later as vague browser assertions.

## Files

- `playwright.storefront.config.ts`
- `tests/regression/storefront-proof.spec.ts`
- `tests/regression/prepare-storefront-proof.ts`
- `tests/regression/verify-storefront.ts`
- `tests/regression/support/storefront-health.ts`
- `tests/regression/support/storefront-manifest.ts`
- `.env.regression.example`
