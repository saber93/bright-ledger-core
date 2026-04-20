# Finance Release Checklist

Date: 2026-04-18

## Purpose

This checklist is the release guardrail for accounting-impacting changes. Use it whenever a pull request could change posted ledger behavior, finance reports, dashboard totals, or the proof harness that protects them.

## What counts as finance-impacting

Treat a change as finance-impacting if it touches any of these paths or behaviors:

- `supabase/migrations/`
- `src/features/accounting/`
- `src/features/reports/`
- `src/features/dashboard/`
- `src/features/invoices/`
- `src/features/payments/`
- `src/features/refunds/`
- `src/features/quick-expenses/`
- `src/features/pos/`
- `src/features/bills/`
- `src/routes/_authenticated.dashboard*.tsx`
- `src/routes/_authenticated.reports*.tsx`
- `src/routes/_authenticated.invoices*.tsx`
- `src/routes/_authenticated.bills*.tsx`
- `src/routes/_authenticated.payments*.tsx`
- `src/routes/_authenticated.refunds*.tsx`
- `src/routes/_authenticated.quick-expenses*.tsx`
- `src/routes/_authenticated.pos*.tsx`
- `src/routes/_authenticated.cash-sessions*.tsx`
- `src/routes/-api.documents*.ts*`
- `tests/regression/`

If a change can alter journal posting, ledger balances, dashboard finance widgets, financial statements, or proof assertions, treat it as finance-impacting even if the file is outside those exact paths.

## Required pre-merge checks

For finance-impacting changes:

1. Run `npm run lint`
2. Run `supabase migration list` and confirm local and remote versions match if the change touched `supabase/migrations/`
3. Run `npm run verify:proof`
4. Run `npm run test:proof`
5. Review the CI `finance-trust` job output
6. Confirm ledger-backed reports still reconcile:
   - Trial Balance balances
   - Balance Sheet balances
   - Profit & Loss still reflects the validated ledger model or documented reconciliation logic
   - Tax Summary and Cash Flow are still consistent with posted activity
   - dashboard finance widgets do not contradict the validated reporting source
7. Update `tests/regression/support/proof-manifest.ts` if the proof dataset or expected proof state changed
8. Update Group notes or reconciliation docs if the finance behavior intentionally changed

If `supabase migration list` is not aligned, stop and repair the migration ledger explicitly before merging or releasing. The Group 9 repair process is documented in [docs/group-9-deployment-reconciliation.md](./group-9-deployment-reconciliation.md).

## Proof-tenant health rules

`npm run verify:proof` is the fast-fail gate before Playwright.

It must verify:

- proof-tenant authentication works
- the proof user resolves into the expected tenant
- the proof dataset is fresh for the current month
- required proof records exist and match expected state
- ledger traces exist for required proof documents and references
- current-month Trial Balance still balances
- Balance Sheet still balances as of today

If `verify:proof` fails, fix the proof tenant or update the manifest intentionally before relying on any UI smoke result.

## CI workflow

The GitHub Actions workflow is [`.github/workflows/finance-trust.yml`](../.github/workflows/finance-trust.yml).

It runs:

- `npm run lint`
- `npm run test:proof`

It also:

- validates that proof secrets are configured
- prints a finance-impact scan on pull requests
- fails before Playwright if the proof tenant is missing or stale

Recommended branch protection:

- require the `finance-trust` job to pass before merge on protected branches

## Required CI secrets

Configure these repository or environment secrets for the proof workflow:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PLAYWRIGHT_PROOF_EMAIL`
- `PLAYWRIGHT_PROOF_PASSWORD`

## Release questions to answer before shipping

- Did any posting rule or ledger helper change?
- Did any migration apply cleanly and leave `supabase migration list` fully aligned?
- Did any finance-facing mutation, report, or dashboard aggregate change?
- Did the proof manifest or proof tenant need an intentional update?
- Are any remaining mismatches or deferred items documented clearly?
- Is the `finance-trust` job green on the release candidate commit?
