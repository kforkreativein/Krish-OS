# Krish OS Security Best-Practices Report

Generated: 2026-06-01

## Executive Summary

The dashboard-wide failure was not caused by the finance cron. The root cause was that the auth middleware lived at the repository root while this app uses `src/app`; local reproduction showed unauthenticated `/` and `/api/tasks` returned `200`. Moving the middleware to `src/middleware.ts` made protected pages redirect to `/login` and protected APIs return `401` until a valid session cookie is present.

I also found and fixed two security issues during the review: an open redirect after login and missing baseline hardening headers. Dependency audit still reports moderate advisories through `next`/`postcss` and `exceljs`/`uuid`; those need dependency upgrades or upstream patched releases.

## Critical Findings

### SEC-001: Authentication Middleware Was Not Protecting the Dashboard

Severity: Critical

Location: `middleware.ts` at repo root; fixed by moving to `src/middleware.ts`.

Evidence:

- Before the move, local probes returned `200` for unauthenticated `/api/tasks` and `/`.
- After the move, unauthenticated `/api/tasks` returns `401`, `/foo` redirects to `/login?next=%2Ffoo`, and `npm run build` shows `ƒ Middleware`.
- Current protection logic is in `src/middleware.ts:42`.

Impact:

Unauthenticated users could reach dashboard APIs and pages if production behaved like local reproduction.

Fix:

Moved middleware to `src/middleware.ts`, next to `src/app`, so Next applies it for this project layout. Verified protected API/page behavior locally.

## High Findings

### SEC-002: Missing CSRF Origin Check on Authenticated State-Changing APIs

Severity: High

Location: `src/middleware.ts:46`

Evidence:

The app uses cookie authentication and many state-changing route handlers (`POST`, `PATCH`, `DELETE`) under `src/app/api`. Without a server-side origin check, authenticated browser requests have weaker defense if SameSite behavior is bypassed or a browser/client edge case appears.

Impact:

An attacker-controlled page could attempt to trigger writes against authenticated APIs.

Fix:

Added an origin check for authenticated state-changing API requests. Cross-origin POSTs now return `403 {"error":"forbidden-origin"}` while API-secret cron/bypass requests still work.

### SEC-003: Open Redirect After Successful Login

Severity: High

Location: `src/app/login/page.tsx:21`

Evidence:

The login page previously used `window.location.href = params.get("next") || "/"`.

Impact:

A crafted `/login?next=https://attacker.example` URL could redirect a user to an external site after a successful login.

Fix:

Sanitized `next` so only same-origin relative paths starting with a single `/` are accepted.

## Medium Findings

### SEC-004: Baseline Security Headers Were Missing

Severity: Medium

Location: `next.config.ts:18`

Evidence:

The app previously only added cache headers for `/api/:path*` and `/favicon.png`.

Impact:

The app lacked defense-in-depth for MIME sniffing, clickjacking, referrer leakage, and browser permission surfaces.

Fix:

Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a minimal CSP with `frame-ancestors 'none'`.

### SEC-005: Dependency Audit Has Moderate Advisories

Severity: Medium

Location: `package.json:17`, `package.json:20`

Evidence:

`npm audit --audit-level=low --json` reports:

- `next` via bundled `postcss` advisory `GHSA-qx2v-qp2m-jg93`.
- `exceljs` via `uuid` advisory `GHSA-w5hq-g745-h8pq`.

Impact:

Moderate dependency risk, mostly dependent on whether vulnerable code paths are reachable with attacker-controlled input.

Fix:

Do not run the suggested npm audit downgrade fixes blindly. Track patched upstream versions for `next` and `exceljs` or replace/remove `exceljs` if unused.

## Low Findings

### SEC-006: LocalStorage Stores Personal Dashboard Data

Severity: Low

Location: examples include `src/components/dashboard/NutritionCard.tsx:47`, `src/components/dashboard/KeyBlockersCard.tsx:26`, `src/components/dashboard/SessionCard.tsx:56`

Evidence:

Several dashboard cards persist health, goals, tasks, captures, and habits in `localStorage`.

Impact:

This is not a remote auth bypass, but data is readable by anyone with browser/device access and by any future XSS on the origin.

Fix:

Prefer server-backed storage for sensitive personal data where practical. Keep the new security headers and avoid introducing HTML injection sinks.

## Dashboard Root Cause

Cron is not the whole-dashboard failure cause. The cron path in `vercel.json` only targets `/api/finance/snapshot`, and local API probes showed `/api/daily/get`, `/api/tasks`, and `/api/finance/latest` responding correctly on a clean server after auth.

The dashboard issue had two concrete causes:

1. The previous local `localhost:3000` Next process accepted TCP but did not respond to `/login`, causing reloads to hang.
2. Middleware was in the wrong location for this `src/app` project, so auth behavior was not reliable until moved to `src/middleware.ts`.

## Verification

- `npm run build` passes.
- Build output includes `ƒ Middleware`.
- Unauthenticated `/api/tasks` returns `401`.
- Authenticated `/api/tasks?status=open` returns `200`.
- Cross-origin authenticated POST to `/api/tasks` returns `403`.
- `/api/daily/get` and `/api/finance/latest` return `200` with a valid session cookie.
