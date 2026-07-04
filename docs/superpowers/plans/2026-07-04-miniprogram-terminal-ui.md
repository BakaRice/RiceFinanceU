# Miniprogram Terminal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把微信小程序改成极简移动金融终端 UI，去掉解释性文案，突出资产、金额、状态和操作。

**Architecture:** 保持现有 Cloudflare API、登录流程和页面路由不变。只调整 `wx-miniprogram` 的展示数据、WXML 结构和 WXSS 视觉系统，避免引入新组件库或新运行时。

**Tech Stack:** 微信小程序原生 WXML/WXSS/JS，Node `node:test` 测试，现有 `finance` 工具函数。

---

### Task 1: 总览页展示数据

**Files:**
- Modify: `wx-miniprogram/pages/index/index.test.mjs`
- Modify: `wx-miniprogram/pages/index/index.js`

- [x] **Step 1: Write the failing test**

Add assertions that the dashboard exposes compact amount parts and signed profit tone fields:

```js
assert.deepEqual(page.data.summary.totalParts, {
  prefix: '¥',
  main: '244',
  decimal: '.00',
})
assert.equal(page.data.statCards[2].tone, 'profit')
assert.equal(page.data.assetRows[0].amountParts.main, '20')
assert.equal(page.data.assetRows[0].amountParts.decimal, '.00')
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm run mini:test`

Expected: FAIL because `totalParts`, `tone`, and `amountParts` are not yet produced.

- [x] **Step 3: Write minimal implementation**

Add local money-part helpers in `pages/index/index.js`, keep existing raw text fields for compatibility, and assign:

```js
summary.totalParts = buildMoneyParts(total.totalAmountCNY, '¥')
statCards[2].tone = getSignedTone(total.totalProfitCNY)
assetRows[].amountParts = buildMoneyParts(amount)
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm run mini:test`

Expected: PASS.

### Task 2: 极简移动金融终端页面

**Files:**
- Modify: `wx-miniprogram/app.wxss`
- Modify: `wx-miniprogram/pages/login/login.wxml`
- Modify: `wx-miniprogram/pages/login/login.wxss`
- Modify: `wx-miniprogram/pages/index/index.wxml`
- Modify: `wx-miniprogram/pages/index/index.wxss`
- Modify: `wx-miniprogram/pages/entry/entry.wxml`
- Modify: `wx-miniprogram/pages/entry/entry.wxss`

- [x] **Step 1: Update global UI tokens**

Use a neutral WeChat-like surface: off-white background, white rows, thin borders, low radius, reserved blue primary, green/red signed money states, tabular numeric rendering.

- [x] **Step 2: Simplify login**

Remove descriptive subtitle and resume copy. Keep brand, email, password, login, and a compact existing-session action.

- [x] **Step 3: Simplify dashboard**

Replace card-heavy layout with:

```text
topbar
balance block
3-metric strip
primary action row
asset table
snapshot list
logout
```

- [x] **Step 4: Simplify entry**

Replace large cards with date/time controls, a compact row list, inline inputs, note field, and fixed clear action hierarchy.

### Task 3: Verification and commit

**Files:**
- Verify all touched files.

- [x] **Step 1: Run focused tests**

Run: `npm run mini:test`

Expected: PASS.

- [x] **Step 2: Run full project checks**

Run: `npm test`

Expected: PASS.

Run: `npm run build`

Expected: PASS, allowing the existing Vite chunk-size warning.

- [x] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-07-04-miniprogram-terminal-ui.md wx-miniprogram
git commit -m "feat: refine miniprogram terminal ui"
```
