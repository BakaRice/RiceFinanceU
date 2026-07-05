# CLAUDE.md

This file gives AI coding agents the short path into this repository.

Read these first:

1. `docs/PROJECT_INDEX.md` for the product model and code map.
2. `docs/architecture/dependency-rules.md` for module dependency direction.
3. The local `README.md` inside any module you touch.

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

There is no local Express backend in the current codebase. Treat `modules/worker-api/index.js` as the API implementation.

## Commands

```bash
npm run dev          # Vite dev server on port 5173
npm run dev:api      # Build frontend, then run Wrangler Worker on port 8787
npm run dev:all      # Run Vite and Wrangler together
npm run build        # TypeScript check + Vite production build
npm run test         # Frontend/domain tests + Worker tests
npm run test:app     # Vitest over modules/web-app/src/
npm run worker:test  # Node test runner over modules/worker-api/
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
- `docs/architecture/module-map.md`: module responsibilities.
- `docs/architecture/dependency-rules.md`: dependency direction and runtime separation.
- `docs/review-checklists/change-review.md`: review checklist for AI-generated changes.
- `modules/web-app/src/types/finance.ts`: shared domain types currently used by the web app.
- `modules/web-app/src/domain/assets.ts`: asset categories, profile field definitions, profile cleanup, list identifiers.
- `modules/web-app/src/domain/snapshots.ts`: snapshot carry-forward, totals, allocation, comparison, trend series.
- `modules/web-app/src/domain/money.ts`: money formatting and input validation.
- `modules/web-app/src/api/client.ts`: browser API wrapper.
- `modules/web-app/src/App.tsx`: auth gate and route table.
- `modules/web-app/src/pages/AssetsPage.tsx`: asset management and profile editing.
- `modules/web-app/src/pages/AssetDetailPage.tsx`: asset detail, profile display, snapshot history.
- `modules/web-app/src/components/SnapshotForm.tsx`: snapshot entry form.
- `modules/worker-api/index.js`: primary API implementation.
- `modules/worker-api/worker.test.mjs`: Worker behavior tests.
- `modules/miniprogram-app/`: WeChat miniprogram client.
- `modules/finance-core/`: target home for shared pure domain rules.
- `examples/`: non-project examples and experiments; do not treat these as production app code unless asked.

## Change Guidance

When changing asset fields or asset profile logic:

1. Update `modules/web-app/src/domain/assets.ts`.
2. Keep Worker behavior in `modules/worker-api/index.js` aligned.
3. Check import/export compatibility.
4. Add or update tests in `modules/web-app/src/domain/assets.test.ts`, page tests, and Worker tests as appropriate.

When changing snapshot behavior:

1. Start with `modules/web-app/src/domain/snapshots.ts`.
2. Read the tests in `modules/web-app/src/domain/snapshots.test.ts`.
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
