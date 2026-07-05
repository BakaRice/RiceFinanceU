# Change Review Checklist

Use this when reviewing AI-generated changes.

## Scope

- Does the change touch only the modules needed for the request?
- Are examples or docs mixed into production code changes intentionally?
- Did the change avoid speculative multi-user or platform complexity?

## Product Model

- Are `Asset`, `Snapshot`, and `SnapshotValue` responsibilities still separate?
- Does asset profile data remain master data only?
- Does snapshot entry remain time-bound and partial-submit compatible?

## Dependency Direction

- Does `finance-core` stay runtime-neutral?
- Do clients avoid Worker/KV details?
- Does Worker avoid React, DOM, and miniprogram APIs?

## Verification

- For web changes: `npm run test:app` and `npm run build`.
- For Worker changes: `npm run worker:test`.
- For miniprogram changes: `npm run mini:test`.
- For cross-module changes: `npm run test`, `npm run mini:test`, and `npm run build`.

## AI-Specific Checks

- Did AI create a new abstraction that is just a pass-through?
- Did AI copy business logic instead of moving it behind a shared interface?
- Did AI update `README.md`, `CLAUDE.md`, and module README files when paths or responsibilities changed?
