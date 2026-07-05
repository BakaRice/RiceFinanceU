# web-app Module

React/Vite desktop client for RiceFinanceU.

## Responsibility

- Browser routing and authenticated app shell.
- Asset management, snapshot entry, dashboard, details, and data management pages.
- Finance-style display and form ergonomics.

## Main Entry Points

- `src/main.tsx`: React bootstrap.
- `src/App.tsx`: auth gate and routes.
- `src/pages/`: page-level views.
- `src/components/`: reusable UI and form modules.
- `src/api/`: browser API adapter and session token handling.
- `src/domain/`: current pure domain helpers. New shared rules should move toward `modules/finance-core`.

## Allowed Dependencies

- React, React Router, Recharts.
- Browser APIs.
- `finance-core` once shared code is extracted.

## Forbidden Dependencies

- Cloudflare Worker runtime objects.
- WeChat `wx` APIs.
- KV persistence details.

## Required Verification

```bash
npm run test:app
npm run build
```

## Common AI Mistakes

- Putting backend validation or KV assumptions into React pages.
- Mixing asset master-data editing with time-bound snapshot entry.
- Re-implementing money or snapshot rules in page files instead of domain helpers.
