# PC Financial Workbench UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 PC Web 端升级为统一、精致的个人金融工作台，并修复导入高精度收益率后无法直接保存快照的问题。

**Architecture:** 先在 `domain/money.ts` 建立唯一的截断与表单格式化规则，再由 Worker 导入边界和 `SnapshotForm` 共同复用或镜像该规则。UI 改造保持领域模型和 API 不变，以主题变量、共享页面骨架和既有页面语义为边界逐页落地。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest、Testing Library、Cloudflare Worker、原生 CSS、Recharts。

---

## 文件结构与职责

- `modules/web-app/src/domain/money.ts`：金额与收益率唯一格式化、截断和校验入口。
- `modules/web-app/src/domain/money.test.ts`：截断、百分比表单值和边界输入的纯函数回归测试。
- `modules/web-app/src/components/SnapshotForm.tsx`：把持久化比例安全转换为两位百分比表单值。
- `modules/web-app/src/components/SnapshotForm.test.tsx`：复现导入高精度收益率后直接保存的真实表单链路。
- `modules/web-app/src/pages/DataManagementPage.tsx`：导入前识别非法收益率并统计需要规范化的记录。
- `modules/web-app/src/pages/DataManagementPage.test.tsx`：导入预检提示的回归测试。
- `modules/worker-api/index.js`：导入写入 KV 前的最终收益率规范化防线。
- `modules/worker-api/worker.test.mjs`：导入、导出后收益率精度的 Worker 回归测试。
- `modules/web-app/src/styles/theme.css`：全局颜色、字体、间距、表格、按钮、菜单和页面骨架变量。
- `modules/web-app/src/components/Layout.tsx` / `Layout.css`：品牌区、带图标导航、账户区和自适应内容画布。
- `modules/web-app/src/pages/DashboardPage.tsx` / `.css`：资产摘要、趋势主模块、结构变化双栏和紧凑历史。
- `modules/web-app/src/pages/AssetsPage.tsx` / `.css`：资产主信息层级、低饱和标签和行尾操作。
- `modules/web-app/src/components/SnapshotForm.tsx` / `.css`：吸顶盘点工具栏、录入行状态和结构化保存确认。
- `modules/web-app/src/pages/AssetDetailPage.tsx` / `.css`：金额主视觉和资料分区。
- `modules/web-app/src/pages/LoginPage.tsx` / `.css`：延续工作台品牌气质的登录入口。
- `modules/web-app/src/pages/DataManagementPage.tsx` / `.css`：导出、导入和风险提示层级。
- `modules/web-app/src/components/Feedback/FeedbackContext.tsx`：保留现有 API，统一 Toast 与确认框语义样式。
- `modules/web-app/src/components/Feedback/FeedbackContext.test.tsx`：确认框按钮语义、结构化正文和焦点行为。

### Task 1: 建立收益率截断规则

**Files:**
- Modify: `modules/web-app/src/domain/money.ts`
- Test: `modules/web-app/src/domain/money.test.ts`

- [ ] **Step 1: 写失败测试**

在 `money.test.ts` 增加：

```ts
import {
  formatProfitRateInput,
  truncateDecimal,
  normalizeStoredProfitRate,
} from './money'

describe('profit rate precision', () => {
  it('truncates instead of rounding', () => {
    expect(truncateDecimal(30.769230769, 2)).toBe(30.76)
    expect(truncateDecimal(-30.769230769, 2)).toBe(-30.76)
  })

  it('formats stored ratio as a two-decimal percent input', () => {
    expect(formatProfitRateInput(0.3076923076923077)).toBe('30.76')
    expect(formatProfitRateInput(0)).toBe('0.00')
    expect(formatProfitRateInput(undefined)).toBe('')
  })

  it('normalizes imported stored ratios to four decimals', () => {
    expect(normalizeStoredProfitRate(0.3076923076923077)).toBe(0.3076)
    expect(normalizeStoredProfitRate(-0.3076923076923077)).toBe(-0.3076)
    expect(normalizeStoredProfitRate(-1.01)).toBeNull()
    expect(normalizeStoredProfitRate(Number.NaN)).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/domain/money.test.ts`

Expected: FAIL，提示三个新导出不存在。

- [ ] **Step 3: 实现最小纯函数**

在 `money.ts` 增加：

```ts
export function truncateDecimal(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value
  const factor = 10 ** decimals
  return Math.trunc(value * factor) / factor
}

export function normalizeStoredProfitRate(value: unknown): number | null {
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate < -1) return null
  return truncateDecimal(rate, 4)
}

export function formatProfitRateInput(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return ''
  return truncateDecimal(value * 100, 2).toFixed(2)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:app -- modules/web-app/src/domain/money.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add modules/web-app/src/domain/money.ts modules/web-app/src/domain/money.test.ts
git commit -m "fix: centralize return rate truncation"
```

### Task 2: 在导入边界规范化收益率

**Files:**
- Modify: `modules/web-app/src/pages/DataManagementPage.tsx`
- Test: `modules/web-app/src/pages/DataManagementPage.test.tsx`
- Modify: `modules/worker-api/index.js`
- Test: `modules/worker-api/worker.test.mjs`

- [ ] **Step 1: 写前端预检失败测试**

新增备份包含 `profitRate: 0.3076923076923077` 和 `profitRate: -1.01` 的测试，断言：

```ts
expect(result.normalizedProfitRateCount).toBe(1)
expect(result.issues).toContain('1 个收益率将在导入时截断为百分比两位小数')
expect(result.issues).toContain('快照值[1] "value-invalid": 收益率无效 (-1.01)')
expect(result.hasCriticalIssues).toBe(true)
```

- [ ] **Step 2: 写 Worker 导入失败测试**

导入一个投资资产、快照和高精度快照值，再导出并断言：

```js
assert.equal(importResponse.status, 200)
const exportResponse = await authedRequest(env, '/api/export', { token })
const exported = await exportResponse.json()
assert.equal(exported.snapshotValues[0].profitRate, 0.3076)
```

再导入 `profitRate: -1.01`，断言返回 `400`。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/pages/DataManagementPage.test.tsx && npm run worker:test`

Expected: FAIL，前端没有规范化统计，Worker 仍保留原始精度。

- [ ] **Step 4: 实现前端预检**

扩展 `ImportSummary`：

```ts
normalizedProfitRateCount: number
```

遍历 `snapshotValues` 时：

```ts
if (v.profitRate !== undefined) {
  const normalized = normalizeStoredProfitRate(v.profitRate)
  if (normalized === null) {
    issues.push(`快照值[${i}] "${v.id}": 收益率无效 (${v.profitRate})`)
    hasInvalidProfitRate = true
  } else if (normalized !== v.profitRate) {
    normalizedProfitRateCount++
  }
}
```

在问题列表中追加规范化数量，并把非法收益率计入严重问题。

- [ ] **Step 5: 实现 Worker 最终防线**

在 Worker 中镜像纯函数：

```js
function normalizeStoredProfitRate(value) {
  const rate = Number(value)
  if (!Number.isFinite(rate) || rate < -1) return null
  return Math.trunc(rate * 10000) / 10000
}
```

导入前映射 `snapshotValues`，合法值规范化，非法值返回 `400`。不重算 amount、profit 或历史估值。

- [ ] **Step 6: 运行测试确认通过**

Run: `npm run test:app -- modules/web-app/src/pages/DataManagementPage.test.tsx && npm run worker:test`

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add modules/web-app/src/pages/DataManagementPage.tsx modules/web-app/src/pages/DataManagementPage.test.tsx modules/worker-api/index.js modules/worker-api/worker.test.mjs
git commit -m "fix: normalize imported return rates"
```

### Task 3: 修复快照表单回填与直接保存

**Files:**
- Modify: `modules/web-app/src/components/SnapshotForm.tsx`
- Create: `modules/web-app/src/components/SnapshotForm.test.tsx`

- [ ] **Step 1: 写真实链路失败测试**

Mock `api.getAssets()` 和 `api.getLatestSnapshot()`，返回 `profitRate: 0.3076923076923077`。渲染表单后断言：

```ts
expect(await screen.findByDisplayValue('30.76')).toBeInTheDocument()
fireEvent.click(screen.getByRole('button', { name: '保存快照' }))
expect(confirm).toHaveBeenCalled()
expect(toast).not.toHaveBeenCalledWith(expect.stringContaining('收益率无效'), 'error')
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/components/SnapshotForm.test.tsx`

Expected: FAIL，表单值是长小数且保存提示收益率无效。

- [ ] **Step 3: 使用统一格式化函数回填**

修改行初始化：

```ts
profitRate: formatProfitRateInput(prev?.profitRate),
```

自动计算收益率时也使用截断函数：

```ts
autoCalcValue = truncateDecimal((curProfit / cost) * 100, 2).toFixed(2)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:app -- modules/web-app/src/components/SnapshotForm.test.tsx modules/web-app/src/domain/money.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add modules/web-app/src/components/SnapshotForm.tsx modules/web-app/src/components/SnapshotForm.test.tsx
git commit -m "fix: format imported returns before snapshot entry"
```

### Task 4: 重建主题与应用骨架

**Files:**
- Modify: `modules/web-app/src/styles/theme.css`
- Modify: `modules/web-app/src/index.css`
- Modify: `modules/web-app/src/components/Layout.tsx`
- Modify: `modules/web-app/src/components/Layout.css`
- Test: `modules/web-app/src/App.test.tsx`

- [ ] **Step 1: 扩展应用骨架测试**

断言导航具有 `aria-label="主导航"`，业务链接仍完整，品牌文本为 `Rice Finance`，退出按钮可访问名称不变。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx`

Expected: FAIL，当前导航没有统一语义和新品牌结构。

- [ ] **Step 3: 重写主题变量**

保留现有变量名以降低迁移成本，同时调整为暖灰画布、白色表面、深灰蓝导航和低饱和状态色；增加：

```css
--color-canvas: #f4f5f2;
--color-sidebar: #18232d;
--color-sidebar-active: #253746;
--color-accent: #315f73;
--content-wide: 1440px;
--content-medium: 1120px;
--content-narrow: 840px;
```

统一 `.page-header`、`.page-title`、`.page-subtitle`、`.section-panel`、`.icon-button`、`.segmented-control`、`.row-menu-button`。

- [ ] **Step 4: 重构 Layout JSX**

用内联 SVG 图标数组渲染四个导航项，核心结构为：

```tsx
const navItems = [
  { to: '/', label: '总览', path: 'M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z' },
  { to: '/assets', label: '资产管理', path: 'M4 6h16v12H4V6Zm3-3h10v3H7V3Zm1 7h8m-8 4h5' },
  { to: '/entry', label: '快照录入', path: 'M5 4h14v16H5V4Zm3 4h8m-8 4h8m-8 4h5' },
  { to: '/data', label: '数据管理', path: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Zm-8 3v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6m-16 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6' },
]

<nav className="sidebar" aria-label="主导航">
  <div className="sidebar-brand">
    <span className="sidebar-mark">RF</span>
    <span><strong>Rice Finance</strong><small>资产快照账本</small></span>
  </div>
  <div className="sidebar-nav">
    {navItems.map((item) => (
      <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={item.path} /></svg>
        <span>{item.label}</span>
      </NavLink>
    ))}
  </div>
  <div className="sidebar-account">
    <span>个人账本</span>
    <button type="button" onClick={onLogout} aria-label="退出登录">退出</button>
  </div>
</nav>
```

不新增图标依赖。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx && npm run build`

Expected: PASS，构建无 TypeScript/CSS 错误。

- [ ] **Step 6: 提交**

```bash
git add modules/web-app/src/styles/theme.css modules/web-app/src/index.css modules/web-app/src/components/Layout.tsx modules/web-app/src/components/Layout.css modules/web-app/src/App.test.tsx
git commit -m "feat: refresh pc workbench shell"
```

### Task 5: 重构总览信息层级

**Files:**
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.css`
- Test: `modules/web-app/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 更新语义测试**

保留现有数据断言，并增加 `截至最近快照`、`资产结构`、`最近变化` 和 `快照历史` 区域标题断言；删除按钮的可访问名称必须包含快照时间，而不是 `✕`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: FAIL，当前删除按钮只有符号且缺少新摘要语义。

- [ ] **Step 3: 重排 JSX**

页面顺序固定为：统一页头 → 连续资产摘要带 → 趋势主面板 → 资产结构/最近变化双栏 → 紧凑月收入 → 快照历史。

删除按钮改为：

```tsx
<button
  className="row-menu-button danger"
  aria-label={`删除 ${formatDate(snapshot.recordedAt)} 的快照`}
  onClick={(event) => handleDeleteSnapshot(event, snapshot)}
>
  删除
</button>
```

- [ ] **Step 4: 重写页面 CSS**

摘要带使用共享边框和分隔线；趋势面板为页面主视觉；结构与变化使用 `minmax(0, 1fr)` 双栏；1024px 以下退为单栏。移除空收入大卡片。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx && npm run build`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add modules/web-app/src/pages/DashboardPage.tsx modules/web-app/src/pages/DashboardPage.css modules/web-app/src/pages/DashboardPage.test.tsx
git commit -m "feat: redesign portfolio overview"
```

### Task 6: 精简资产管理工作台

**Files:**
- Modify: `modules/web-app/src/pages/AssetsPage.tsx`
- Modify: `modules/web-app/src/pages/AssetsPage.css`
- Test: `modules/web-app/src/pages/AssetsPage.test.tsx`

- [ ] **Step 1: 增加关键交互测试**

断言 `新增资产` 仍为唯一主操作、资产名称仍能进入详情、编辑和停用按钮具有包含资产名的可访问名称、停用区保持独立。

- [ ] **Step 2: 重排资产单元格**

资产名下显示机构或 `getAssetIdentifier(asset)`；备注改为带 `title` 的单行截断；操作区使用紧凑按钮组，不新增永久删除和搜索功能。

- [ ] **Step 3: 重写 CSS**

金额列宽优先，辅助文本降级，标签降低饱和度，行高控制在 48px 左右。宽度不足时表格容器横向滚动，名称列保持可读。

- [ ] **Step 4: 运行测试与构建**

Run: `npm run test:app -- modules/web-app/src/pages/AssetsPage.test.tsx && npm run build`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add modules/web-app/src/pages/AssetsPage.tsx modules/web-app/src/pages/AssetsPage.css modules/web-app/src/pages/AssetsPage.test.tsx
git commit -m "feat: refine asset management table"
```

### Task 7: 完成快照盘点工作台视觉

**Files:**
- Modify: `modules/web-app/src/pages/EntryPage.tsx`
- Modify: `modules/web-app/src/pages/EntryPage.css`
- Modify: `modules/web-app/src/components/SnapshotForm.tsx`
- Modify: `modules/web-app/src/components/SnapshotForm.css`
- Test: `modules/web-app/src/components/SnapshotForm.test.tsx`

- [ ] **Step 1: 增加录入状态测试**

断言页面显示快照日期、更新时间统计、管理资产入口以及保存按钮；修改值后行状态变为“已修改”；高精度回填无需失焦即可进入确认。

- [ ] **Step 2: 重排工具栏和状态列**

工具栏分为时间信息、备注、统计和操作四组。状态文案统一为 `沿用`、`已修改`、`大额变化`、`未纳入`，并保留正负变化文本。

- [ ] **Step 3: 结构化保存确认**

保持 Feedback API 的 `message: string` 调用签名，快照确认内容使用“摘要、总变动、明细”三段明确文本，并在确认框正文使用 `white-space: pre-line`，避免无结构长段落和跨页面调用迁移。

- [ ] **Step 4: 重写录入 CSS**

工具栏吸顶但不遮挡标题；输入框、币种后缀、行状态和警告局部着色；取消行不依赖低透明度；投资与余额组使用一致分区标题。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:app -- modules/web-app/src/components/SnapshotForm.test.tsx && npm run build`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add modules/web-app/src/pages/EntryPage.tsx modules/web-app/src/pages/EntryPage.css modules/web-app/src/components/SnapshotForm.tsx modules/web-app/src/components/SnapshotForm.css modules/web-app/src/components/SnapshotForm.test.tsx
git commit -m "feat: redesign snapshot entry workbench"
```

### Task 8: 统一详情、登录、数据管理与反馈

**Files:**
- Modify: `modules/web-app/src/pages/AssetDetailPage.tsx`
- Modify: `modules/web-app/src/pages/AssetDetailPage.css`
- Modify: `modules/web-app/src/pages/LoginPage.tsx`
- Modify: `modules/web-app/src/pages/LoginPage.css`
- Modify: `modules/web-app/src/pages/DataManagementPage.tsx`
- Modify: `modules/web-app/src/pages/DataManagementPage.css`
- Modify: `modules/web-app/src/components/Feedback/FeedbackContext.tsx`
- Create: `modules/web-app/src/components/Feedback/FeedbackContext.test.tsx`
- Test: `modules/web-app/src/pages/AssetDetailPage.test.tsx`
- Test: `modules/web-app/src/pages/LoginPage.test.tsx`
- Test: `modules/web-app/src/pages/DataManagementPage.test.tsx`

- [ ] **Step 1: 增加页面语义断言**

详情页断言最近快照时间与编辑入口；登录页断言 `Rice Finance` 品牌和表单错误区；数据页断言导入规范化提示。新增 `FeedbackContext.test.tsx`，在测试组件中调用 `confirm()` 后断言：

```tsx
expect(screen.getByRole('heading', { name: '确认保存快照' })).toBeInTheDocument()
expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
expect(screen.getByText(/快照时间：/)).toHaveClass('confirm-body')
```

- [ ] **Step 2: 重排三个页面**

详情页建立金额主视觉和资料分区；登录页使用相同品牌标识、暖灰画布和精确表单；数据页分成备份导出、导入恢复、风险提示三个层次。

- [ ] **Step 3: 统一反馈视觉**

保留 `toast()` 和 `confirm()` 调用签名，完善图标、标题、正文、按钮层级、焦点与 `white-space` 规则，避免引发业务调用迁移。

- [ ] **Step 4: 运行页面测试与构建**

Run: `npm run test:app && npm run build`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add modules/web-app/src/pages modules/web-app/src/components/Feedback
git commit -m "feat: unify supporting pc pages"
```

### Task 9: 完整验证与视觉检查

**Files:**
- Modify only if verification reveals a scoped defect.

- [ ] **Step 1: 运行完整自动化验证**

Run: `npm run test`

Expected: Web App 与 Worker 测试全部 PASS。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 与 Vite 构建成功；仅允许既有 chunk-size 警告。

- [ ] **Step 3: 浏览器检查核心路径**

在本地 `http://localhost:5173` 检查：登录、总览、资产管理、资产详情、快照录入、数据管理。确认 1024px 与常规桌面宽度无非必要横向溢出，所有金额列对齐，空状态紧凑。

- [ ] **Step 4: 重跑原始收益率复现**

加载包含 `0.3076923076923077` 的导入数据，确认预检提示规范化，导入后快照表单直接显示 `30.76`，点击保存进入确认而不是提示“收益率无效”。

- [ ] **Step 5: 检查工作区并提交验证修正**

Run: `git status --short && git diff --check`

Expected: 仅包含本计划文件；用户原有 `modules/miniprogram-app/project.config.json` 改动始终不进入提交。
