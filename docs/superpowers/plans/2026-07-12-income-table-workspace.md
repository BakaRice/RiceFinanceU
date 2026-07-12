# 收入表格工作区实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将收入页从“分析看板加弹窗 CRUD”收敛为与资产、录入一致的工作簿式收入事件表。

**Architecture:** `IncomeManagementPage` 继续作为收入 API 的页面适配器，维护已保存记录、行草稿和待删除集合；`TableWorkspace` 只提供统一工具栏与未保存状态。保存时页面按新增、修改、删除三类变化调用现有收入 API，收入分析继续由大盘负责。

**Tech Stack:** React、TypeScript、Vitest、Testing Library、现有 Cloudflare Worker API。

---

### Task 1: 用页面测试定义收入 Sheet 行为

**Files:**
- Modify: `modules/web-app/src/pages/IncomeManagementPage.test.tsx`

- [ ] **Step 1: 写一个失败测试，断言收入页使用 TableWorkspace，分析卡片不再出现，现有行可直接编辑。**

```tsx
expect(await screen.findByRole('heading', { name: '收入' })).toBeTruthy()
expect(screen.queryByText('月度收入趋势')).toBeNull()
fireEvent.change(screen.getByLabelText('2026-07-05 金额'), { target: { value: '12500' } })
expect(screen.getByText('1 项未保存')).toBeTruthy()
```

- [ ] **Step 2: 运行测试并确认因为现有页面仍是看板和只读历史表而失败。**

Run: `npm run test:app -- modules/web-app/src/pages/IncomeManagementPage.test.tsx`

Expected: FAIL，缺少标题“收入”或行内金额输入。

- [ ] **Step 3: 再写失败测试，覆盖新增行、待删除、放弃修改和统一保存。**

```tsx
fireEvent.click(screen.getByRole('button', { name: '新增行' }))
fireEvent.change(screen.getByLabelText('新增收入 1 金额'), { target: { value: '500' } })
fireEvent.click(screen.getByRole('button', { name: '标记删除 2026-07-05 工资' }))
fireEvent.click(screen.getByRole('button', { name: '保存收入' }))
await waitFor(() => expect(mockedApi.createIncomeRecord).toHaveBeenCalledTimes(1))
expect(mockedApi.deleteIncomeRecord).toHaveBeenCalledWith('salary-1')
```

- [ ] **Step 4: 运行测试并确认因统一草稿保存尚未实现而失败。**

Run: `npm run test:app -- modules/web-app/src/pages/IncomeManagementPage.test.tsx`

Expected: FAIL，缺少“新增行”或“保存收入”。

### Task 2: 实现收入表格草稿和统一保存

**Files:**
- Modify: `modules/web-app/src/pages/IncomeManagementPage.tsx`
- Modify: `modules/web-app/src/pages/IncomeManagementPage.css`

- [ ] **Step 1: 增加 `IncomeDraft`，将 API 记录映射成可编辑字符串字段，并以字段比较计算 dirty 行。**
- [ ] **Step 2: 用 `TableWorkspace` 包裹单一收入表，列固定为日期、分类、金额、来源、备注、状态和操作。**
- [ ] **Step 3: “新增行”直接在表尾加入草稿；删除只标记为待删除；“放弃修改”恢复最近一次加载结果。**
- [ ] **Step 4: “保存收入”先整表校验，再依次调用新增、更新、删除 API；成功后重新加载。**
- [ ] **Step 5: 运行收入页测试直至通过。**

Run: `npm run test:app -- modules/web-app/src/pages/IncomeManagementPage.test.tsx`

Expected: PASS。

### Task 3: 回归验证

**Files:**
- Verify: `modules/web-app/src/pages/IncomeManagementPage.tsx`
- Verify: `modules/web-app/src/pages/IncomeManagementPage.css`
- Verify: `modules/web-app/src/pages/IncomeManagementPage.test.tsx`

- [ ] **Step 1: 运行 Web 应用测试。**

Run: `npm run test:app`

Expected: PASS，0 个失败。

- [ ] **Step 2: 运行生产构建。**

Run: `npm run build`

Expected: exit code 0。

- [ ] **Step 3: 检查差异，确认没有覆盖收入页之外的用户未提交改动。**

Run: `git diff --check && git diff --stat`

Expected: 无 whitespace error，改动范围与本任务一致。
