# Miniprogram PC-Aligned Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把微信小程序导航改成 PC 端侧边栏的移动端映射：总览、资产、录入、数据。

**Architecture:** 使用微信原生 `tabBar` 承载四个业务页，登录页保持非 Tab。新增 `pages/assets` 和 `pages/data`，复用现有 Cloudflare Worker API；小程序 API client 补齐 PC 端已使用的资产和导入导出接口。

**Tech Stack:** 微信小程序 WXML/WXSS/JS，Cloudflare Worker REST API，Node `node:test`。

---

### Task 1: Tab 配置与接口契约

**Files:**
- Modify: `wx-miniprogram/app-config.test.mjs`
- Modify: `wx-miniprogram/utils/api.test.mjs`
- Modify: `wx-miniprogram/app.json`
- Modify: `wx-miniprogram/utils/api.js`

- [x] **Step 1: Add failing tests**

Add app config assertions for:

```js
assert.deepEqual(appConfig.tabBar.list.map((item) => item.pagePath), [
  'pages/index/index',
  'pages/assets/assets',
  'pages/entry/entry',
  'pages/data/data',
])
```

Add API assertions for:

```js
await api.createAsset({ name: '现金', type: 'cash', currency: 'CNY' })
await api.updateAsset('asset-1', { name: '现金账户' })
await api.deleteAsset('asset-1')
await api.exportData()
await api.importData({ meta: { schemaVersion: 2 }, assets: [], snapshots: [], snapshotValues: [] })
```

- [x] **Step 2: Run focused tests and observe failure**

Run: `npm run mini:test`

Expected: FAIL because tabBar and API methods do not exist.

- [x] **Step 3: Implement app config and API client**

Set `app.json` pages to include login plus four business pages. Add `tabBar` list with `总览`、`资产`、`录入`、`数据`. Add `createAsset`、`updateAsset`、`deleteAsset`、`exportData`、`importData` methods in `utils/api.js`.

### Task 2: New tab pages

**Files:**
- Create: `wx-miniprogram/pages/assets/assets.js`
- Create: `wx-miniprogram/pages/assets/assets.wxml`
- Create: `wx-miniprogram/pages/assets/assets.wxss`
- Create: `wx-miniprogram/pages/assets/assets.json`
- Create: `wx-miniprogram/pages/data/data.js`
- Create: `wx-miniprogram/pages/data/data.wxml`
- Create: `wx-miniprogram/pages/data/data.wxss`
- Create: `wx-miniprogram/pages/data/data.json`

- [x] **Step 1: Add Assets tab**

Load assets and latest snapshot. Render enabled and disabled assets. Support create, edit, and deactivate through existing Worker endpoints.

- [x] **Step 2: Add Data tab**

Support export to clipboard, import from pasted JSON, and logout. Keep the page aligned with PC `数据管理`.

### Task 3: Existing page navigation cleanup

**Files:**
- Modify: `wx-miniprogram/pages/login/login.js`
- Modify: `wx-miniprogram/pages/index/index.wxml`
- Modify: `wx-miniprogram/pages/index/index.wxss`
- Modify: `wx-miniprogram/pages/index/index.js`
- Modify: `wx-miniprogram/pages/entry/entry.js`

- [x] **Step 1: Login uses switchTab**

Replace `redirectTo('/pages/index/index')` with `switchTab('/pages/index/index')`.

- [x] **Step 2: Remove dashboard permanent action buttons**

Remove dashboard `录入`、`退出`、常驻 `刷新`; keep error retry and pull-down refresh.

- [x] **Step 3: Entry save returns to overview tab**

After successful save, call `wx.switchTab({ url: '/pages/index/index' })`.

### Task 4: Verification and commit

**Files:**
- Verify all touched files.

- [x] **Step 1: Run focused tests**

Run: `npm run mini:test`

Expected: PASS.

- [x] **Step 2: Run full checks**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS, allowing the existing Vite chunk-size warning.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-04-miniprogram-pc-aligned-navigation-design.md docs/superpowers/plans/2026-07-04-miniprogram-pc-aligned-navigation.md wx-miniprogram
git commit -m "feat: align miniprogram navigation with desktop"
```
