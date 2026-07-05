# RiceFinanceU Modules

`modules/` contains all production code. Treat each child directory as a module with its own responsibility and local edit rules.

## Module Map

| Module | Responsibility |
|---|---|
| `finance-core/` | Target home for shared asset-ledger domain rules. The first structural pass keeps existing domain code in `web-app/src/domain`; move code here only when the shared interface is explicit. |
| `worker-api/` | Cloudflare Worker API, auth, KV persistence, import/export, and HTTP routing. |
| `web-app/` | React/Vite desktop web client. |
| `miniprogram-app/` | Native WeChat miniprogram client. |

## Dependency Direction

```txt
web-app           -> finance-core
miniprogram-app   -> finance-core
worker-api        -> finance-core
finance-core      -> no app/api/runtime dependency
```

During this transition, some domain code still lives in `web-app/src/domain` and is mirrored in `worker-api` or `miniprogram-app`. Do not add new duplicated business rules; prefer planning a move into `finance-core`.

## Reviewer Note

For non-trivial changes, review the module README first, then check `docs/architecture/dependency-rules.md`.
