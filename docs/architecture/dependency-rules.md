# Dependency Rules

These rules are guardrails for AI-generated changes.

## Allowed Direction

```txt
modules/web-app           -> modules/finance-core
modules/miniprogram-app   -> modules/finance-core
modules/worker-api        -> modules/finance-core
modules/finance-core      -> no app/api/runtime dependency
examples/*                -> no production dependency
```

## Runtime Separation

`web-app` may use React, browser APIs, Vite, and charting libraries.

`miniprogram-app` may use WeChat `wx` APIs and native miniprogram page structure.

`worker-api` may use Cloudflare Worker APIs and KV bindings.

`finance-core` must stay pure. It should accept data and return results.

## Duplication Rule

Do not add new duplicated business rules across clients. If a rule is needed in more than one runtime, either:

1. Put it behind a small pure interface in `finance-core`, or
2. Document why extraction is deferred and add tests in every affected runtime.

## Review Rule

Any change that crosses two or more modules must state:

- Which module owns the product rule.
- Which modules are adapters.
- Which verification commands were run.
