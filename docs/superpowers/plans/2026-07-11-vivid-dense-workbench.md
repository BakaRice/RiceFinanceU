# Vivid Dense Financial Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 PC Web 端升级为鲜明、高密度的个人资产管理工作台，并按已确认关系重排总览页，全程保持后端接口与领域模型不变。

**Architecture:** 以 `theme.css` 和 `Layout.css` 建立全局颜色、密度和画布规则，继续复用现有页面的 `page-header`、`dash-section` 与金融表格语义。总览页只重排现有 React 区块，不新增数据请求；结构性测试锁定两组双栏关系，现有行为测试负责防止收入、趋势和快照操作回归。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest、Testing Library、原生 CSS、Recharts。

---

## 文件结构与职责

- `modules/web-app/src/styles/theme.css`：高饱和品牌色、状态色、分类色、密度和内容宽度变量。
- `modules/web-app/src/index.css`：全局焦点、正文背景和共享页面工作栏规则。
- `modules/web-app/src/components/Layout.tsx`：保持路由与导航行为，补充工作台壳的语义标记。
- `modules/web-app/src/components/Layout.css`：收窄导航、彩色品牌标记、流式内容画布和窄屏退化。
- `modules/web-app/src/App.test.tsx`：验证导航壳仍包含全部业务入口和新的工作台语义。
- `modules/web-app/src/pages/DashboardPage.tsx`：重排现有摘要、趋势、收入、资产结构、历史快照和最近变化区块。
- `modules/web-app/src/pages/DashboardPage.css`：两组双栏、鲜明图表/分类色、紧凑面板和响应式布局。
- `modules/web-app/src/pages/DashboardPage.test.tsx`：锁定两组双栏语义和原有交互行为。
- `modules/web-app/src/pages/*.css`、`modules/web-app/src/components/SnapshotForm.css`：仅在共享变量不能覆盖时修正局部高间距或旧色值。

### Task 1: 锁定工作台壳语义

**Files:**
- Modify: `modules/web-app/src/App.test.tsx`
- Modify: `modules/web-app/src/components/Layout.tsx`

- [ ] **Step 1: 写失败测试**

在 `authenticated application shell` 测试中增加：

```ts
const shell = screen.getByTestId('financial-workbench')
expect(shell.getAttribute('data-density')).toBe('dense')
expect(screen.getByRole('main').classList.contains('content')).toBe(true)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx`

Expected: FAIL，提示找不到 `financial-workbench`。

- [ ] **Step 3: 添加最小语义标记**

把 `Layout.tsx` 根节点改为：

```tsx
<div className="layout" data-testid="financial-workbench" data-density="dense">
```

不改变导航项、路由、退出按钮或 `Outlet`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx`

Expected: PASS。

### Task 2: 建立鲜明高密度主题与全局壳

**Files:**
- Modify: `modules/web-app/src/styles/theme.css`
- Modify: `modules/web-app/src/index.css`
- Modify: `modules/web-app/src/components/Layout.css`

- [ ] **Step 1: 替换主题颜色与密度变量**

将根变量调整为同一语义下的新值：

```css
:root {
  --color-bg: #f5f6ff;
  --color-canvas: #f5f6ff;
  --color-surface: #ffffff;
  --color-surface-hover: #f7f8ff;
  --color-surface-muted: #f0f2ff;
  --color-sidebar: #11162a;
  --color-sidebar-active: rgba(92, 92, 255, 0.18);
  --color-primary: #4f46f5;
  --color-primary-hover: #3f37d7;
  --color-primary-light: #eeedff;
  --color-accent: #6d5dfc;
  --color-violet: #8b5cf6;
  --color-cyan: #06b6d4;
  --color-orange: #f59e0b;
  --color-pink: #ec4899;
  --color-profit: #059669;
  --color-profit-bg: #eafaf4;
  --color-loss: #ef476f;
  --color-loss-bg: #fff0f4;
  --color-warning: #d97706;
  --color-warning-bg: #fff8e8;
  --color-text: #171b2e;
  --color-text-secondary: #555c72;
  --color-text-muted: #838aa1;
  --color-border: #dfe2f1;
  --color-border-light: #eceefa;
  --color-border-focus: #5b55f7;
  --table-row-height: 40px;
  --table-header-height: 32px;
  --input-height: 32px;
  --btn-height: 32px;
  --content-wide: 1600px;
}
```

保留变量名，避免逐页改写消费方。

- [ ] **Step 2: 统一全局焦点和页面工作栏**

在 `index.css` 使用主色焦点环，并给现有共享类添加紧凑规则：

```css
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid rgba(79, 70, 245, 0.48);
  outline-offset: 2px;
}

.page-header {
  min-height: 56px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border-light);
}

.page-title { font-size: 20px; }
.page-subtitle { margin-top: 3px; font-size: 12px; }
```

如果页面 CSS 已定义相同选择器，以更具体的局部规则合并，不能使用 `!important`。

- [ ] **Step 3: 收窄导航并放宽画布**

在 `Layout.css` 设置：

```css
.sidebar { width: 180px; padding: 12px 10px 10px; }
.sidebar-brand { min-height: 46px; padding: 4px 7px 12px; }
.sidebar-mark {
  background: linear-gradient(135deg, #4f46f5 0%, #8b5cf6 55%, #06b6d4 100%);
  border-color: rgba(255,255,255,.22);
  box-shadow: 0 0 22px rgba(109, 93, 252, .24);
}
.sidebar-nav { gap: 2px; padding-top: 14px; }
.nav-item { min-height: 38px; }
.nav-item.active { color: #fff; background: rgba(92, 92, 255, .18); }
.nav-item.active::before { background: linear-gradient(#8b5cf6, #38bdf8); }
.content-canvas {
  width: min(100%, calc(var(--content-wide) + 48px));
  padding: 20px 24px 32px;
}
```

保留 800px 以下现有图标轨道行为。

- [ ] **Step 4: 运行壳测试与构建**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx && npm run build`

Expected: PASS，TypeScript 与 Vite 构建成功。

### Task 3: 用测试锁定总览双栏关系

**Files:**
- Modify: `modules/web-app/src/pages/DashboardPage.test.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`

- [ ] **Step 1: 写失败测试**

在总览测试中增加：

```ts
it('groups related dashboard panels into two semantic rows', async () => {
  renderDashboard()
  await screen.findByText('总资产走势')

  const flowRow = screen.getByTestId('flow-structure-row')
  expect(flowRow.textContent).toContain('收入流入')
  expect(flowRow.textContent).toContain('资产结构')

  const activityRow = screen.getByTestId('snapshot-change-row')
  expect(activityRow.textContent).toContain('快照历史')
  expect(activityRow.textContent).toContain('最近变化')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: FAIL，提示找不到两个测试标记。

- [ ] **Step 3: 重排现有区块**

保持所有状态、事件处理器和 API 调用不变，把现有 JSX 排列为：

```tsx
<header className="page-header dashboard-header">...</header>
<div className="dash-stat-bar">...</div>
{chartData.length > 0 && <div className="dash-section dashboard-trend">...</div>}
<div className="dashboard-paired-row dashboard-flow-row" data-testid="flow-structure-row">
  <section className="dash-section dashboard-income">...</section>
  <section className="dash-section dashboard-allocation">...</section>
</div>
<div className="dashboard-paired-row dashboard-activity-row" data-testid="snapshot-change-row">
  <section className="dash-section dashboard-history">...</section>
  <section className="dash-section dashboard-changes">...</section>
</div>
```

把汇率查看与编辑控件移入 `dashboard-header` 右侧工具区；仍调用原有 `api.updateRates()`。

- [ ] **Step 4: 运行总览测试确认通过**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx`

Expected: PASS，包括趋势尺度、收入录入、历史删除语义与新双栏测试。

### Task 4: 完成总览鲜明双栏样式

**Files:**
- Modify: `modules/web-app/src/pages/DashboardPage.css`
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`

- [ ] **Step 1: 移除依赖 flex order 的旧排序**

删除 `.dashboard-* { order: ... }` 与旧 `.dash-grid` 布局依赖，让 DOM 顺序就是阅读顺序和键盘顺序。

- [ ] **Step 2: 建立两组双栏**

增加：

```css
.dashboard-paired-row {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 14px;
}
.dashboard-activity-row {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.12fr);
}
.dashboard-paired-row > .dash-section { min-width: 0; }
@media (max-width: 1100px) {
  .dashboard-paired-row { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: 提高摘要与面板密度**

将摘要带、面板和趋势区调整为：

```css
.dashboard { gap: 14px; }
.dash-stat-bar {
  position: relative;
  overflow: hidden;
  border-color: rgba(79, 70, 245, .22);
  background: linear-gradient(105deg, #ffffff 0%, #f5f3ff 52%, #eef8ff 100%);
}
.dash-stat-bar::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: linear-gradient(#4f46f5, #8b5cf6, #06b6d4);
  content: '';
}
.dash-section { padding: 14px 16px; }
.dashboard-trend { min-height: 340px; padding: 16px 18px 8px; }
```

- [ ] **Step 4: 更新图表和资产结构色谱**

在 `DashboardPage.tsx` 使用：

```tsx
<Line dataKey="totalAmount" stroke="#4f46f5" ... />
<Line dataKey="investmentAmount" stroke="#06b6d4" ... />
<Line dataKey="balanceAmount" stroke="#f59e0b" ... />
<Line dataKey="incomeAmount" stroke="#8b5cf6" ... />
```

资产结构条依次使用 `#4f46f5`、`#8b5cf6`、`#06b6d4`、`#f59e0b`、`#ec4899`、`#10b981`，保持文字与金额为中性色。

- [ ] **Step 5: 运行总览测试与构建**

Run: `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx && npm run build`

Expected: PASS。

### Task 5: 收敛其他 PC 页面的共享密度

**Files:**
- Modify only when required: `modules/web-app/src/pages/AssetsPage.css`
- Modify only when required: `modules/web-app/src/pages/IncomeManagementPage.css`
- Modify only when required: `modules/web-app/src/pages/DcaManagementPage.css`
- Modify only when required: `modules/web-app/src/pages/EntryPage.css`
- Modify only when required: `modules/web-app/src/pages/AssetDetailPage.css`
- Modify only when required: `modules/web-app/src/pages/DataManagementPage.css`
- Modify only when required: `modules/web-app/src/pages/LoginPage.css`
- Modify only when required: `modules/web-app/src/components/SnapshotForm.css`

- [ ] **Step 1: 搜索绕过主题变量的旧色值和高间距**

Run:

```bash
rg -n "#[0-9a-fA-F]{6}|padding: (2[4-9]|[3-9][0-9])px|margin-bottom: (2[0-9]|[3-9][0-9])px" modules/web-app/src/pages modules/web-app/src/components
```

Expected: 输出需要人工判断的局部硬编码；不机械替换状态色或图表语义色。

- [ ] **Step 2: 只修正破坏全局一致性的局部规则**

使用现有主题变量替换旧灰蓝主色；将普通面板内边距收敛到 14–16px、页面区块间距收敛到 12–16px。保留登录页与数据管理页的窄宽度，保留快照录入的吸顶与编辑状态。

- [ ] **Step 3: 运行全部前端测试**

Run: `npm run test:app`

Expected: PASS，不出现 API mock 调用变化或页面行为回归。

### Task 6: 本地视觉检查与最终验证

**Files:**
- No source files unless visual inspection finds a concrete defect.

- [ ] **Step 1: 启动本地完整环境**

Run: `npm run dev:all`

Expected: Vite 在 `http://localhost:5173`，本地 Worker 在 `http://localhost:8787`。

- [ ] **Step 2: 检查主要 PC 页面**

在 1440px 左右视口依次检查：

```text
/
/assets
/income
/dca
/entry
/data
```

确认导航宽度、工作栏、内容画布、控件高度、表格密度、鲜明色彩和焦点状态一致。总览确认趋势位于摘要之后，收入与资产结构同行，历史快照与最近变化同行。

- [ ] **Step 3: 检查较窄 PC 视口**

在约 1024px 视口确认双栏退化为单栏、侧栏不遮挡内容、表格可滚动、主要操作仍可见。

- [ ] **Step 4: 运行最终验证**

Run: `npm run test && npm run build`

Expected: 所有前端、Worker 与小程序测试通过，生产构建成功。

- [ ] **Step 5: 检查改动边界**

Run: `git diff -- modules/web-app docs/superpowers/specs/2026-07-11-vivid-dense-workbench-design.md docs/superpowers/plans/2026-07-11-vivid-dense-workbench.md`

Expected: 没有 `modules/worker-api/`、API client、类型或领域模型改动；工作区原有无关修改未进入本次提交。
