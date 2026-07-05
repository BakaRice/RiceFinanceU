# worker-api Module

Cloudflare Worker API for RiceFinanceU.

## Responsibility

- Single-user login and bearer-session validation.
- HTTP routing under `/api`.
- Cloudflare KV persistence for the complete asset ledger JSON.
- Import/export and server-side validation.

## Main Entry Points

- `index.js`: Worker fetch handler, routes, validation, and KV adapter usage.
- `worker.test.mjs`: API behavior tests using in-memory KV.

## Allowed Dependencies

- Cloudflare Worker runtime APIs.
- Standard Web APIs available in Workers.
- `finance-core` once shared domain rules are extracted.

## Forbidden Dependencies

- React or browser UI modules.
- WeChat miniprogram APIs.
- DOM-only APIs.

## Required Verification

```bash
npm run worker:test
npm run build
```

## Common AI Mistakes

- Trusting the web client to clean data before save.
- Breaking old backup import compatibility.
- Treating KV as a relational database or high-concurrency write model.
