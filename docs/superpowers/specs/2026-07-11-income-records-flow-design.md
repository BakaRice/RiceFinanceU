# 收入流入记录设计

日期：2026-07-11

## 背景

RiceFinanceU 的核心仍然是个人资产快照账本。资产快照回答“某个时点我拥有多少资产”，收入记录回答“某段时间我有多少收入流入”。这两个口径必须分开，否则会把存量资产和流量收入混在一起。

此前实现的 `MonthlyIncome` 能在总资产走势上叠加一条月收入线，但模型仍被“每月一条汇总”限制。现在需要从“收入”本身出发，允许工资、奖金、副业、公积金、分红等收入作为独立记录进入同一份账本数据，再由总览页按月、季、年聚合分析。

## 目标

1. 新增通用收入流入记录，支持一段时间内多条收入记录。
2. 收入记录与资产、快照、快照值保持独立，不自动改变资产余额。
3. 总览页继续在总资产走势图中展示收入线，但收入线来自记录聚合，而不是月汇总字段。
4. 收入面板从“月收入”升级为“收入流入”，展示最近收入概况和快捷录入。
5. 同一份导入导出账本 JSON 中保存收入记录。
6. 兼容旧的 `monthlyIncomes` 数据，并迁移为 `incomeRecords`。
7. 收入默认按税后口径记录，区分可支配收入和受限收入。
8. 保持当前 PC 金融工作台的克制、紧凑、数字优先 UI 风格。

## 非目标

1. 不做支出、预算、账单、税务或现金流预测。
2. 不做完整交易流水系统。
3. 不把收入记录自动写入资产快照。
4. 不要求每笔收入绑定资产账户。
5. 不在本轮实现微信小程序端收入录入。
6. 不引入复杂标签体系、多人权限或审批流程。

## 领域模型

新增 `IncomeRecord`：

```ts
export type IncomeCategory =
  | 'salary'
  | 'bonus'
  | 'side_income'
  | 'housing_fund'
  | 'investment'
  | 'other'

export type IncomeRecord = {
  id: string
  occurredAt: string
  amount: number
  category: IncomeCategory
  sourceName?: string
  note?: string
  createdAt: string
  updatedAt: string
}
```

字段口径：

- `occurredAt` 是收入发生日期，使用 `YYYY-MM-DD`。
- `amount` 是非负金额，按税后、CNY 口径记录，保留两位小数。
- `category` 表示收入类型。
- `sourceName` 是可选来源，例如公司、平台、基金分红来源。
- `note` 是可选备注。

收入记录是流量指标。即使类别是 `housing_fund`，它也表示当期公积金流入，不等于 `housing_fund` 资产类型的当前余额。

可用性口径：

- `salary`、`bonus`、`side_income`、`investment`、`other` 默认是可支配收入。
- `housing_fund` 默认是受限收入：它可以纳入总收入流入和资产走势解释，但在 UI 中必须标记为不可支配，不能混入“可花的钱”。
- 当前不新增独立字段保存可用性，先由收入分类推导；如果以后出现更多受限项目，再扩展为显式字段。

## 存储与兼容

完整账本数据新增 `incomeRecords`：

```ts
export type ExportData = {
  meta: { schemaVersion: number; updatedAt: string }
  assets: Asset[]
  snapshots: Snapshot[]
  snapshotValues: SnapshotValue[]
  incomeRecords?: IncomeRecord[]
  monthlyIncomes?: MonthlyIncome[]
  rates?: ExchangeRates
}
```

`monthlyIncomes` 只作为旧备份兼容字段保留。当前数据规范化规则：

1. 新数据默认包含 `incomeRecords: []`。
2. 如果已有 `incomeRecords`，优先使用它。
3. 如果没有 `incomeRecords` 但有旧 `monthlyIncomes`，读取和导入时把每个月汇总拆成多条 `IncomeRecord`。
4. 旧月收入中的 `salary`、`extraIncome`、`housingFund`、`otherIncome` 分别映射为 `salary`、`side_income`、`housing_fund`、`other`。
5. 迁移生成的 `occurredAt` 使用该月第一天，例如 `2026-07-01`。
6. 导出保留 `incomeRecords`。`monthlyIncomes` 可以继续存在于类型中，但新界面和新 API 不再依赖它。

## API

新增 `/api/income-records`：

```text
GET    /api/income-records
POST   /api/income-records
PATCH  /api/income-records/:id
DELETE /api/income-records/:id
```

行为：

- `GET` 按 `occurredAt` 倒序返回。
- `POST` 创建一条收入记录。
- `PATCH` 更新发生日期、金额、类别、来源和备注。
- `DELETE` 删除一条收入记录。

校验：

- `occurredAt` 必须是合法 `YYYY-MM-DD` 日期。
- `amount` 必须是有限、非负数字。
- `category` 必须属于收入分类枚举。
- `sourceName` 和 `note` 去除前后空格，空字符串不保存。

旧的 `/api/monthly-incomes` 可以暂时保留，避免旧客户端或旧测试直接断开；PC Web 新实现只使用 `/api/income-records`。

## 前端体验

总览页的收入区域改名为“收入流入”。它保持紧凑，不成为大面积记账模块：

- 有记录时展示最近一笔收入、最近月份收入合计和分类摘要。
- 最近月份摘要优先展示可支配收入，同时展示受限流入和总流入。
- 无记录时展示小型空状态和“记录收入”操作。
- 主操作文案为“记录收入”。
- 编辑弹窗用于新增、编辑和删除单条收入记录。
- 表单字段为发生日期、类别、金额、来源、备注。

收入分类文案：

- 工资
- 奖金
- 副业/额外收入
- 公积金
- 投资分红
- 其他收入

## 趋势图

收入线继续叠加在“总资产走势”图中，并使用右侧 Y 轴。

聚合规则：

- 日、周尺度不展示收入线。
- 月尺度按收入发生月份汇总。
- 季尺度按季度汇总。
- 年尺度按年份汇总。

收入线展示总收入流入，包含受限收入；Dashboard 的收入摘要负责同步提示其中的受限部分。

图表文案：

- 月尺度显示“月收入”。
- 季尺度显示“季度收入”。
- 年尺度显示“年度收入”。

Tooltip 中收入缺失显示为 `-`，不把缺失记录解释成 `0`。

## 数据管理

导入预检检查 `incomeRecords`：

- 字段不是数组时提示。
- 日期非法时提示。
- 金额非法时提示。
- 类别非法时提示。

旧备份中只有 `monthlyIncomes` 时不报错；导入时由 Worker 迁移到 `incomeRecords`。

导出说明文案从“月收入”改为“收入记录”。

## 测试策略

1. 领域函数测试收入记录总额、可支配/受限收入拆分、月/季/年聚合，以及旧月收入迁移。
2. Worker 测试 `/api/income-records` 创建、更新、删除、排序和校验。
3. Worker 导入导出测试旧 `monthlyIncomes` 到新 `incomeRecords` 的兼容。
4. Dashboard 测试收入线使用新接口和新文案。
5. DataManagementPage 测试新导入预检规则。
