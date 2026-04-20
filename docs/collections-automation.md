# Group 11 Collections Automation

Group 11 turns manual delivery into an operational collections workflow with:

- scheduled reminder and statement runs
- send queue / retry processing
- richer delivery-event tracking via Resend webhooks
- a finance collections work queue in `/collections`
- reminder cadence and suppression controls in `/settings/collections`

## Required Runtime Config

Set these server-side environment variables in addition to the existing Group 10 mail settings:

- `COMMUNICATIONS_CRON_SECRET`
- `RESEND_WEBHOOK_SECRET`
- `APP_URL`
- `RESEND_API_KEY`
- `MAIL_FROM_ADDRESS`
- `MAIL_REPLY_TO` (optional)

## Scheduler Endpoints

Collections automation is driven by two server routes:

- `POST /api/communications/run-scheduled`
- `POST /api/communications/process-queue`

Both routes require the `x-communications-secret` header to match `COMMUNICATIONS_CRON_SECRET`.

`run-scheduled` requires a JSON body with:

```json
{
  "companyId": "your-company-id"
}
```

`process-queue` accepts:

```json
{
  "companyId": "your-company-id",
  "limit": 50
}
```

## Recommended GitHub Scheduler

The repo now includes `.github/workflows/collections-automation.yml`.

Configure these repository secrets:

- `APP_BASE_URL`
- `COMMUNICATIONS_CRON_SECRET`
- `COMMUNICATIONS_COMPANY_ID`

The workflow:

- runs hourly
- triggers scheduled reminders/statements
- processes queued sends and retries
- supports manual dispatch

If you have multiple production companies in one deployment, duplicate the workflow or replace it with an external scheduler that iterates company IDs explicitly.

## Webhook Endpoint

Configure Resend to send webhook events to:

`POST /api/communications/webhooks/resend`

The app verifies the webhook with `RESEND_WEBHOOK_SECRET` using Svix signature validation.

Current event enrichment supports:

- `email.sent`
- `email.delivered`
- `email.bounced`
- `email.complained`
- `email.delivery_delayed`
- `email.opened`
- `email.clicked`

Bounce and complaint events automatically mark the recipient as suppressed for future sends.

## Safe Rerun Behavior

Group 11 is designed to be rerun safely:

- outbox rows prevent silent drop of transient failures
- retries use `next_retry_at`, `attempt_count`, and `max_attempts`
- a short dedupe key window blocks accidental double-click sends
- reminder cadence respects prior contact history and `throttle_days`
- suppressions are honored in manual, batch, and automated flows

## What Is Manual vs Automated

Manual:

- send from document detail
- resend from document history
- retry failed deliveries
- preview/send reminder batches
- preview/send statement batches
- suppression maintenance

Automated:

- scheduled reminder runs using the active collections policy
- scheduled monthly statement runs on `statement_run_day`
- queued retry processing
- delivery status enrichment from Resend events
