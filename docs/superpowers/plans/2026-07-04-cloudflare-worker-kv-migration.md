# Cloudflare Worker KV Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local Express JSON backend with a Cloudflare Worker that serves the React app, authenticates one user, and persists finance data in KV.

**Architecture:** A single Worker handles `/api/*` and static assets. KV stores one complete finance JSON document and short-lived session records. The React API client keeps its existing endpoint surface and adds login/session handling.

**Tech Stack:** React, Vite, TypeScript, Vitest, Cloudflare Worker, Cloudflare KV, Wrangler.

---

## File Structure

- Create `worker/index.js`: Worker entry point, HTTP routing, auth, KV data persistence, and static asset fallback.
- Create `worker/worker.test.mjs`: Node test suite using an in-memory KV adapter and the Worker fetch handler.
- Modify `package.json`: add Worker dev/deploy scripts and root Wrangler dependency/script usage.
- Create `wrangler.jsonc`: Cloudflare Worker config, KV binding, static assets, compatibility date, observability.
- Modify `src/api/client.ts`: add session token handling, auth API calls, and automatic `Authorization` header.
- Create `src/api/session.ts`: browser session storage helper.
- Create `src/pages/LoginPage.tsx` and `src/pages/LoginPage.css`: login screen for the fixed email account.
- Modify `src/main.tsx` or `src/App.tsx`: add auth gate around the existing app.
- Modify `README.md`: document local dev, first deploy, KV namespace, and secret setup in Chinese.

## Tasks

### Task 1: Worker Auth And KV Contract

**Files:**
- Create: `worker/worker.test.mjs`
- Create: `worker/index.js`

- [ ] Write failing tests for login success, login failure, and protected API rejection.
- [ ] Run `node --test worker/worker.test.mjs` and confirm the tests fail because `worker/index.js` does not exist.
- [ ] Implement `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/health`, session token generation, session KV writes, and protected route auth.
- [ ] Run `node --test worker/worker.test.mjs` and confirm auth tests pass.

### Task 2: Worker Finance API

**Files:**
- Modify: `worker/worker.test.mjs`
- Modify: `worker/index.js`

- [ ] Write failing tests for `GET /api/assets`, `POST /api/assets`, `DELETE /api/assets/:id`, `POST /api/snapshots`, `GET /api/export`, and `POST /api/import`.
- [ ] Run `node --test worker/worker.test.mjs` and confirm tests fail because endpoints are missing.
- [ ] Implement single-document KV helpers for default data, load, save, validation, and the current API behavior.
- [ ] Run `node --test worker/worker.test.mjs` and confirm all Worker tests pass.

### Task 3: Frontend Session Integration

**Files:**
- Create: `src/api/session.ts`
- Modify: `src/api/client.ts`
- Create: `src/pages/LoginPage.tsx`
- Create: `src/pages/LoginPage.css`
- Modify: `src/App.tsx`

- [ ] Write failing tests where practical for API request authorization behavior.
- [ ] Implement session storage, `api.login`, `api.logout`, auth header injection, and `401` session clearing.
- [ ] Add a login page and wrap the existing app behind a simple authenticated state.
- [ ] Run frontend tests and TypeScript build.

### Task 4: Wrangler And Deployment Setup

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `wrangler.jsonc`
- Modify: `vite.config.ts`
- Modify: `README.md`

- [ ] Add scripts for Worker local dev and deploy.
- [ ] Add `wrangler.jsonc` with static assets, KV binding placeholder, `APP_USER_EMAIL`, and observability.
- [ ] Keep Vite usable, but make Worker the deploy target.
- [ ] Document `wrangler kv namespace create FINANCE_KV`, `wrangler secret put APP_PASSWORD`, `npm run build`, and `npm run deploy`.
- [ ] Run tests, `npm run build`, and Worker syntax checks.

### Task 5: Final Verification

**Files:**
- All changed files.

- [ ] Run `node --test worker/worker.test.mjs`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] If dependencies are installed and Wrangler is available, run `npx wrangler deploy --dry-run`.
- [ ] Report any verification command that could not be run and why.
