# 月收入走线设计

## 背景

RiceFinanceU 当前核心是个人资产快照账本。资产快照回答的是“某个时间点我有多少资产”，但用户还需要看到“每个月收入流入多少”，才能更全面地解释资产走势。

如果把收入直接塞进资产快照，会混淆两个口径：

- 资产快照是存量。
- 月收入是流量。

因此，本设计新增独立的月度收入记录，并在总览页把月收入线叠加到资产走势分析中。它服务于分析，不把产品推成日常记账或交易流水系统。

## 目标

1. 支持按月录入收入汇总。
2. 月收入包含工资、额外收入、公积金和其他收入四个分类。
3. 总收入由分类金额相加得到，不单独手填。
4. 总览页可以在资产走势分析中看到月收入走势。
5. 月收入数据进入导入导出备份。
6. 旧备份没有月收入字段时自动兼容为空数组。
7. 保持当前自用优先、低维护、快速录入的产品方向。

## 非目标

1. 不做逐笔收入流水。
2. 不做支出、预算、账单或税务计算。
3. 不让月收入自动改变任何资产快照金额。
4. 不把公积金收入和公积金资产余额合并成同一个字段。
5. 不新增复杂的多人、审批或账户权限模型。
6. 不在本次实现微信小程序端收入录入。

## 产品口径

### 月收入记录

每个月最多一条月收入汇总记录。月份使用 `YYYY-MM`，例如 `2026-07`。

建议领域对象：

```ts
export type MonthlyIncome = {
  id: string
  month: string
  salary: number
  extraIncome: number
  housingFund: number
  otherIncome: number
  note?: string
  createdAt: string
  updatedAt: string
}
```

总收入不落库为独立字段，而是在前端或领域函数中计算：

```ts
totalIncome = salary + extraIncome + housingFund + otherIncome
```

这样可以避免分类金额和总额不一致。

### 公积金口径

`housingFund` 在月收入中表示本月公积金缴存或流入金额，属于收入流量。

已有的 `housing_fund` 资产类型仍表示公积金账户在某个快照时点的余额，属于资产存量。

两者不自动联动。用户可以通过资产线和收入线对比看到：

- 本月公积金收入增加了多少。
- 公积金资产余额当前是多少。

## 用户体验

总览页增加一个紧凑的“月收入”区域，优先放在“总资产走势”附近。这个区域不是独立的记账入口，而是为走势图提供收入维度的录入和阅读入口。

推荐布局：

- 顶部显示最近一个月总收入。
- 显示工资、额外收入、公积金、其他收入四个小指标。
- 提供一个简洁的新增或编辑入口。
- 当月已有记录时，入口表现为“编辑本月收入”。
- 当月没有记录时，入口表现为“记录本月收入”。

录入表单字段：

- 月份。
- 工资。
- 额外收入。
- 公积金。
- 其他收入。
- 备注。

默认月份为当前月份。金额字段默认 `0`，允许用户只填有值的分类。

### 走势图

收入走势必须进入总览页的走势分析视图。推荐主方案是在现有“总资产走势”图上叠加收入线，而不是默认新开一个远离资产图的模块。

同图叠加的好处是用户可以直接对比：

- 资产净值在某个周期是否增长。
- 同周期收入流入大概是多少。
- 资产变化是否明显偏离收入流入。

月收入是月度数据，所以默认只在适合月度分析的尺度上展示收入线：

- 月、季、年尺度：展示月收入线。
- 日、周尺度：不展示月收入线，避免把月度数据误读成每日或每周收入。

当趋势尺度为月时，图表每个月的收入线使用该月 `totalIncome`。

当趋势尺度为季或年时，收入线按周期汇总：

- 季尺度：该季度内各月收入之和。
- 年尺度：该年内各月收入之和。

Tooltip 中明确区分：

```text
周期：2026-07
总资产：123,456.78
投资类：80,000.00
余额类：43,456.78
月收入：18,000.00
```

如果某个资产周期没有收入记录，收入值显示为 `-`，不按 `0` 展示，避免误解为确实没有收入。

如果同图叠加在实现或实际数据中出现可读性问题，可以把收入拆成同一个走势图区块内的第二张小型线图：

- 上图：总资产、投资类、余额类。
- 下图：月收入或周期收入。

这个拆分是可读性兜底，不是默认方案。默认仍优先让收入线出现在总资产走势图中。

## 数据流

当前 Worker 存储是一份完整账本 JSON。本设计在同一份数据中新增 `monthlyIncomes`：

```ts
export type ExportData = {
  meta: { schemaVersion: number; updatedAt: string }
  assets: Asset[]
  snapshots: Snapshot[]
  snapshotValues: SnapshotValue[]
  rates?: ExchangeRates
  monthlyIncomes?: MonthlyIncome[]
}
```

Worker 的 `normalizeData` 需要保证：

- 数据为空时创建 `monthlyIncomes: []`。
- 旧备份没有 `monthlyIncomes` 时补 `[]`。
- 导入导出都保留 `monthlyIncomes`。

暂不提高 `schemaVersion`。当前导入逻辑已经以结构兼容为主，新增可选字段可以在 v2 内兼容。

## API 设计

新增 `/api/monthly-incomes`。

建议接口：

```text
GET    /api/monthly-incomes
POST   /api/monthly-incomes
PATCH  /api/monthly-incomes/:id
DELETE /api/monthly-incomes/:id
```

`GET` 返回按月份倒序排列的记录。

`POST` 创建记录。若同一个 `month` 已存在，返回 `400`，提示该月份已存在收入记录。

`PATCH` 支持更新月份、分类金额和备注。若更新后的 `month` 和其他记录冲突，返回 `400`。

`DELETE` 删除记录。

输入校验：

- `month` 必须匹配 `YYYY-MM`，且月份为 `01` 到 `12`。
- 分类金额必须是有限数字，且大于等于 `0`。
- 未传的分类金额在创建时默认为 `0`。
- `note` 去除前后空格，空字符串不保存。

## 前端结构

### 类型

在 `modules/web-app/src/types/finance.ts` 增加 `MonthlyIncome`，并扩展 `ExportData`。

### 领域函数

建议新增 `modules/web-app/src/domain/income.ts`：

```ts
export function calculateMonthlyIncomeTotal(income: MonthlyIncome): number
export function buildIncomeSeriesByScale(
  incomes: MonthlyIncome[],
  scale: TrendScale
): Map<string, number>
```

职责：

- 计算单条月收入总额。
- 按月、季、年聚合收入。
- 日、周尺度返回空结果。
- 保持金额两位小数规则。

### API Client

在 `modules/web-app/src/api/client.ts` 增加：

```ts
getMonthlyIncomes()
createMonthlyIncome(data)
updateMonthlyIncome(id, data)
deleteMonthlyIncome(id)
```

### 总览页

`DashboardPage` 加载时并行获取 `monthlyIncomes`。

`chartData` 仍由快照数据派生，但在月、季、年尺度下合并收入序列：

```ts
{
  periodKey: '2026-07',
  periodLabel: '2026-07',
  totalAmount: 123456.78,
  investmentAmount: 80000,
  balanceAmount: 43456.78,
  totalProfit: 1000,
  incomeAmount: 18000
}
```

Recharts 增加一条 `incomeAmount` 折线。收入线默认和总资产线出现在同一个 LineChart 中，使用不同颜色，并在 Tooltip 中标明“月收入”或“周期收入”。

收入金额和总资产金额通常不在同一量级。为了避免收入线被压在图表底部，收入线在同图叠加时使用右侧独立 Y 轴：

- 左侧 Y 轴：总资产、投资类、余额类。
- 右侧 Y 轴：月收入或周期收入。

`incomeAmount` 缺失时保持 `undefined`，不转换成 `0`。这样 Recharts 不会把没有收入记录的月份画成收入为零。

如果后续实现选择可读性兜底的上下双图，仍复用同一份 `chartData`，不引入第二套聚合逻辑。

## 错误处理

1. 月份重复时，页面提示“该月份已有收入记录，请编辑已有记录”。
2. 金额为负数或非数字时，前端阻止提交，Worker 也返回 `400`。
3. 删除收入记录前弹出确认。
4. 加载收入失败时，总览页显示错误状态并允许重试，和当前总览数据加载方式保持一致。
5. 旧备份导入后没有收入记录时，总览页正常展示资产数据。

## 导入导出

导出 JSON 包含 `monthlyIncomes`。

导入预检查增加收入记录校验：

- `monthlyIncomes` 缺失时视为空数组，不报错。
- `monthlyIncomes` 存在但不是数组时提示问题。
- 收入记录月份无效时提示问题。
- 收入金额无效时提示问题。

导入成功提示可以扩展为：

```text
Data imported: 10 assets, 24 snapshots, 240 values, 12 monthly incomes
```

## 测试策略

### 领域层测试

1. 单条收入总额等于四个分类之和。
2. 月尺度按 `YYYY-MM` 返回收入。
3. 季尺度汇总季度内各月收入。
4. 年尺度汇总全年收入。
5. 日、周尺度不生成收入线数据。

### Worker 测试

1. 可以创建、更新、删除月收入记录。
2. 同月重复创建会被拒绝。
3. 负数金额或非法月份会被拒绝。
4. 导出包含 `monthlyIncomes`。
5. 导入旧备份时补空数组。
6. 导入新备份时保留收入记录。

### 页面测试

1. 总览页加载月收入数据。
2. 月尺度图表展示收入线。
3. 日尺度图表不展示收入线。
4. 收入线和总资产线默认在同一个走势图中展示，并使用右侧独立 Y 轴。
5. 已有当月收入时显示编辑入口。
6. 新增或编辑收入后刷新图表数据。

## 验收标准

1. 用户可以按月录入工资、额外收入、公积金和其他收入。
2. 同一个月份不会出现两条收入记录。
3. 总览页能看到最近月收入摘要。
4. 总资产走势图在月、季、年尺度下能显示收入线。
5. 日、周尺度不误展示月收入线。
6. 收入线默认与资产线同图展示，并通过右侧 Y 轴保持可读。
7. 收入记录不会改变资产快照或任何资产余额。
8. JSON 导入导出能完整保留收入记录。
9. 没有收入数据或旧备份导入时，现有资产总览继续正常工作。
