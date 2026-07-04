# Miniprogram TabBar Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给小程序底部四个菜单补齐统一风格的本地图标。

**Architecture:** 使用微信原生 `tabBar` 的 `iconPath` 和 `selectedIconPath`，图标资源放在 `wx-miniprogram/assets/tabbar/`。不引入组件库，不改页面导航结构。

**Tech Stack:** 微信小程序 `app.json`，本地 PNG 资源，Node `node:test`。

---

### Task 1: TabBar Icon Contract

**Files:**
- Modify: `wx-miniprogram/app-config.test.mjs`
- Modify: `wx-miniprogram/app.json`
- Create: `wx-miniprogram/assets/tabbar/*.png`

- [x] **Step 1: Write failing test**

Assert every tab item has `iconPath` and `selectedIconPath`, both point to PNG files, and the files exist with a PNG signature.

- [x] **Step 2: Run focused test**

Run: `npm run mini:test`

Expected: FAIL because tab items do not have icon paths yet.

- [x] **Step 3: Generate icon assets**

Create inactive and active PNGs for `overview`、`assets`、`entry`、`data`, using inactive `#7a838d` and active `#2d5f7e`.

- [x] **Step 4: Wire app.json**

Add icon paths to the four tab entries.

- [x] **Step 5: Verify and commit**

Run `npm run mini:test`, `npm test`, `npm run build`, then commit the scoped change.
