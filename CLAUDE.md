# CLAUDE.md

This file gives AI coding agents the short path into this repository.

Read `docs/PROJECT_INDEX.md` first. It explains the product model, code map, domain boundaries, and common traps in more detail.

## Current Architecture

RiceFinanceU is a personal asset snapshot ledger.

The production path is:

```txt
React/Vite frontend
  -> Cloudflare Worker /api
  -> Cloudflare KV
```

Local development runs:

```txt
Vite http://localhost:5173
  -> proxy /api
  -> Wrangler local Worker http://localhost:8787
```

There is no local Express backend in the current codebase. Treat `worker/index.js` as the API implementation.

## Commands

```bash
npm run dev          # Vite dev server on port 5173
npm run dev:api      # Build frontend, then run Wrangler Worker on port 8787
npm run dev:all      # Run Vite and Wrangler together
npm run build        # TypeScript check + Vite production build
npm run test         # Frontend/domain tests + Worker tests
npm run test:app     # Vitest over src/
npm run worker:test  # Node test runner over worker/
npm run mini:test    # WeChat miniprogram tests
```

## Product Model

This app is not a transaction journal.

The core entities are:

- `Asset`: long-lived master data.
- `Snapshot`: a recorded point in time.
- `SnapshotValue`: one asset's state inside one snapshot.

Asset management is the master-data area. Snapshot entry is the time-bound recording area. Do not blur these responsibilities.

## Key Domain Rules

- Investment assets are `fund`, `stock`, and `gold`.
- Balance assets are `deposit`, `cash`, `housing_fund`, and `other`.
- Investment assets may carry `profit` and `profitRate`.
- Balance assets must not carry `profit` or `profitRate`.
- Snapshot entry is partial: users submit changed assets, then `completeSnapshotValues` carries forward unchanged values.
- Saved snapshots are complete points in time.
- Assets are soft-deleted with `isActive: false`; historical snapshots keep their references.
- Asset `profile` data is type-specific master data for identification and management only. It must not affect valuation, profit, or trend calculations.

## Important Files

- `docs/PROJECT_INDEX.md`: start here for the project map.
- `src/types/finance.ts`: shared domain types.
- `src/domain/assets.ts`: asset categories, profile field definitions, profile cleanup, list identifiers.
- `src/domain/snapshots.ts`: snapshot carry-forward, totals, allocation, comparison, trend series.
- `src/domain/money.ts`: money formatting and input validation.
- `src/api/client.ts`: browser API wrapper.
- `src/App.tsx`: auth gate and route table.
- `src/pages/AssetsPage.tsx`: asset management and profile editing.
- `src/pages/AssetDetailPage.tsx`: asset detail, profile display, snapshot history.
- `src/components/SnapshotForm.tsx`: snapshot entry form.
- `worker/index.js`: primary API implementation.
- `worker/worker.test.mjs`: Worker behavior tests.
- `demo/`: non-project examples and experiments; do not treat these as production app code unless asked.
- `wx-miniprogram/`: WeChat miniprogram client.

## Change Guidance

When changing asset fields or asset profile logic:

1. Update `src/domain/assets.ts`.
2. Keep Worker behavior in `worker/index.js` aligned.
3. Check import/export compatibility.
4. Add or update tests in `src/domain/assets.test.ts`, page tests, and Worker tests as appropriate.

When changing snapshot behavior:

1. Start with `src/domain/snapshots.ts`.
2. Read the tests in `src/domain/snapshots.test.ts`.
3. Preserve the partial-submit to complete-snapshot rule unless the product model is explicitly redesigned.

When changing money display/input:

1. Preserve 2-decimal money display.
2. Preserve thousand separators.
3. Preserve `-` for unknown values.
4. Be careful with incomplete input states such as `12.`, `.5`, and `-`.

Before claiming work is complete, run the relevant checks:

```bash
npm run test
npm run build
```
