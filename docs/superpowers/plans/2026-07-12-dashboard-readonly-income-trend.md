# 大盘只读收入趋势实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将大盘改为紧凑的总资产/收入双趋势，并移除全部收入写入动作。

**Architecture:** `domain/income.ts` 负责把收入事件聚合成各尺度序列；`DashboardPage` 分别派生资产图和收入图数据。大盘只读取收入记录并链接到 `/income`，收入 CRUD 继续由收入 Sheet 独占。

**Tech Stack:** React、TypeScript、Recharts、Vitest、Testing Library。

---

### Task 1: 扩展收入趋势尺度

**Files:**
- Modify: `modules/web-app/src/domain/income.test.ts`
- Modify: `modules/web-app/src/domain/income.ts`

- [ ] **Step 1: 写失败测试，断言日尺度按日期汇总、周尺度按周一分桶。**
- [ ] **Step 2: 运行 `npm run test:app -- modules/web-app/src/domain/income.test.ts`，确认日周结果为空而失败。**
- [ ] **Step 3: 在 `buildIncomeSeriesByScale` 中实现日、周聚合，并让 `getIncomeLineLabel` 返回日收入和周收入。**
- [ ] **Step 4: 重跑领域测试并确认通过。**

### Task 2: 锁定只读双趋势大盘

**Files:**
- Modify: `modules/web-app/src/pages/DashboardPage.test.tsx`

- [ ] **Step 1: 写失败测试，断言双图位于同一趋势行、资产图无收入线、收入图有独立尺度。**
- [ ] **Step 2: 写失败测试，断言大盘只有“查看收入明细”链接，不存在记录、编辑、删除或保存收入动作。**
- [ ] **Step 3: 运行 `npm run test:app -- modules/web-app/src/pages/DashboardPage.test.tsx` 并确认失败原因来自旧混合图和旧弹窗。**

### Task 3: 实现紧凑只读大盘

**Files:**
- Modify: `modules/web-app/src/pages/DashboardPage.tsx`
- Modify: `modules/web-app/src/pages/DashboardPage.css`

- [ ] **Step 1: 分离 `assetChartData` 与 `incomeChartData`，收入尺度使用独立状态且默认月。**
- [ ] **Step 2: 用两列 `dashboard-trend-row` 展示等高图表，1100px 以下堆叠。**
- [ ] **Step 3: 删除收入表单状态、CRUD handler、弹窗和相关样式，只保留 `/income` 链接。**
- [ ] **Step 4: 运行大盘测试直至通过。**

### Task 4: 回归与本地验证

**Files:**
- Verify: `modules/web-app/src/domain/income.ts`
- Verify: `modules/web-app/src/pages/DashboardPage.tsx`
- Verify: `modules/web-app/src/pages/DashboardPage.css`

- [ ] **Step 1: 运行 `npm test`。**
- [ ] **Step 2: 运行 `npm run build`。**
- [ ] **Step 3: 使用本地真实数据检查 1280px 双列、窄屏堆叠、深色主题和无收入写入按钮。**
- [ ] **Step 4: 运行 `git diff --check` 并检查改动边界。**
