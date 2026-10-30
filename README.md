# Postwave

Postwave by Mazi Saint Concepts helps users connect their own social accounts and publish from one workspace.

## Current build

The app includes email/password authentication, email verification and password reset, per-user Zernio profiles and OAuth connections, S3-compatible media uploads, publishing through a BullMQ worker, per-platform history, retries, scheduling foundations, trials, and plan entitlements. Billing includes Paystack card checkout, 15-minute price quotes, server-side payment verification, signed webhooks, receipts, recurring renewal attempts, cancellation, and downgrade after three failed renewal attempts.

## Railway deployment

The repository is a pnpm workspace. Keep Railway's root directory at the repository root so the workspace lockfile and package catalog are available.

1. Create a Railway project from `https://github.com/HUNTERSAINT/Postwave`, branch `main`.
2. Add Railway PostgreSQL and Redis services. Set `DATABASE_URL` and `REDIS_URL` on both Postwave services.
3. Create a **web** service:
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter @workspace/postwave build`
   - Start command: `pnpm --filter @workspace/postwave start`
4. Create a separate **worker** service from the same repository:
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter @workspace/postwave build`
   - Start command: `pnpm --filter @workspace/postwave start:worker`
5. Configure the environment variables listed below on both services. The start scripts run the PostgreSQL migrations before starting the web app or worker; they use a PostgreSQL advisory lock so simultaneous starts do not run the migrations concurrently.
6. Set the web service's public domain as `APP_URL`. Set up the Zernio webhook to `APP_URL/api/webhooks/late` and use the same `LATE_WEBHOOK_SECRET` value in Zernio and Railway. Set the Paystack webhook URL to `APP_URL/api/webhooks/paystack` in the Paystack Dashboard.
7. Configure an S3-compatible bucket with public-read media URLs. The bucket's browser CORS policy must allow `PUT` from `APP_URL` and the `Content-Type` and `x-amz-meta-postwaveuserid` headers. Set `S3_PUBLIC_BASE_URL` to the HTTPS base URL Late/Zernio can fetch.
8. Use `GET /api/health` as the web service health-check path.

## Environment variables

Copy `.env.example` as a reference only; never commit an actual `.env` file.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | External PostgreSQL connection |
| `REDIS_URL` | BullMQ queue and worker |
| `LATE_API_KEY` | Zernio API requests |
| `LATE_WEBHOOK_SECRET` | HMAC verification for publishing webhooks |
| `AUTH_SECRET` | Session and one-time-token hashing; use a random value of at least 32 characters |
| `APP_URL` | Public application URL and email links |
| `EMAIL_API_KEY` | Resend transactional email |
| `EMAIL_FROM` | Verified Resend sender |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | S3-compatible media storage |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3-compatible storage credentials |
| `S3_PUBLIC_BASE_URL` | Public HTTPS URL prefix for uploaded media |
| `PAYSTACK_SECRET_KEY` | Paystack API calls; configure on both web and worker services |\n| `PAYSTACK_PUBLIC_KEY` | Reserved for client-side Paystack integrations; hosted checkout currently uses the server API |
| `EXCHANGE_RATE_API_KEY` | Optional ExchangeRate-API key; open.er-api.com is used as the fallback |
| `TRIAL_LENGTH_DAYS` | Length of the free Pro trial in days (default 7) |
| `SUPPORT_EMAIL` | Public contact email shown on the privacy, terms and data-deletion pages |
| `ADMIN_EMAILS` | Comma-separated emails promoted to admin after a verified sign-in; the dashboard is at `/admin` |

When previewing inside Replit, Postwave intentionally refuses to use a Replit-provided database URL. To use your own external PostgreSQL database from that development environment, explicitly set `POSTWAVE_ALLOW_EXTERNAL_DATABASE=true`; this is not needed on Railway.

## Local workspace commands

Run commands from the repository root:

```sh
pnpm install
pnpm --filter @workspace/postwave dev
pnpm --filter @workspace/postwave db:migrate
pnpm --filter @workspace/postwave start:worker
```

The web process listens on `PORT` (default `3000`). The background worker is a separate long-running process and requires both PostgreSQL and Redis. It also refreshes exchange rates, processes trial/grant lifecycle events, and attempts due subscription renewals hourly.

## Data and account safety

- PostgreSQL and Redis are external services; this app does not use Replit's database or storage services.
- Social account access is scoped to a separate Zernio profile for each Postwave user. OAuth tokens remain with the provider and are not stored by Postwave.
- Media is uploaded directly to configured S3-compatible storage. Server-side checks enforce type and size limits and validate file signatures.
- Logs omit request bodies, tokens, passwords, and provider credentials.
\n\n## Billing setup\n\n- Configure `PAYSTACK_SECRET_KEY` on both Railway services. Never put it in client-side code or commit it.\n- Configure the Paystack webhook URL as `https://YOUR_DOMAIN/api/webhooks/paystack`. Paystack signs webhook requests with `x-paystack-signature`; Postwave verifies the HMAC before processing.\n- Billing checkout currently uses Paystack card payments in NGN, USD, GHS, ZAR, or KES. GBP and EUR remain supported as display currencies but cannot be selected for Paystack checkout.\n- The worker charges reusable card authorizations every 30 days using the current saved exchange rate. Failed renewals are retried daily up to three attempts; after the third failure the account returns to Free and excess accounts/scheduled posts are paused, not deleted.\n- If the authorization is not reusable, access remains active for the paid 30-day period and then returns to Free. Users can cancel automatic renewal from `/billing`; access remains until the paid period ends.\n- The billing page is available at `/billing`.\n
## Public pages and admin

- `/pricing` shows public prices converted from USD at the latest saved exchange rate, with a currency selector.
- `/privacy`, `/terms` and `/data-deletion` are the legal pages (the data-deletion URL is what Meta asks for). Review them with a lawyer before launch.
- `/admin` is the admin dashboard: user search, grant any plan (with note, duration and pause/keep billing for paying users), revoke grants, extend trials, stats, failed posts, audit log and a manual exchange-rate override. Set `ADMIN_EMAILS` to your email, sign in with that verified address, and open `/admin`.
- Trials start when a new user verifies their email (`TRIAL_LENGTH_DAYS`, default 7). The worker sends trial and grant emails and downgrades expired trials hourly.
