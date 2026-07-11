# Premium Dual Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 RiceFinanceU PC Web 端增加可持久化的浅色、深色、跟随系统三档主题，并把现有紫色主导视觉收敛为中性高级双主题。

**Architecture:** 在独立 `domain/theme.ts` 中实现无 UI 的偏好解析、持久化和根元素应用逻辑；`ThemeSelector` 只负责展示与切换。CSS 继续使用语义变量，由根元素 `data-theme` 覆盖浅色和深色值，业务页面不判断主题且不改变任何 API 调用。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Vitest、Testing Library、原生 CSS、Recharts、`matchMedia`、`localStorage`。

---

## 文件结构与职责

- `modules/web-app/src/domain/theme.ts`：主题偏好类型、存取、解析、根元素应用和系统主题订阅。
- `modules/web-app/src/domain/theme.test.ts`：偏好解析、非法值回退、持久化和系统主题测试。
- `modules/web-app/src/components/ThemeSelector.tsx`：三档主题选择器与系统监听生命周期。
- `modules/web-app/src/components/ThemeSelector.test.tsx`：选择器状态、点击切换和根元素更新测试。
- `modules/web-app/src/main.tsx`：React 首次渲染前初始化主题。
- `modules/web-app/src/components/Layout.tsx`：侧栏底部挂载选择器。
- `modules/web-app/src/pages/LoginPage.tsx`：未登录页面挂载选择器。
- `modules/web-app/src/styles/theme.css`：浅色、深色语义变量和选择器视觉。
- `modules/web-app/src/components/Layout.css`、页面 CSS：清除紫色主导和不可切换的硬编码背景。
- `modules/web-app/src/pages/DashboardPage.tsx`、`IncomeManagementPage.tsx`：Recharts 改用主题图表变量。

### Task 1: 建立主题领域规则

**Files:**
- Create: `modules/web-app/src/domain/theme.ts`
- Create: `modules/web-app/src/domain/theme.test.ts`

- [ ] **Step 1: 写失败测试**

测试以下契约：

```ts
expect(parseThemePreference('dark')).toBe('dark')
expect(parseThemePreference('light')).toBe('light')
expect(parseThemePreference('system')).toBe('system')
expect(parseThemePreference('purple')).toBe('system')
expect(resolveTheme('system', true)).toBe('dark')
expect(resolveTheme('system', false)).toBe('light')
expect(resolveTheme('dark', false)).toBe('dark')
```

使用 stub 的 `localStorage` 和根元素断言：

```ts
applyThemePreference('dark', { storage, root, systemDark: false })
expect(storage.setItem).toHaveBeenCalledWith('ricefinanceu-theme', 'dark')
expect(root.dataset.theme).toBe('dark')
expect(root.dataset.themePreference).toBe('dark')
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/domain/theme.test.ts`

Expected: FAIL，提示 `theme.ts` 或导出不存在。

- [ ] **Step 3: 实现最小领域模块**

提供：

```ts
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'ricefinanceu-theme'
export function parseThemePreference(value: unknown): ThemePreference
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme
export function readThemePreference(storage?: Storage): ThemePreference
export function applyThemePreference(preference: ThemePreference, options?: ThemeEnvironment): ResolvedTheme
export function initializeTheme(): ThemePreference
export function subscribeToSystemTheme(callback: () => void): () => void
```

所有浏览器对象在函数调用时读取，不能在模块导入时假设 `window` 存在。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:app -- modules/web-app/src/domain/theme.test.ts`

Expected: PASS。

### Task 2: 实现三档主题选择器

**Files:**
- Create: `modules/web-app/src/components/ThemeSelector.tsx`
- Create: `modules/web-app/src/components/ThemeSelector.test.tsx`

- [ ] **Step 1: 写失败测试**

渲染组件后断言：

```ts
expect(screen.getByRole('group', { name: '界面主题' })).toBeTruthy()
expect(screen.getByRole('button', { name: '跟随系统' }).getAttribute('aria-pressed')).toBe('true')
fireEvent.click(screen.getByRole('button', { name: '深色' }))
expect(document.documentElement.dataset.theme).toBe('dark')
expect(document.documentElement.dataset.themePreference).toBe('dark')
expect(localStorage.setItem).toHaveBeenCalledWith('ricefinanceu-theme', 'dark')
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/components/ThemeSelector.test.tsx`

Expected: FAIL，提示组件不存在。

- [ ] **Step 3: 实现最小组件**

组件包含三个按钮：

```tsx
<div className={`theme-selector theme-selector-${variant}`} role="group" aria-label="界面主题">
  <button aria-label="跟随系统" aria-pressed={preference === 'system'}>自动</button>
  <button aria-label="浅色" aria-pressed={preference === 'light'}>浅色</button>
  <button aria-label="深色" aria-pressed={preference === 'dark'}>深色</button>
</div>
```

`variant` 支持 `sidebar` 和 `floating`。选择 `system` 时订阅系统变化，手动偏好时不受系统事件覆盖。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:app -- modules/web-app/src/components/ThemeSelector.test.tsx`

Expected: PASS。

### Task 3: 接入首次初始化与两个入口

**Files:**
- Modify: `modules/web-app/src/main.tsx`
- Modify: `modules/web-app/src/components/Layout.tsx`
- Modify: `modules/web-app/src/pages/LoginPage.tsx`
- Modify: `modules/web-app/src/App.test.tsx`
- Modify: `modules/web-app/src/pages/LoginPage.test.tsx`

- [ ] **Step 1: 写失败测试**

在应用壳测试断言登录后侧栏包含 `界面主题` group；在登录页测试断言未登录页面也包含该 group。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx modules/web-app/src/pages/LoginPage.test.tsx`

Expected: FAIL，两个页面都没有选择器。

- [ ] **Step 3: 接入组件和首次初始化**

在 `main.tsx` 的 `createRoot()` 前调用：

```ts
initializeTheme()
```

在 `Layout` 的账户区上方渲染 `<ThemeSelector variant="sidebar" />`；在登录页根节点内渲染 `<ThemeSelector variant="floating" />`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:app -- modules/web-app/src/App.test.tsx modules/web-app/src/pages/LoginPage.test.tsx`

Expected: PASS。

### Task 4: 建立高级中性双主题变量

**Files:**
- Modify: `modules/web-app/src/styles/theme.css`
- Modify: `modules/web-app/src/components/Layout.css`
- Modify: `modules/web-app/src/pages/LoginPage.css`

- [ ] **Step 1: 增加浅色与深色语义变量**

浅色使用珍珠白、石墨黑和钴蓝：

```css
:root,
:root[data-theme='light'] {
  color-scheme: light;
  --color-bg: #f4f5f7;
  --color-canvas: #f6f7f9;
  --color-surface: #ffffff;
  --color-surface-hover: #f3f5f8;
  --color-surface-muted: #eef1f5;
  --color-text: #17191d;
  --color-text-secondary: #5b616b;
  --color-text-muted: #8a919d;
  --color-border: #dfe3e8;
  --color-border-light: #edf0f3;
  --color-primary: #1769e0;
  --color-primary-hover: #0d58c4;
  --color-primary-light: #eaf2ff;
  --color-sidebar: #0b0d11;
  --color-sidebar-active: rgba(255,255,255,.08);
}
```

深色覆盖相同变量：

```css
:root[data-theme='dark'] {
  color-scheme: dark;
  --color-bg: #050608;
  --color-canvas: #08090c;
  --color-surface: #101216;
  --color-surface-hover: #171a20;
  --color-surface-muted: #151821;
  --color-text: #f5f7fb;
  --color-text-secondary: #a9afbd;
  --color-text-muted: #737b8b;
  --color-border: #292d36;
  --color-border-light: #20242c;
  --color-primary: #5aa7ff;
  --color-primary-hover: #7bb8ff;
  --color-primary-light: rgba(90,167,255,.12);
  --color-sidebar: #050608;
  --color-sidebar-active: rgba(255,255,255,.08);
}
```

同时定义图表、限制状态、渐变表面和侧栏文字语义变量。

- [ ] **Step 2: 添加选择器样式**

侧栏变体是紧凑三段控件；浮动变体固定在登录页右上角。当前项使用中性表面和清澈蓝色，不使用紫色背景。

- [ ] **Step 3: 清理导航与登录页硬编码色**

将侧栏文字、选中线、品牌标记、登录背景和焦点环改用语义变量；品牌渐变限制为蓝、青和少量暖色光谱，不以紫色为中心。

- [ ] **Step 4: 运行组件测试与构建**

Run: `npm run test:app -- modules/web-app/src/components/ThemeSelector.test.tsx modules/web-app/src/App.test.tsx modules/web-app/src/pages/LoginPage.test.tsx && npm run build`

Expected: PASS。

### Task 5: 让页面和图表消费主题变量

**Files:**
- Modify: `modules/web-app/src/pages/DashboardPage.css`
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`
- Modify: `modules/web-app/src/pages/IncomeManagementPage.css`
- Modify: `modules/web-app/src/pages/IncomeManagementPage.tsx`
- Modify: `modules/web-app/src/pages/DcaManagementPage.css`
- Modify: `modules/web-app/src/pages/AssetDetailPage.css`
- Modify: `modules/web-app/src/pages/DataManagementPage.css`
- Modify: `modules/web-app/src/components/SnapshotForm.css`

- [ ] **Step 1: 替换固定浅色表面**

摘要带、收入项、历史展开、定投摘要、资产详情摘要、数据警告和吸顶工具栏全部改用 `--color-*`、`--surface-gradient-*` 和状态语义变量。

- [ ] **Step 2: 替换图表固定颜色**

Recharts 使用：

```tsx
stroke="var(--chart-total)"
stroke="var(--chart-investment)"
stroke="var(--chart-balance)"
stroke="var(--chart-income)"
```

资产结构条使用 `--chart-category-1` 到 `--chart-category-6`。

- [ ] **Step 3: 深色专用可读性校准**

为类型标签、输入、表格 hover、弹窗遮罩和 Toast 增加深色覆盖，保持文字、边框和焦点可见；不改变组件 DOM 或交互。

- [ ] **Step 4: 运行全部前端测试与构建**

Run: `npm run test:app && npm run build`

Expected: PASS。

### Task 6: 双主题浏览器验证

**Files:**
- No source files unless visual inspection reveals a concrete defect.

- [ ] **Step 1: 在当前 `5174` 预览验证浅色**

选择浅色，检查总览、资产、收入、定投、快照录入和数据管理。确认无紫色主导、表格和图表可读、控制台无错误。

- [ ] **Step 2: 验证深色**

选择深色并检查相同页面。确认画布为中性黑、面板层级清晰、金额和输入可读、图表色不产生霓虹泛滥。

- [ ] **Step 3: 验证跟随系统**

选择自动，模拟系统深浅变化，确认根元素 `data-theme` 更新且偏好保持 `system`。

- [ ] **Step 4: 最终验证**

Run: `npm run test && npm run mini:test && npm run build && git diff --check`

Expected: Web、Worker、小程序测试全部通过，生产构建成功，CSS 无语法错误。
