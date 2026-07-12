# 收入文字日期与顶部筛选实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让收入日期可直接键入常见文字格式，并在收入表顶部提供轻量筛选。

**Architecture:** `domain/income.ts` 提供纯日期规范化函数；`IncomeManagementPage` 使用它完成单元格失焦规范化、保存校验和筛选边界解析。筛选状态仅派生 `visibleDrafts`，原始草稿数组保持完整。

**Tech Stack:** React、TypeScript、Vitest、Testing Library。

---

### Task 1: 日期规范化

**Files:**
- Modify: `modules/web-app/src/domain/income.test.ts`
- Modify: `modules/web-app/src/domain/income.ts`

- [ ] 写失败测试覆盖连字符、斜线、纯数字、中文和非法日期。
- [ ] 运行领域测试并确认函数缺失导致失败。
- [ ] 实现 `normalizeIncomeDateInput`，使用 UTC 日历校验并返回 `YYYY-MM-DD` 或 `null`。
- [ ] 重跑领域测试并确认通过。

### Task 2: 文字日期单元格与筛选栏

**Files:**
- Modify: `modules/web-app/src/pages/IncomeManagementPage.test.tsx`
- Modify: `modules/web-app/src/pages/IncomeManagementPage.tsx`
- Modify: `modules/web-app/src/pages/IncomeManagementPage.css`

- [ ] 写失败测试覆盖文字日期失焦规范化和非法日期阻止保存。
- [ ] 写失败测试覆盖日期范围、分类、来源关键词和清除筛选。
- [ ] 运行收入页测试并确认旧日期控件及缺少筛选栏导致失败。
- [ ] 实现文本日期、错误样式、`visibleDrafts` 和顶部筛选栏。
- [ ] 重跑收入页测试并确认通过。

### Task 3: 回归与本地验证

- [ ] 运行 `npm test`。
- [ ] 运行 `npm run build`。
- [ ] 使用本地真实数据验证文字日期、组合筛选、清除筛选和深色主题，不保存测试数据。
- [ ] 运行 `git diff --check` 并检查改动边界。
