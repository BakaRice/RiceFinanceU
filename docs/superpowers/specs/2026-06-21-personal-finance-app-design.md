# Personal Finance App Technical Design

Date: 2026-06-21

## Goal

Build a local, single-user personal finance web app for managing deposits and fund holdings. The first version should be simple, transparent, and usable without a database.

The app supports:

- Viewing total assets, deposit totals, fund market value, and floating profit/loss.
- Managing deposit accounts such as bank accounts, fixed deposits, Alipay, WeChat balance, and similar cash-like assets.
- Managing fund holdings with manual buy, sell, and net asset value entries.
- Viewing each fund's overall trend chart, including unit NAV, holding market value, cumulative invested amount, and profit/loss.
- Recording basic financial operations so changes can be traced later.
- Persisting all data with local JSON files.
- Exporting and importing complete JSON backups.

The first version intentionally does not support:

- Multiple users.
- Cloud sync.
- Login or authentication.
- Database storage.
- Automatic online fund NAV fetching.
- Full income, expense, category, budget, or bookkeeping workflows.

The core design principle is: local-first, simple storage, explicit data, small modules, and easy future migration.

## Architecture

Use a route-based React/Vite single page application with a thin local Node/Express API.

```txt
React/Vite frontend
    |
    | HTTP JSON API
    v
Node/Express local backend
    |
    | fs read/write
    v
data/*.json files
```

Recommended stack:

- Frontend: React, Vite, TypeScript.
- Routing: React Router.
- Charts: Recharts.
- Forms: plain React state for the first version.
- Backend: Node.js and Express.
- Persistence: local JSON files under `data/`.
- Validation: Zod or a similarly small schema validation layer.
- Styling: plain CSS or CSS Modules.
- Tests: Vitest for domain logic and storage behavior.

The frontend is a single loaded browser app, but it is not a single large page. It should be organized by page, component, API client, shared types, and pure domain calculations.

## Project Structure

```txt
RiceFinanceU/
  package.json
  vite.config.ts
  tsconfig.json

  src/
    main.tsx
    App.tsx

    pages/
      DashboardPage.tsx
      DepositsPage.tsx
      FundsPage.tsx
      FundDetailPage.tsx
      EntryPage.tsx

    components/
      Layout.tsx
      AssetSummary.tsx
      DepositTable.tsx
      FundTable.tsx
      FundChart.tsx
      TransactionList.tsx
      TransactionForm.tsx

    api/
      client.ts

    domain/
      deposits.ts
      funds.ts
      portfolio.ts
      money.ts

    types/
      finance.ts

  server/
    index.ts
    storage.ts
    routes/
      dataRoutes.ts
      importExportRoutes.ts

  data/
    deposits.json
    funds.json
    transactions.json
    nav-prices.json
    meta.json

  docs/
    superpowers/
      specs/
```

## Data Model

### Deposit Account

```ts
type DepositAccount = {
  id: string
  name: string
  institution: string
  accountType: 'cash' | 'current' | 'fixed' | 'money_market' | 'other'
  balance: number
  currency: 'CNY'
  note?: string
  updatedAt: string
}
```

Deposit accounts store current state. Balance changes are also recorded in transactions with the previous and new balance so the user can trace why an account changed.

### Fund

```ts
type Fund = {
  id: string
  code?: string
  name: string
  platform?: string
  currency: 'CNY'
  note?: string
  createdAt: string
  updatedAt: string
}
```

Funds store stable identity and metadata. Position, market value, and profit/loss are derived from transactions and NAV prices.

### Transaction

```ts
type Transaction =
  | {
      id: string
      type: 'deposit_adjustment'
      depositAccountId: string
      amountBefore: number
      amountAfter: number
      occurredAt: string
      note?: string
    }
  | {
      id: string
      type: 'fund_buy'
      fundId: string
      amount: number
      shares: number
      fee?: number
      occurredAt: string
      note?: string
    }
  | {
      id: string
      type: 'fund_sell'
      fundId: string
      amount: number
      shares: number
      fee?: number
      occurredAt: string
      note?: string
    }
  | {
      id: string
      type: 'fund_nav'
      fundId: string
      nav: number
      occurredAt: string
      note?: string
    }
```

Transactions are append-oriented operation records. They are not a full bookkeeping ledger; they only represent the operations required by the first version.

### Fund NAV Price

```ts
type FundNavPrice = {
  id: string
  fundId: string
  nav: number
  date: string
}
```

NAV prices are stored separately from transactions because charts need fast, direct access to time-series data. A NAV entry should also create a `fund_nav` transaction so the operation history remains complete. The backend should write both records as one logical mutation; if either write fails, neither change should be considered successful.

### Metadata

```ts
type Meta = {
  schemaVersion: 1
  updatedAt: string
}
```

`schemaVersion` allows future migrations if the JSON structure changes.

## Persistence

Use multiple JSON files:

```txt
data/
  deposits.json       # deposit account current state
  funds.json          # fund metadata
  transactions.json   # operation history
  nav-prices.json     # fund NAV time-series data
  meta.json           # schema version and last update time
```

Backend storage rules:

- On startup, ensure `data/` and all required JSON files exist.
- Initialize missing files with valid empty arrays or metadata.
- Read JSON through one storage module.
- Validate parsed data before returning it.
- Write changes by first writing a temporary file, then replacing the target file.
- Never overwrite existing data if the new JSON cannot be validated.
- Update `meta.json` after every successful mutation.

This gives simple file persistence while reducing the chance of corrupting data during writes.

## Pages

### Dashboard

`DashboardPage` shows:

- Total assets.
- Deposit total.
- Fund market value.
- Floating profit/loss.
- Asset allocation summary.
- Recent transactions.

### Deposits

`DepositsPage` shows:

- Deposit account list.
- Account institution and type.
- Current balance.
- Last update time.
- Add account action.
- Adjust balance action.

### Funds

`FundsPage` shows:

- Fund list.
- Current shares.
- Latest NAV.
- Current market value.
- Cumulative invested amount.
- Floating profit/loss.
- Link to fund detail page.

### Fund Detail

`FundDetailPage` shows:

- Fund metadata.
- Current position summary.
- Chart with unit NAV, market value, cumulative invested amount, and profit/loss.
- Buy and sell history.
- NAV entry history.

### Entry

`EntryPage` provides one place to record:

- Deposit balance adjustment.
- Fund buy.
- Fund sell.
- Fund NAV entry.

The first version uses this unified entry page to keep workflows simple. Later versions can add inline quick actions on deposit and fund detail pages.

## Domain Logic

Business calculations live in pure functions under `src/domain/`. React components should call these functions instead of embedding finance calculations in UI code.

Suggested modules:

```txt
src/domain/
  deposits.ts
    calculateDepositTotal()

  funds.ts
    calculateFundPosition()
    calculateFundMarketValue()
    calculateFundProfit()
    buildFundChartSeries()

  portfolio.ts
    calculateTotalAssets()
    calculateAssetAllocation()

  money.ts
    formatMoney()
    roundMoney()
```

Fund position calculation uses average cost:

- Buy increases shares and total invested cost.
- Sell decreases shares and reduces cost proportionally by average cost.
- Latest NAV is the most recent NAV price for the fund.
- Current market value equals current shares multiplied by latest NAV.
- Realized profit/loss is sell proceeds minus the average-cost basis of sold shares, adjusted for sell fees.
- Floating profit/loss is current market value minus the remaining average-cost basis of held shares.
- Total profit/loss is realized profit/loss plus floating profit/loss.

Average cost is recommended for the first version because it is easy to explain, easy to test, and adequate for personal asset tracking.

## API Design

Use resource-oriented endpoints:

```txt
GET    /api/deposits
POST   /api/deposits
PATCH  /api/deposits/:id
DELETE /api/deposits/:id

GET    /api/funds
POST   /api/funds
PATCH  /api/funds/:id
DELETE /api/funds/:id

GET    /api/transactions
POST   /api/transactions

GET    /api/funds/:id/nav-prices
POST   /api/funds/:id/nav-prices

GET    /api/export
POST   /api/import
```

The backend remains thin:

- It validates input.
- It reads and writes JSON files.
- It returns clear errors.
- It does not own portfolio calculations in the first version.

The frontend owns derived calculations through pure domain functions. This keeps the backend close to a local file API.

## Frontend State

Do not use Redux or a complex state manager in the first version.

State approach:

- Load page data through `src/api/client.ts`.
- Keep page-level state with `useState` and `useEffect`.
- After mutations, reload the affected resource or page data.
- Keep derived values out of stored state; calculate them from source data.

Future versions can add TanStack Query if request caching, loading states, and mutation invalidation become repetitive.

## Error Handling

Frontend behavior:

- Show loading states while reading data.
- Show an error message and retry action when loading fails.
- Show field-level validation messages for invalid form input.
- Show a clear failure message when saving fails.
- Ask for confirmation before deletion or backup restore.

Backend behavior:

- Missing JSON files are initialized automatically.
- Invalid JSON returns an error and is never overwritten automatically.
- Invalid request bodies return 400.
- Storage failures return 500.
- Mutations should be all-or-nothing at the file level.

Any failed write must be visible to the user.

## Backup And Restore

The first version includes complete data export and import.

Export:

- Returns a single JSON payload containing deposits, funds, transactions, NAV prices, and metadata.

Import:

- Validates the backup structure and `schemaVersion`.
- Rejects invalid backups.
- Requires explicit confirmation before replacing local data.
- Writes all replacement files only after validation succeeds.

This gives the user a simple manual backup path without introducing cloud sync.

## Security

The first version is local-only:

- No login.
- No authentication.
- No encryption.
- The backend should listen on `127.0.0.1`.
- The app is intended for one trusted local user on one machine.

This avoids adding a weak or unnecessary security layer. If remote access, multi-device sync, or shared usage becomes necessary, security should be redesigned before those capabilities are added.

## Testing

Prioritize tests for pure domain logic and storage safety.

Domain tests:

- Deposit total calculation.
- Fund buy position calculation.
- Fund sell position calculation.
- Average cost behavior.
- Latest NAV selection.
- Market value calculation.
- Profit/loss calculation.
- Chart series generation.
- Portfolio total and allocation calculation.

Storage tests:

- Empty data file initialization.
- JSON read behavior.
- JSON write behavior.
- Invalid JSON rejection.
- Import validation rejects malformed backups.

Suggested test files:

```txt
src/domain/funds.test.ts
src/domain/portfolio.test.ts
server/storage.test.ts
```

## Development Sequence

1. Initialize React, Vite, TypeScript, Express, and Vitest.
2. Create the JSON data files and storage module.
3. Define shared finance types.
4. Implement domain calculation functions with tests.
5. Implement backend API routes.
6. Implement the dashboard page.
7. Implement the deposits page.
8. Implement the funds page.
9. Implement fund detail charts.
10. Implement the unified entry page.
11. Implement export and import.
12. Run manual end-to-end verification with sample data.

## Future Enhancements

Possible future upgrades:

- Automatic fund NAV fetching with caching and failure handling.
- Local password or encrypted backup export.
- SQLite migration if JSON files become limiting.
- Desktop packaging with Tauri or Electron.
- Mobile-friendly PWA layout.
- More complete bookkeeping: income, expense, transfer, categories, budgets, and reports.

These are intentionally outside the first version.

## Recommendation

Use:

```txt
React/Vite route-based SPA
+ Node/Express local file API
+ TypeScript
+ multiple JSON files
+ Recharts
+ Vitest
```

This design matches the requested first-principles goal: no database, clear persistence, enough structure to stay maintainable, and a clean path to grow later without rewriting the core application.
