# Module Map

RiceFinanceU is organized for an AI-first development workflow: AI writes most code, and the human owner reviews module boundaries, product semantics, and verification evidence.

## Root Layout

```txt
RiceFinanceU/
  docs/       project knowledge, architecture notes, review checklists
  modules/    production code modules
  examples/   learning demos and experiments
```

Root config files remain at the top level so commands can be run from the repository root.

## Production Modules

| Module | Kind | Role |
|---|---|---|
| `modules/finance-core` | domain | Shared asset-ledger rules. Contract shell for now; extract code here deliberately. |
| `modules/worker-api` | adapter | Cloudflare Worker API and KV persistence. |
| `modules/web-app` | adapter | React/Vite desktop client. |
| `modules/miniprogram-app` | adapter | Native WeChat miniprogram client. |

## Product Invariant

The app is a personal asset snapshot ledger, not a transaction journal. Asset master data and snapshot entry must stay separate:

- Asset management answers: what asset exists and how is it identified?
- Snapshot entry answers: what is each asset worth at this point in time?
