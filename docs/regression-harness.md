# Regression Harness

Date: 2026-04-18

## Purpose

This harness turns the Group 6 proof smoke into a committed, repeatable regression suite for the validated accounting and operational surfaces before Group 7.

It covers:

- Dashboard
- Accounting Controls
- POS proof pages
- Quick expense proof pages
- Refund proof pages
- Cash-session proof page
- Trial Balance
- Balance Sheet
- General Ledger drill-down
- Profit & Loss
- Tax Summary
- Cash Flow

## One-time setup

1. Install the browser runtime:

```bash
npm run test:proof:install
```

2. Create a local regression env file:

```bash
cp .env.regression.example .env.regression.local
```

3. Set the proof-tenant credentials in `.env.regression.local`:

```bash
PLAYWRIGHT_PROOF_EMAIL=...
PLAYWRIGHT_PROOF_PASSWORD=...
```

The suite reads:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env`
- `PLAYWRIGHT_PROOF_EMAIL` and `PLAYWRIGHT_PROOF_PASSWORD` from `.env.regression.local`

## Run command

```bash
npm run test:proof
```

What that command does:

1. builds the app
2. runs `npm run verify:proof` to validate proof-tenant health and proof-data freshness
3. runs `npm run prepare:proof:controls` to create disposable Group 9 finance-control fixtures
4. starts the dedicated proof runtime on `http://127.0.0.1:4173`
5. runs the committed Playwright proof suite

If you want the fast-fail proof check by itself, run:

```bash
npm run verify:proof
```

## Port behavior

The proof harness uses a dedicated port:

- proof runtime: `127.0.0.1:4173`

It starts with `--strictPort`, so port ambiguity is handled explicitly:

- if `4173` is free, the suite starts normally
- if `4173` is already in use, the suite fails fast instead of silently reusing or hopping to another port

This is intentional. It prevents accidental runs against a stale local server.

The proof runtime uses `vite dev` rather than `vite preview`.
This repo's TanStack Start preview path is not stable for automated proof runs, so the harness uses the same strict-port runtime every time while still running `npm run build` first as a separate gate.

## Proof dataset assumptions

The regression suite is read-only. It does not create, edit, or delete proof transactions.

It assumes the proof tenant already contains the Group 6 proof dataset documented in:

- [docs/group-6-go-live-hardening.md](./group-6-go-live-hardening.md)

Canonical proof keys used by the suite:

- POS orders
  - `POS-G6-CASH`
  - `POS-G6-CARD`
  - `POS-G6-MIX`
  - `POS-G6-CREDIT`
- Quick expenses
  - `EXP-G6-001`
  - `EXP-G6-002`
  - `EXP-G6-003`
- Refunds
  - `CN-G6-POSFULL`
  - `CN-G6-CREDIT`
- Cash-session proof selection
  - `cash_sessions.id = d38bbaa5-e901-4ee6-ad26-a0937114f6b6`

## Seeded vs browser-driven

Seeded in the proof tenant:

- Group 6 operational proof transactions
- the ledger activity behind those transactions

Browser-driven in the regression suite:

- proof-session authentication bootstrap
- Accounting Controls close / blocked-action / reopen workflow
- payment reversal and void workflows on disposable finance-control fixtures
- page navigation
- operational detail inspection
- posting-audit visibility checks
- Trial Balance / Balance Sheet / ledger drill-down checks
- financial report route smoke checks

The suite intentionally does **not** re-create the proof transactions through browser forms on each run.

## Proof health verification

`npm run verify:proof` checks the proof tenant before Playwright starts.

It validates:

- proof-user authentication
- company access resolution
- finance-control RPC availability (`accounting_list_periods`, `accounting_period_state`, `finance_integrity_warnings`)
- proof dataset freshness for the current month
- required POS, quick-expense, refund, and cash-session proof records
- ledger trace coverage for required proof documents and references
- current-month Trial Balance balance
- current Balance Sheet balance

This makes stale or missing proof data fail fast with clear diagnostics instead of surfacing later as indirect UI assertion failures.

## Control fixtures

The destructive Group 9 control scenarios do not mutate the long-lived Group 6 proof dataset directly.

Instead, `npm run prepare:proof:controls` signs in as the proof owner user and creates disposable current-period fixtures for:

- blocked invoice void while the period is closed
- invoice payment reversal
- bill void
- bill payment reversal
- credit-note void

The prepared fixture ids and document numbers are written to:

- `test-results/control-proof-manifest.json`

This file is regenerated on every `npm run test:proof` run, so the suite stays safe to rerun even though the correction actions themselves are destructive.

## CI

Group 7 adds a GitHub Actions workflow at [`.github/workflows/finance-trust.yml`](../.github/workflows/finance-trust.yml).

That workflow runs:

- `npm run lint`
- `npm run test:proof`

It also validates required secrets and emits a finance-impact scan on pull requests.

Release-process rules for finance-impacting changes are documented in [docs/finance-release-checklist.md](./finance-release-checklist.md).

## Intentional out of scope

This harness is intentionally not covering:

- the login form UX itself
  - the suite seeds a valid Supabase session directly for stability
- document creation workflows
- print dialog / PDF byte validation
- CSV file contents
- proof dataset reseeding

It now covers destructive finance-control workflows, but only against disposable Group 9 fixtures that are created just before Playwright starts.

Those areas can be added in a later phase if we decide to promote this from a finance-proof harness into a broader end-to-end suite.

## Files

- `playwright.proof.config.ts`
- `tests/regression/accounting-proof.spec.ts`
- `tests/regression/accounting-controls.spec.ts`
- `tests/regression/prepare-control-proof.ts`
- `tests/regression/support/auth.ts`
- `tests/regression/support/control-manifest.ts`
- `tests/regression/support/env.ts`
- `tests/regression/support/proof-health.ts`
- `tests/regression/support/proof-manifest.ts`
- `tests/regression/verify-proof.ts`
- `.env.regression.example`
