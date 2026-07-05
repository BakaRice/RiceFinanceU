# finance-core Module

Target module for shared RiceFinanceU domain rules.

## Current Status

This module is intentionally a contract shell in the first structure migration. Existing TypeScript domain code still lives in `modules/web-app/src/domain`, and Worker/miniprogram logic still mirrors selected rules.

Move code here only when the shared interface is small and clear.

## Responsibility

- Asset type rules.
- Asset profile field definitions and cleanup.
- Snapshot completion and comparison.
- Money formatting and input normalization.
- Currency conversion and rates.

## Interface Expectations

The future interface should be pure and runtime-neutral:

```txt
input data -> deterministic result
```

No React, no DOM, no Worker KV, no WeChat APIs, no network calls.

## Required Verification After Future Extraction

```bash
npm run test:app
npm run worker:test
npm run mini:test
npm run build
```

## Common AI Mistakes

- Moving runtime adapters into the domain core.
- Creating a broad shallow utility package with unrelated helpers.
- Changing financial semantics while only intending to move files.
