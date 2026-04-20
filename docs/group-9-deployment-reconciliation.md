# Group 9 Deployment Reconciliation

Date: 2026-04-19

## Purpose

Group 9 closes the last deployment-trust gap before Group 10:

- the remote Supabase migration ledger now matches the repo through Group 9
- the proof harness now covers the finance-control workflows added in Group 8

This document records the migration mismatch that existed, the exact reconciliation method used, and the operational process to keep schema state aligned going forward.

## Original mismatch

Before reconciliation, the live tenant schema already contained the Group 8 finance-control objects, but the remote migration ledger did not match the repo.

Remote `supabase_migrations.schema_migrations` contained these older truncated versions:

- `20260417122634`
- `20260417130600`
- `20260417133801`
- `20260417142236`
- `20260417142504`
- `20260417150542`
- `20260418103131`
- `20260418103435`
- `20260418103633`
- `20260418103720`
- `20260418103759`
- `20260418110653`

The repo expected these canonical versions instead:

- `20260417122637`
- `20260417130603`
- `20260417133805`
- `20260417142240`
- `20260417142507`
- `20260417150545`
- `20260418133000`
- `20260418133100`
- `20260418133200`
- `20260418133300`
- `20260418133400`
- `20260418150000`
- `20260418180000`

That mismatch meant the live tenant was functionally ahead of the recorded migration history, which made future deploys unsafe because the CLI could not trust what had already been applied.

## Reconciliation method used

The repair followed the official Supabase CLI recommendation after inspecting the remote state with `supabase db pull` and `supabase migration list`.

Steps used:

1. Link the local repo to the target project:
   `supabase link --project-ref qyrqqngzfavorwkakmxw`
2. Inspect the mismatch:
   `supabase db pull group9_probe --debug`
3. Mark the stale remote versions as reverted:
   `supabase migration repair --status reverted ...`
4. Mark the repo versions through Group 8 as applied:
   `supabase migration repair --status applied ...`
5. Push the new Group 9 repo migration:
   `supabase db push`
6. Verify local and remote ledgers align:
   `supabase migration list`

The Group 9 migrations applied during this pass were:

- `20260419184500_group9_audit_summary_fix.sql`
- `20260419191000_group9_finance_warning_perf.sql`

These migrations:

- fix the finance-audit summary formatter so finance-sensitive audit logging no longer fails on live correction actions
- optimize `finance_integrity_warnings` so the proof-health gate and finance-control UI can validate live control state without timing out on a growing ledger

## Final expected migration state

After reconciliation, local and remote migration history match exactly:

- `20260417122637`
- `20260417130603`
- `20260417133805`
- `20260417142240`
- `20260417142507`
- `20260417150545`
- `20260418133000`
- `20260418133100`
- `20260418133200`
- `20260418133300`
- `20260418133400`
- `20260418150000`
- `20260418180000`
- `20260419184500`
- `20260419191000`

This is now the trusted baseline for future schema work.

## Operational process for future schema changes

Use this process for every future schema change:

1. Create the migration in the repo first.
2. Apply it with `supabase db push` against the linked project.
3. Immediately verify `supabase migration list` shows the same local and remote versions.
4. If the change is finance-impacting, run:
   - `npm run lint`
   - `npm run verify:proof`
   - `npm run test:proof`
5. Commit the migration file, any related app changes, and any proof-harness/doc updates together.

If `supabase migration list` does not match:

- stop before shipping
- inspect with `supabase db pull <name> --debug`
- use `supabase migration repair` explicitly
- document the reason for the repair in the repo

Do not rely on memory or assume the remote project is correct just because the app appears to work.

## Group 9 guarantees

After this pass:

- remote migration history is trustworthy again
- future deploys will not silently drift from repo migration state
- finance-control workflows are covered by committed regression tests
- proof failures now distinguish schema/RPC/data issues from browser-only failures much earlier
