# AI Native Module Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reorganize RiceFinanceU into an AI-review-friendly module layout without changing product behavior.

**Architecture:** Keep one root npm project for low maintenance. Move all production code under `modules/`, keep project knowledge under `docs/`, and move learning artifacts under `examples/`. Add module README files so future AI agents can read local responsibilities and dependency rules before editing.

**Tech Stack:** React, Vite, TypeScript, Vitest, Cloudflare Worker, WeChat miniprogram native files, Node test runner.

---

### Task 1: Move Runtime Modules

**Files:**
- Move: `src/` to `modules/web-app/src/`
- Move: `public/` to `modules/web-app/public/`
- Move: `index.html` to `modules/web-app/index.html`
- Move: `vite.config.ts` to `modules/web-app/vite.config.ts`
- Move: `worker/` to `modules/worker-api/`
- Move: `wx-miniprogram/` to `modules/miniprogram-app/`
- Move: `demo/` to `examples/`

- [x] **Step 1: Move files with git history preserved**

Run:

```bash
mkdir -p modules examples
git mv src modules/web-app/src
git mv public modules/web-app/public
git mv index.html modules/web-app/index.html
git mv vite.config.ts modules/web-app/vite.config.ts
git mv worker modules/worker-api
git mv wx-miniprogram modules/miniprogram-app
git mv demo examples
```

- [x] **Step 2: Confirm moved directories**

Run:

```bash
find modules examples -maxdepth 2 -type d | sort
```

Expected: `modules/web-app`, `modules/worker-api`, `modules/miniprogram-app`, and `examples/cloudflare-worker-demo` exist.

### Task 2: Update Build and Test Configuration

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `tsconfig.node.json`
- Modify: `modules/web-app/vite.config.ts`
- Modify: `wrangler.jsonc`
- Modify: `eslint.config.js`

- [x] **Step 1: Update root scripts**

Update `package.json` so root commands still work:

```json
"dev": "vite --config modules/web-app/vite.config.ts",
"dev:api": "npm run build && wrangler dev --port 8787",
"dev:all": "concurrently \"npm run dev\" \"npm run dev:api\"",
"build": "tsc && vite build --config modules/web-app/vite.config.ts",
"preview": "vite preview --config modules/web-app/vite.config.ts",
"test:app": "vitest run --config modules/web-app/vite.config.ts",
"worker:test": "node --test modules/worker-api/worker.test.mjs",
"mini:test": "node --test modules/miniprogram-app/app-config.test.mjs modules/miniprogram-app/pages/**/*.test.mjs modules/miniprogram-app/utils/*.test.mjs",
"test": "npm run test:app && npm run worker:test",
"test:watch": "vitest --config modules/web-app/vite.config.ts"
```

- [x] **Step 2: Point TypeScript and Vite at the moved web app**

Update:

```json
"include": ["modules/web-app/src"]
```

in `tsconfig.json`.

Update:

```json
"include": ["modules/web-app/vite.config.ts"]
```

in `tsconfig.node.json`.

Configure `modules/web-app/vite.config.ts` with `root`, `publicDir`, `build.outDir`, and `test.include` so Vite and Vitest run from the moved web module while output stays at root `dist/`.

- [x] **Step 3: Point Wrangler at the moved Worker**

Update `wrangler.jsonc`:

```jsonc
"main": "modules/worker-api/index.js"
```

Keep static assets at root `dist/`.

- [x] **Step 4: Keep generated directories ignored**

Update `eslint.config.js` to ignore root `dist` and local runtime directories.

### Task 3: Add AI-Friendly Module Contracts

**Files:**
- Create: `modules/README.md`
- Create: `modules/web-app/README.md`
- Create: `modules/worker-api/README.md`
- Create: `modules/miniprogram-app/README.md`
- Create: `modules/finance-core/README.md`
- Create: `docs/architecture/module-map.md`
- Create: `docs/architecture/dependency-rules.md`
- Create: `docs/review-checklists/change-review.md`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `docs/PROJECT_INDEX.md`

- [x] **Step 1: Add module README files**

Each module README must state responsibility, allowed dependencies, forbidden dependencies, common edit entry points, required verification, and common AI mistakes.

- [x] **Step 2: Add architecture and review docs**

Add:

```txt
docs/architecture/module-map.md
docs/architecture/dependency-rules.md
docs/review-checklists/change-review.md
```

These documents give the human reviewer and future AI agents the same map.

- [x] **Step 3: Update entry documents**

Update `README.md`, `CLAUDE.md`, and `docs/PROJECT_INDEX.md` so every path points to the new `modules/` and `examples/` layout.

### Task 4: Verify and Commit

**Files:**
- All moved and edited files.

- [x] **Step 1: Run full verification**

Run:

```bash
npm run test
npm run mini:test
npm run build
```

Expected: all commands exit 0. A Vite chunk-size warning is acceptable if the build exits 0.

- [x] **Step 2: Check status and commit**

Run:

```bash
git status --short
git add -A
git commit -m "chore: organize ai-native modules"
```
