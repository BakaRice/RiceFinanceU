# Miniprogram Read-Only Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the WeChat miniprogram into a three-tab read-only companion for current assets, asset history, and income.

**Architecture:** Keep the native WeChat runtime and existing Worker API. Add focused pure read-model modules plus a session-only data service; pages consume those models and a reusable Canvas line-chart component. Remove business-data mutations from the miniprogram API surface and remove the entry/data pages entirely.

**Tech Stack:** Native WeChat miniprogram (CommonJS, WXML, WXSS, Canvas 2D), Node `node:test`, existing Cloudflare Worker read endpoints.

---

## File map

- `modules/miniprogram-app/app.json`: register the three tabs and two non-tab pages.
- `modules/miniprogram-app/app.js`: clear session-only data when the app starts or session ends.
- `modules/miniprogram-app/utils/api.js`: expose authentication and read-only finance endpoints only.
- `modules/miniprogram-app/utils/portfolio.js`: pure snapshot, comparison, trend, asset-list, and asset-detail read models.
- `modules/miniprogram-app/utils/income.js`: pure income summaries, monthly series, category rows, and recent-record models.
- `modules/miniprogram-app/utils/readonly-data.js`: session-only cache and request deduplication.
- `modules/miniprogram-app/utils/account.js`: shared account action sheet and logout behavior.
- `modules/miniprogram-app/components/line-chart/`: reusable Canvas line chart; receives display-ready points.
- `modules/miniprogram-app/pages/index/`: overview page.
- `modules/miniprogram-app/pages/assets/`: searchable, filterable read-only asset list.
- `modules/miniprogram-app/pages/asset-detail/`: read-only asset history and profile.
- `modules/miniprogram-app/pages/income/`: read-only income dashboard.
- `modules/miniprogram-app/pages/entry/`, `pages/data/`: delete after their replacements are registered.

### Task 1: Lock navigation and API to read-only

**Files:**
- Modify: `modules/miniprogram-app/app-config.test.mjs`
- Modify: `modules/miniprogram-app/app.json`
- Modify: `modules/miniprogram-app/utils/api.test.mjs`
- Modify: `modules/miniprogram-app/utils/api.js`
- Rename: `modules/miniprogram-app/assets/tabbar/data.png` to `modules/miniprogram-app/assets/tabbar/income.png`
- Rename: `modules/miniprogram-app/assets/tabbar/data-active.png` to `modules/miniprogram-app/assets/tabbar/income-active.png`

- [ ] **Step 1: Write failing configuration and API-surface tests**

Replace the tab expectations with:

```js
assert.deepEqual(appConfig.tabBar.list.map((item) => item.pagePath), [
  'pages/index/index',
  'pages/assets/assets',
  'pages/income/income',
])
assert.deepEqual(appConfig.tabBar.list.map((item) => item.text), [
  '总览',
  '资产',
  '收入',
])
assert.ok(appConfig.pages.includes('pages/asset-detail/asset-detail'))
assert.equal(appConfig.pages.includes('pages/entry/entry'), false)
assert.equal(appConfig.pages.includes('pages/data/data'), false)
```

Replace mutation endpoint tests with:

```js
test('finance API exposes only read operations', async () => {
  globalThis.wx = createWxMock(() => ({ statusCode: 200, data: [] }))
  const api = loadCommonJs('utils/api.js')

  assert.deepEqual(Object.keys(api).sort(), [
    'getAssets',
    'getIncomeRecords',
    'getLatestSnapshot',
    'getRates',
    'getSnapshotValues',
    'getSnapshots',
    'login',
    'logout',
    'request',
  ])

  await api.getSnapshotValues()
  await api.getIncomeRecords()
  assert.match(globalThis.wx.requests[0].url, /\/snapshot-values$/)
  assert.match(globalThis.wx.requests[1].url, /\/income-records$/)
})
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
node --test modules/miniprogram-app/app-config.test.mjs modules/miniprogram-app/utils/api.test.mjs
```

Expected: FAIL because the old four tabs and mutation methods still exist.

- [ ] **Step 3: Update page registration, icons, and API exports**

Set `pages` and `tabBar.list` to:

```json
{
  "pages": [
    "pages/index/index",
    "pages/assets/assets",
    "pages/income/income",
    "pages/asset-detail/asset-detail",
    "pages/login/login"
  ],
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "总览",
        "iconPath": "assets/tabbar/overview.png",
        "selectedIconPath": "assets/tabbar/overview-active.png"
      },
      {
        "pagePath": "pages/assets/assets",
        "text": "资产",
        "iconPath": "assets/tabbar/assets.png",
        "selectedIconPath": "assets/tabbar/assets-active.png"
      },
      {
        "pagePath": "pages/income/income",
        "text": "收入",
        "iconPath": "assets/tabbar/income.png",
        "selectedIconPath": "assets/tabbar/income-active.png"
      }
    ]
  }
}
```

Preserve existing `window`, `style`, `sitemapLocation`, and `lazyCodeLoading`. Rename the retired data icons with `git mv`. In `api.js`, remove `createAsset`, `updateAsset`, `deleteAsset`, `createSnapshot`, `exportData`, and `importData`; add:

```js
getSnapshotValues() {
  return request('/snapshot-values')
},
getIncomeRecords() {
  return request('/income-records')
},
```

- [ ] **Step 4: Run focused tests and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the read-only shell**

```bash
git add modules/miniprogram-app/app.json modules/miniprogram-app/app-config.test.mjs modules/miniprogram-app/utils/api.js modules/miniprogram-app/utils/api.test.mjs modules/miniprogram-app/assets/tabbar
git commit -m "refactor: make miniprogram navigation read only"
```

### Task 2: Build portfolio read models

**Files:**
- Create: `modules/miniprogram-app/utils/portfolio.js`
- Create: `modules/miniprogram-app/utils/portfolio.test.mjs`
- Modify: `modules/miniprogram-app/utils/finance.js`
- Modify: `modules/miniprogram-app/utils/finance.test.mjs`

- [ ] **Step 1: Write failing tests for comparison, trends, rows, and detail**

Cover these exported contracts:

```js
const {
  buildLatestComparison,
  buildPortfolioSeries,
  filterSeriesByRange,
  buildAssetRows,
  buildAssetDetail,
} = portfolio

assert.deepEqual(
  buildLatestComparison({ assets, snapshots, values, rates }),
  {
    currentTotal: 1200,
    previousTotal: 1000,
    change: 200,
    changeRate: 0.2,
    changedAssets: [
      { assetId: 'fund', name: '基金', currentAmountCNY: 1200, changeCNY: 200 },
    ],
  },
)

assert.deepEqual(
  buildPortfolioSeries({ assets, snapshots, values, rates }).map((point) => point.snapshotId),
  ['s-old', 's-new'],
)

assert.deepEqual(
  filterSeriesByRange(series, '1m', new Date('2026-07-18T00:00:00Z')),
  series.filter((point) => point.recordedAt >= '2026-06-18T00:00:00.000Z'),
)

assert.deepEqual(buildAssetRows({ assets, latestData, rates, query: '银行', category: 'balance' })
  .map((row) => row.id), ['cash'])

assert.equal(buildAssetDetail({ assetId: 'fund', assets, snapshots, values, rates }).series.length, 2)
```

Also change `finance.test.mjs` so it no longer tests `buildEntryRows` or `buildSnapshotPayload`; assert those exports are absent.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test modules/miniprogram-app/utils/finance.test.mjs modules/miniprogram-app/utils/portfolio.test.mjs
```

Expected: FAIL because `portfolio.js` does not exist and entry helpers still exist.

- [ ] **Step 3: Implement deterministic portfolio functions**

`portfolio.js` should require `./finance` and export the five tested functions. Use these rules:

```js
const RANGE_MONTHS = { '1m': 1, '6m': 6, '1y': 12 }

function filterSeriesByRange(series, range, now) {
  if (range === 'all') return series.slice()
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RANGE_MONTHS[range])
  return series.filter((point) => new Date(point.recordedAt) >= cutoff)
}
```

Sort snapshots ascending for chart series and descending for latest comparison. Group values by `snapshotId`. Convert each value using the asset currency and current rates. Ignore values whose asset is missing or whose amount is not finite. Compute changed assets from the two latest complete snapshots and sort by `Math.abs(changeCNY)` descending.

`buildAssetRows` must retain paused assets, sort finite amounts descending, then missing values, and filter by case-insensitive name/institution plus investment/balance category.

`buildAssetDetail` must return `null` for a missing asset and otherwise return current display values, profile rows, a chronological series, and descending history.

Remove the entry-only helpers and validators from `finance.js` while retaining currency conversion, totals, type labels, entry-status reading, money/percent/date formatting, and their exports.

- [ ] **Step 4: Run tests and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit portfolio models**

```bash
git add modules/miniprogram-app/utils/finance.js modules/miniprogram-app/utils/finance.test.mjs modules/miniprogram-app/utils/portfolio.js modules/miniprogram-app/utils/portfolio.test.mjs
git commit -m "feat: add miniprogram portfolio read models"
```

### Task 3: Build income read models

**Files:**
- Create: `modules/miniprogram-app/utils/income.js`
- Create: `modules/miniprogram-app/utils/income.test.mjs`

- [ ] **Step 1: Write failing income aggregation tests**

Use records containing salary, housing fund, bonus, and an invalid date. Assert:

```js
const summary = income.buildIncomeSummary(records)
assert.equal(summary.month, '2026-07')
assert.equal(summary.spendableTotal, 13000)
assert.equal(summary.restrictedTotal, 2000)
assert.equal(summary.total, 15000)

assert.deepEqual(
  income.buildMonthlyIncomeSeries(records, '6m', new Date('2026-07-18T00:00:00Z'))
    .map((point) => point.month),
  ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'],
)

assert.equal(income.buildMonthlyIncomeSeries(records, '6m', now)[2].amount, 0)
assert.deepEqual(income.buildRecentIncomeRows(records, 5).map((row) => row.id), ['newest', 'older'])
```

Assert public category labels and that `housing_fund` is restricted while every other supported category is spendable.

- [ ] **Step 2: Run the test and verify failure**

```bash
node --test modules/miniprogram-app/utils/income.test.mjs
```

Expected: FAIL because `income.js` does not exist.

- [ ] **Step 3: Implement income summaries and continuous month series**

Export:

```js
module.exports = {
  INCOME_CATEGORY_LABELS,
  buildIncomeSummary,
  buildMonthlyIncomeSeries,
  buildIncomeCategoryRows,
  buildRecentIncomeRows,
}
```

Validate dates with a strict `YYYY-MM-DD` parser. `buildIncomeSummary` uses the newest month that has valid records. `buildMonthlyIncomeSeries` aggregates by month, creates every month in the selected window (`6m`, `1y`, or all from first to last), and fills missing months with zero. `buildIncomeCategoryRows` uses the same latest month as the summary. `buildRecentIncomeRows` sorts by `occurredAt` descending and formats only present source/note fields.

- [ ] **Step 4: Run the test and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit income models**

```bash
git add modules/miniprogram-app/utils/income.js modules/miniprogram-app/utils/income.test.mjs
git commit -m "feat: add miniprogram income read models"
```

### Task 4: Add the session-only read data service

**Files:**
- Create: `modules/miniprogram-app/utils/readonly-data.js`
- Create: `modules/miniprogram-app/utils/readonly-data.test.mjs`
- Create: `modules/miniprogram-app/utils/account.js`
- Modify: `modules/miniprogram-app/app.js`
- Modify: `modules/miniprogram-app/pages/login/login.js`

- [ ] **Step 1: Write failing cache and logout tests**

Inject a fake API via the module's test-only `createReadonlyDataService(api)` factory. Verify concurrent calls share one Promise, cached calls do not request again, `force: true` refreshes, and `clear()` drops all values:

```js
const service = createReadonlyDataService(fakeApi)
const [left, right] = await Promise.all([service.loadPortfolio(), service.loadPortfolio()])
assert.equal(calls.assets, 1)
assert.equal(left, right)
await service.loadPortfolio({ force: true })
assert.equal(calls.assets, 2)
service.clear()
assert.equal(service.peekPortfolio(), null)
```

Verify `account.showAccountMenu()` calls `api.logout()`, clears the read service, and redirects to `/pages/login/login` only after the user selects “退出登录”.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test modules/miniprogram-app/utils/readonly-data.test.mjs
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement cache, request orchestration, and logout**

`loadPortfolio` requests assets, snapshots, snapshot values, latest snapshot, and rates in parallel. `loadIncome` requests income records. Store only in module memory:

```js
function clear() {
  portfolioCache = null
  incomeCache = null
  portfolioPromise = null
  incomePromise = null
}
```

Do not call `wx.setStorageSync` for finance data. In `app.js`, call `readonlyData.clear()` on launch so a new process starts empty. After successful login, clear any stale read cache before switching to the overview tab.

- [ ] **Step 4: Run tests and verify pass**

Run the command from Step 2 plus `pages/login/login.test.mjs`. Expected: PASS.

- [ ] **Step 5: Commit the session data boundary**

```bash
git add modules/miniprogram-app/utils/readonly-data.js modules/miniprogram-app/utils/readonly-data.test.mjs modules/miniprogram-app/utils/account.js modules/miniprogram-app/app.js modules/miniprogram-app/pages/login/login.js
git commit -m "feat: cache miniprogram reads for one session"
```

### Task 5: Add the reusable Canvas line chart

**Files:**
- Create: `modules/miniprogram-app/components/line-chart/line-chart.json`
- Create: `modules/miniprogram-app/components/line-chart/line-chart.wxml`
- Create: `modules/miniprogram-app/components/line-chart/line-chart.wxss`
- Create: `modules/miniprogram-app/components/line-chart/line-chart.js`
- Create: `modules/miniprogram-app/components/line-chart/line-chart.test.mjs`

- [ ] **Step 1: Write failing component-contract tests**

Load the component definition with a mocked `Component` and assert it declares `points`, `emptyText`, and `tone` properties; exposes `draw`, `handleTouch`, and `clearTouch`; and contains a Canvas 2D node plus a visible empty state.

Also test the exported pure helpers:

```js
assert.deepEqual(chart.calculateDomain([{ value: 100 }, { value: 120 }]), [98, 122])
assert.deepEqual(chart.calculateDomain([{ value: 100 }]), [95, 105])
assert.deepEqual(chart.calculateDomain([]), [0, 1])
assert.equal(chart.findNearestPoint([{ x: 10 }, { x: 40 }], 31).x, 40)
```

- [ ] **Step 2: Run the test and verify failure**

```bash
node --test modules/miniprogram-app/components/line-chart/line-chart.test.mjs
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the Canvas component**

Use `<canvas type="2d" id="lineChart" bindtouchstart="handleTouch" bindtouchmove="handleTouch" bindtouchend="clearTouch" />`. On `ready` and whenever `points` changes, query the node and size, scale by `wx.getWindowInfo().pixelRatio`, calculate a padded domain, and draw axes, three horizontal guides, the line, and points.

The component receives points shaped as:

```js
{
  key: 's1',
  label: '07-18',
  recordedLabel: '2026-07-18 10:30',
  value: 449123.45,
  valueText: '¥449,123.45',
}
```

Touch selects the nearest precomputed x coordinate and renders a WXML tooltip. The component must never fetch or aggregate data.

- [ ] **Step 4: Run the test and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the chart**

```bash
git add modules/miniprogram-app/components/line-chart
git commit -m "feat: add native miniprogram line chart"
```

### Task 6: Rebuild the overview page

**Files:**
- Modify: `modules/miniprogram-app/pages/index/index.js`
- Modify: `modules/miniprogram-app/pages/index/index.json`
- Modify: `modules/miniprogram-app/pages/index/index.wxml`
- Modify: `modules/miniprogram-app/pages/index/index.wxss`
- Modify: `modules/miniprogram-app/pages/index/index.test.mjs`

- [ ] **Step 1: Write failing overview behavior tests**

Mock two snapshots, all snapshot values, assets, rates, and income records. Assert the page requests the read-data service, then exposes:

```js
assert.equal(page.data.hero.totalText, '¥1,200.00')
assert.equal(page.data.hero.changeText, '+¥200.00')
assert.equal(page.data.hero.changeRateText, '+20.00%')
assert.equal(page.data.trendRange, '6m')
assert.equal(page.data.changedAssets.length, 1)
assert.equal(page.data.incomeSummary.spendableText, '¥13,000.00')
```

Verify `changeTrendRange` updates visible chart points without new requests, `openAsset` calls `wx.navigateTo` with the encoded asset id, pull-down refresh forces reload, and the WXML contains no edit/save/import/export/entry controls.

- [ ] **Step 2: Run the overview test and verify failure**

```bash
node --test modules/miniprogram-app/pages/index/index.test.mjs
```

Expected: FAIL against the old overview model.

- [ ] **Step 3: Implement the read-only overview**

Register the chart in `index.json`:

```json
{ "usingComponents": { "line-chart": "/components/line-chart/line-chart" }, "enablePullDownRefresh": true }
```

Build page data from `portfolio.buildLatestComparison`, `portfolio.buildPortfolioSeries`, and `income.buildIncomeSummary`. Render the hero card before trend and supporting sections. Use a compact `1月 / 6月 / 1年 / 全部` segmented control. Add a top-right account menu button wired to `account.showAccountMenu()`.

When there are no snapshots, render “暂无资产快照，请前往 PC 端维护数据” rather than an entry link. When refresh fails after prior success, preserve data and show a toast; only first-load failure replaces the page body.

- [ ] **Step 4: Run the overview and model tests**

```bash
node --test modules/miniprogram-app/pages/index/index.test.mjs modules/miniprogram-app/utils/portfolio.test.mjs modules/miniprogram-app/utils/income.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit overview**

```bash
git add modules/miniprogram-app/pages/index
git commit -m "feat: turn miniprogram overview into readonly dashboard"
```

### Task 7: Rebuild assets and add asset detail

**Files:**
- Modify: `modules/miniprogram-app/pages/assets/assets.js`
- Modify: `modules/miniprogram-app/pages/assets/assets.json`
- Modify: `modules/miniprogram-app/pages/assets/assets.wxml`
- Modify: `modules/miniprogram-app/pages/assets/assets.wxss`
- Modify: `modules/miniprogram-app/pages/assets/assets.test.mjs`
- Create: `modules/miniprogram-app/pages/asset-detail/asset-detail.js`
- Create: `modules/miniprogram-app/pages/asset-detail/asset-detail.json`
- Create: `modules/miniprogram-app/pages/asset-detail/asset-detail.wxml`
- Create: `modules/miniprogram-app/pages/asset-detail/asset-detail.wxss`
- Create: `modules/miniprogram-app/pages/asset-detail/asset-detail.test.mjs`

- [ ] **Step 1: Replace mutation tests with read-only list and detail tests**

Assets tests must cover search by institution, `investment`/`balance` filtering, descending CNY sorting, paused badges, pull-down refresh, and navigation:

```js
page.onSearchInput({ detail: { value: '银行' } })
assert.deepEqual(page.data.rows.map((row) => row.id), ['cash'])
page.onCategoryChange({ currentTarget: { dataset: { value: 'investment' } } })
assert.ok(page.data.rows.every((row) => row.isInvestment))
page.openAsset({ currentTarget: { dataset: { id: 'fund' } } })
assert.deepEqual(navigations, [{ url: '/pages/asset-detail/asset-detail?id=fund' }])
```

Detail tests must cover missing id, investment values, profile field rendering, range switching without refetch, no history, and account-menu availability.

- [ ] **Step 2: Run page tests and verify failure**

```bash
node --test modules/miniprogram-app/pages/assets/assets.test.mjs modules/miniprogram-app/pages/asset-detail/asset-detail.test.mjs
```

Expected: FAIL because the old assets page mutates and detail does not exist.

- [ ] **Step 3: Implement the asset list**

Use `readonlyData.loadPortfolio()` and `portfolio.buildAssetRows()`. Keep `allRows` in instance state, not WXML data, and derive visible rows whenever search or category changes. Render original amount, CNY equivalent, profit/rate for investments, and a paused badge. Delete the form mask, row action buttons, confirmation dialogs, and every mutation handler.

- [ ] **Step 4: Implement asset detail**

Read the id from `onLoad(options)`, call `buildAssetDetail`, and store the full chronological series on the instance. Range switching uses `filterSeriesByRange` only. Register the line chart. Render profile rows only when populated and render history descending. If the asset does not exist, show “资产不存在或已被移除” with a back action.

- [ ] **Step 5: Run page tests and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit assets and detail**

```bash
git add modules/miniprogram-app/pages/assets modules/miniprogram-app/pages/asset-detail
git commit -m "feat: add readonly miniprogram asset details"
```

### Task 8: Add the income dashboard

**Files:**
- Create: `modules/miniprogram-app/pages/income/income.js`
- Create: `modules/miniprogram-app/pages/income/income.json`
- Create: `modules/miniprogram-app/pages/income/income.wxml`
- Create: `modules/miniprogram-app/pages/income/income.wxss`
- Create: `modules/miniprogram-app/pages/income/income.test.mjs`

- [ ] **Step 1: Write failing income-page tests**

Mock valid and invalid income records. Assert summary, default six-month chart, categories, recent order, range switching, pull-down refresh, empty state, and failure state:

```js
assert.equal(page.data.summary.spendableText, '¥13,000.00')
assert.equal(page.data.summary.restrictedText, '¥2,000.00')
assert.equal(page.data.range, '6m')
assert.equal(page.data.series.length, 6)
assert.deepEqual(page.data.recentRows.map((row) => row.id), ['newest', 'older'])
```

Read the WXML and assert it contains no `input`, `textarea`, save, add, edit, or delete control.

- [ ] **Step 2: Run the test and verify failure**

```bash
node --test modules/miniprogram-app/pages/income/income.test.mjs
```

Expected: FAIL because the income page does not exist.

- [ ] **Step 3: Implement income page and styles**

Use `readonlyData.loadIncome()` plus `buildIncomeSummary`, `buildMonthlyIncomeSeries`, `buildIncomeCategoryRows`, and `buildRecentIncomeRows`. Register the line chart and enable pull-down refresh. Render `近6月 / 近1年 / 全部`, category rows, and recent records. For empty data show “暂无收入记录，请前往 PC 端维护数据”. Add the shared account menu button.

- [ ] **Step 4: Run income tests and verify pass**

```bash
node --test modules/miniprogram-app/pages/income/income.test.mjs modules/miniprogram-app/utils/income.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit income page**

```bash
git add modules/miniprogram-app/pages/income
git commit -m "feat: add readonly miniprogram income dashboard"
```

### Task 9: Remove retired write pages and enforce the read-only boundary

**Files:**
- Delete: `modules/miniprogram-app/pages/entry/entry.js`
- Delete: `modules/miniprogram-app/pages/entry/entry.json`
- Delete: `modules/miniprogram-app/pages/entry/entry.wxml`
- Delete: `modules/miniprogram-app/pages/entry/entry.wxss`
- Delete: `modules/miniprogram-app/pages/data/data.js`
- Delete: `modules/miniprogram-app/pages/data/data.json`
- Delete: `modules/miniprogram-app/pages/data/data.wxml`
- Delete: `modules/miniprogram-app/pages/data/data.wxss`
- Delete: `modules/miniprogram-app/pages/data/data.test.mjs`
- Modify: `modules/miniprogram-app/app-config.test.mjs`
- Modify: `modules/miniprogram-app/README.md`

- [ ] **Step 1: Add a failing source-boundary test**

In `app-config.test.mjs`, walk registered page JS/WXML plus `utils/api.js` and assert retired business-write markers are absent:

```js
for (const marker of [
  'createAsset', 'updateAsset', 'deleteAsset', 'createSnapshot',
  'importData', 'exportData', 'handleSave', 'handleImport', 'handlePermanentDelete',
]) {
  assert.equal(source.includes(marker), false, `${marker} must not ship in the miniprogram`)
}
```

Assert the retired page directories no longer exist.

- [ ] **Step 2: Run the boundary test and verify failure**

```bash
node --test modules/miniprogram-app/app-config.test.mjs
```

Expected: FAIL while the old source files remain.

- [ ] **Step 3: Delete retired pages and update module documentation**

Remove both page directories. Update `README.md` responsibility to “read-only mobile companion” and list `总览 / 资产 / 收入`, asset detail, current Worker read endpoints, and `npm run mini:test`. Explicitly state that all maintenance happens on PC.

- [ ] **Step 4: Run the boundary test and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A modules/miniprogram-app/pages/entry modules/miniprogram-app/pages/data modules/miniprogram-app/app-config.test.mjs modules/miniprogram-app/README.md
git commit -m "chore: remove miniprogram write workflows"
```

### Task 10: Full verification and documentation consistency

**Files:**
- Inspect: `modules/miniprogram-app/**/*.test.mjs`
- Modify: `docs/PROJECT_INDEX.md`

- [ ] **Step 1: Run the complete miniprogram suite**

```bash
npm run mini:test
```

Expected: all miniprogram tests PASS. A failure must be corrected in the file named by its stack trace, then the same command must be rerun until it exits with code 0.

- [ ] **Step 2: Run repository regression tests**

```bash
npm test
```

Expected: frontend/domain and Worker tests PASS.

- [ ] **Step 3: Check shipped source and formatting**

```bash
rg -n "createAsset|updateAsset|deleteAsset|createSnapshot|importData|exportData|前往.*录入" modules/miniprogram-app
git diff --check
git status --short
```

Expected: no shipped mutation marker except negative assertions in tests/documentation; no whitespace errors; only intended changes plus the pre-existing `CLAUDE.md` modification.

- [ ] **Step 4: Update project index if its miniprogram description is stale**

The module map must describe the miniprogram as a read-only companion and must not claim it performs snapshot entry or data management.

- [ ] **Step 5: Commit final verification adjustments**

```bash
git add modules/miniprogram-app docs/PROJECT_INDEX.md
git commit -m "docs: describe readonly miniprogram companion"
```

Do not stage or commit the user's pre-existing `CLAUDE.md` modification.
