# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (port 5173), proxies /api → :3001
npm run dev:server   # Express API server (port 3001) with tsx watch
npm run dev:all      # Both concurrently
npm run build        # TypeScript check + Vite production build
npm test             # Vitest run (all tests)
npm run test:watch   # Vitest watch mode
npx vitest path/to/file.test.ts  # Run a single test file
```

Seed data: start the server, then `bash scripts/seed-data.sh`.

## Architecture

**RiceFinanceU** (资产快照账本) is a personal asset tracking app. It uses snapshot-based ledgering: users define assets (funds, stocks, deposits, cash, etc.) then record periodic snapshots of their values. Each snapshot only needs the assets that changed — unchanged values carry forward from the previous snapshot.

### Stack

React 19 + TypeScript 6 + Vite 8 (frontend), Express 5 + tsx (backend), Vitest (testing), Recharts (charts), plain CSS.

### Backend (`server/`)

- `server/index.ts` — Express entry, JSON body parser (10MB limit), mounts routes under `/api`
- `server/storage.ts` — File-based JSON persistence in `data/` (assets.json, snapshots.json, snapshot-values.json, rates.json, meta.json). Atomic writes via tmp-file + rename. Schema version 2.
- `server/routes/dataRoutes.ts` — CRUD for assets, snapshots, snapshot values, and exchange rates. Snapshot creation handles inline asset creation and carries forward previous values for unchanged assets.
- `server/routes/importExportRoutes.ts` — Full JSON export/import of all data for backup.

### Frontend (`src/`)

- `src/types/finance.ts` — All domain types: `Asset`, `Snapshot`, `SnapshotValue`, `ExchangeRates`, `CreateSnapshotInput`, `ExportData`. Multi-currency support (CNY/USD/HKD).
- `src/api/client.ts` — Typed `fetch` wrapper for all `/api` endpoints. Every function returns typed promises.
- `src/main.tsx` → `src/App.tsx` — React Router with 3 routes under a sidebar `Layout`: `/` (Dashboard), `/assets` (Assets), `/entry` (Entry/backup).
- `src/pages/DashboardPage.tsx` — Shows total assets (CNY-converted), allocation bars, most recent snapshot comparison, historical line chart (Recharts), and expandable snapshot history list with delete.
- `src/pages/AssetsPage.tsx` — Sortable table of assets (active + inactive). Columns: name, type, currency, institution, latest amount, profit/rate (investment only). Displays values from the most recent snapshot.
- `src/pages/EntryPage.tsx` — Wraps `SnapshotForm` for data entry, plus JSON backup export/import UI.
- `src/components/SnapshotForm.tsx` — The core data entry form. Lists all active assets with checkboxes. Unchecked assets carry forward from the previous snapshot. Investment assets have auto-calculating amount/profit/profitRate fields. Supports inline creation of new assets during snapshot entry.
- `src/components/SnapshotComparison.tsx` — Shows amount/profit diffs between the two most recent snapshots.

### Domain Layer (`src/domain/`)

Pure TypeScript, no React — these hold the business logic and are tested independently.

- `assets.ts` — Classifiers: `isInvestmentType` (fund/stock/gold), `isBalanceType` (everything else), `filterActiveAssets`, `groupAssetsByType`, `ASSET_TYPE_LABELS` (Chinese labels).
- `money.ts` — `roundMoney` (2 decimal places) and `formatMoney` (comma-separated display).
- `snapshots.ts` — Core calculations:
  - `completeSnapshotValues` — Merges a partial snapshot submission with the previous snapshot's values (copy prev → override submitted).
  - `calculateSnapshotTotal` — Aggregates values into totals with currency conversion to CNY.
  - `calculateAllocation` — Percentage breakdown by asset type.
  - `compareSnapshots` — Computes per-asset deltas between two snapshots.
  - `buildTotalAssetSeries` — Builds chronological time series from all snapshots for the chart.
- `portfolio.ts` — Re-exports everything from `snapshots.ts`.

### Key Design Decisions

- **Two asset categories**: Investment (fund/stock/gold) tracks profit/profitRate; Balance (deposit/cash/housing_fund/other) only tracks amount. Profit fields on balance assets are rejected by the server.
- **Partial snapshot updates**: Users only fill in changed assets. `completeSnapshotValues` handles carrying forward previous values for untouched assets. Checkboxes in the form control which assets are included.
- **Multi-currency**: Each asset has a currency field. Totals are computed in both the native currency and CNY-converted amounts using adjustable exchange rates (stored in `rates.json`).
- **Soft delete**: Assets are marked `isActive: false` rather than removed, preserving historical snapshot data. Snapshots are hard-deleted along with their values.
- **Inline asset creation**: When entering a snapshot, users can create new assets on the fly without leaving the form.
- **Auto-calculation in SnapshotForm**: For investment assets, editing amount/profit/profitRate auto-calculates the other fields. Stops cascading when the input is an incomplete decimal (e.g., "2.").
