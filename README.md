# Krish OS

Personal OS dashboard built with Next.js, Supabase, AI capture, finance sync, Apple Health import, CRM, Brain search, habits, goals, and nutrition tracking.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example env file:

```bash
cp .env.local.example .env.local
```

3. Fill `.env.local` with your real values. Never commit `.env.local`.

4. Run locally:

```bash
npm run dev
```

The app usually runs at `http://localhost:3000`. If that port is busy, Next.js will use another port such as `3001`.

## Supabase Setup

Create a Supabase project, then run the SQL migrations in order:

```text
supabase/migrations/0001_init.sql
supabase/migrations/0002_memory_rpc.sql
supabase/migrations/0003_studio_engine.sql
supabase/migrations/0004_content_pipeline.sql
supabase/migrations/0005_notes_decisions.sql
```

Required Supabase env vars:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OWNER_USER_ID
```

`OWNER_USER_ID` can be any UUID. Generate one with:

```bash
uuidgen
```

## Required Env Vars

Core:

```text
AUTH_SECRET
DASHBOARD_PASSWORD
API_SECRET
OWNER_USER_ID
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

AI:

```text
GEMINI_API_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY
```

Telegram capture:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_USER_ID
```

Finance:

```text
CRON_SECRET
GOOGLE_SHEETS_FILE_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_SERVICE_ACCOUNT_KEY
```

Optional:

```text
NEXT_PUBLIC_OWNER_NAME
NEXT_PUBLIC_OWNER_LOCATION
NEXT_PUBLIC_OWNER_ROLE
NEXT_PUBLIC_KCAL_TARGET
NEXT_PUBLIC_PROTEIN_TARGET
NEXT_PUBLIC_CARBS_TARGET
NEXT_PUBLIC_FAT_TARGET
NEXT_PUBLIC_EATING_CUTOFF
```

## Apple Health Import

The endpoint is:

```text
POST /api/health/import
```

Headers:

```text
Content-Type: application/json
x-api-secret: YOUR_API_SECRET
```

Example body:

```json
{
  "date": "2026-06-01",
  "metrics": [
    { "type": "steps", "value": 8430, "unit": "count" },
    { "type": "weight", "value": 72.4, "unit": "kg" },
    { "type": "sleep_hours", "value": 7.6, "unit": "hr" }
  ]
}
```

For local iPhone testing, use your Mac's Wi-Fi IP:

```text
http://YOUR_MAC_IP:3001/api/health/import
```

For production:

```text
https://YOUR_DOMAIN/api/health/import
```

## Vercel Deployment

1. Push this repo to GitHub.
2. Go to Vercel and import the GitHub repository.
3. Framework preset: `Next.js`.
4. Build command: `npm run build`.
5. Install command: `npm install`.
6. Add all production environment variables from `.env.local.example`.
7. Deploy.

After deployment, update external integrations:

- Telegram webhook URL:

```text
https://YOUR_DOMAIN/api/telegram/webhook
```

- Apple Health Shortcut URL:

```text
https://YOUR_DOMAIN/api/health/import
```

- Finance cron uses:

```text
/api/finance/snapshot
```

`vercel.json` already includes the daily cron route.
