# 微信小程序 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `wx-miniprogram/` 中实现可登录、可查看总览、可录入快照的原生微信小程序。

**Architecture:** 小程序作为现有 Cloudflare Worker API 的独立移动端客户端，不新增后端。页面层只处理交互，API token 管理集中在 `utils/api.js` 和 `utils/session.js`，金额计算和录入 payload 构造集中在 `utils/finance.js` 并用 Node 测试覆盖。

**Tech Stack:** 原生微信小程序、`wx.request`、Cloudflare Worker API、Node `--test`。

---

### File Structure

- Create: `wx-miniprogram/config.js` - 线上 Worker API 基础地址。
- Create: `wx-miniprogram/utils/session.js` - session token 本地缓存。
- Create: `wx-miniprogram/utils/api.js` - `wx.request` Promise 封装和业务接口。
- Create: `wx-miniprogram/utils/finance.js` - 小程序端资产类型、金额格式化、汇总和录入 payload 构造。
- Create: `wx-miniprogram/utils/finance.test.mjs` - 小程序核心纯函数测试。
- Create: `wx-miniprogram/pages/login/*` - 登录页。
- Modify: `wx-miniprogram/pages/index/*` - 把模板首页改成移动端总览页。
- Create: `wx-miniprogram/pages/entry/*` - 快照录入页。
- Modify: `wx-miniprogram/app.js`, `wx-miniprogram/app.json`, `wx-miniprogram/app.wxss` - 注册页面和全局样式。
- Modify: `package.json` - 增加小程序测试脚本。
- Create: `wx-miniprogram/README.md` - 本地打开和域名配置说明。

### Task 1: Finance Utilities

- [ ] Write `wx-miniprogram/utils/finance.test.mjs` with failing tests for summary calculation, entry row prefill, and snapshot payload validation.
- [ ] Run `node --test wx-miniprogram/utils/finance.test.mjs` and confirm it fails because `finance.js` does not exist.
- [ ] Implement `wx-miniprogram/utils/finance.js`.
- [ ] Run the finance test and confirm it passes.

### Task 2: API And Session Layer

- [ ] Create `wx-miniprogram/config.js`, `utils/session.js`, and `utils/api.js`.
- [ ] Ensure `api.js` uses `Authorization: Bearer <token>` when a token exists.
- [ ] Ensure `api.js` clears token and redirects to login on `401`.

### Task 3: Login Page

- [ ] Add `pages/login/login` to `app.json`.
- [ ] Implement WXML/WXSS/JS for email + password login.
- [ ] On success, redirect to `/pages/index/index`.

### Task 4: Dashboard Page

- [ ] Replace template index page with total asset dashboard.
- [ ] Load assets, latest snapshot, snapshots, and rates from Worker API.
- [ ] Render total, investment, balance, profit, asset rows, recent snapshots.
- [ ] Add actions for refresh, go to entry, and logout.

### Task 5: Snapshot Entry Page

- [ ] Add `pages/entry/entry` to `app.json`.
- [ ] Load active assets and latest snapshot values.
- [ ] Render editable rows for amount, profit, and profit rate.
- [ ] Submit `POST /api/snapshots`.
- [ ] Return to dashboard after successful save.

### Task 6: Verification And Docs

- [ ] Add `mini:test` script to `package.json`.
- [ ] Run `npm run mini:test`.
- [ ] Run existing `npm test`.
- [ ] Add `wx-miniprogram/README.md`.
- [ ] Check `git status --short`.
