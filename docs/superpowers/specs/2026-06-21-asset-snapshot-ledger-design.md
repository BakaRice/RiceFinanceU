# 资产快照账本技术方案

日期：2026-06-21

## 背景

当前系统以“存款账户 + 基金交易流水 + 基金净值”为核心。这个模型适合精细化追踪基金买入、卖出、份额和净值，但不适合日常个人资产盘点。

新的目标是把系统改成“资产快照账本”：用户不需要记录每笔交易，只需要在某个时间点录入各个资产项的当前状态。系统基于连续快照展示总资产、资产类别占比、区间变化和投资类收益变化。

## 产品目标

支持用户维护明细资产项，并通过局部更新生成完整快照。

用户每次录入时只填写本次想更新的资产项。未填写的资产项沿用上一份快照中的最新金额和投资收益字段。这样用户可以只更新黄金、公积金或某只基金，也能保持总资产曲线连续。

## 非目标

- 不再要求记录基金、股票或黄金的每笔买入卖出。
- 不再通过基金份额和净值推算持仓。
- 不做复式记账。
- 不自动联网拉取行情。
- 不把存款、现金、公积金的余额变化解释为收益。

## 核心概念

### Asset

长期存在的资产项。资产项表示一个可被持续追踪的明细标的或账户。

示例：

- 易方达科创创业50
- 纳指100
- 华泰证券账户
- 支付宝积存金
- 公积金
- 招商银行活期

```ts
export type AssetType =
  | 'fund'
  | 'stock'
  | 'gold'
  | 'deposit'
  | 'cash'
  | 'housing_fund'
  | 'other'

export type Asset = {
  id: string
  name: string
  type: AssetType
  institution?: string
  currency: 'CNY'
  isActive: boolean
  note?: string
  createdAt: string
  updatedAt: string
}
```

### Snapshot

一次资产录入事件。它代表一个完整时点，而不是一笔交易。

```ts
export type Snapshot = {
  id: string
  recordedAt: string
  note?: string
  createdAt: string
}
```

### SnapshotValue

某个快照中某个资产项的状态。

所有资产都有 `amount`，表示当前余额或当前市值。基金、股票、黄金是投资类资产，额外支持当前收益和当前收益率。

```ts
export type SnapshotValue = {
  id: string
  snapshotId: string
  assetId: string
  amount: number
  profit?: number
  profitRate?: number
  note?: string
}
```

`profitRate` 建议存小数，例如 `0.0865` 表示 `8.65%`。前端展示时再格式化为百分比。

## 资产分类规则

投资类资产：

- 基金：`fund`
- 股票：`stock`
- 黄金：`gold`

投资类资产支持：

- 当前市值
- 当前收益
- 当前收益率
- 区间市值变化
- 区间收益变化

余额类资产：

- 存款：`deposit`
- 现金：`cash`
- 公积金：`housing_fund`
- 其他：`other`

余额类资产只支持：

- 当前余额
- 区间余额变化

余额类资产不展示收益和收益率，避免把工资转入、消费、缴存、转账等现金流误读为投资收益。

## 局部更新规则

用户提交一次录入时，提交的是若干个资产项的新值。后端保存时生成一份新的完整快照。

规则：

1. 读取上一份完整快照。
2. 复制上一份快照中的所有资产值。
3. 用本次提交的资产值覆盖对应资产。
4. 如果本次提交中包含新资产项，则创建资产项并加入快照。
5. 保存新的 `Snapshot` 和它对应的完整 `SnapshotValue[]`。

这意味着每个快照都能独立代表一个完整时点，仪表盘和图表读取时不需要递归回溯历史。

## API 设计

### 资产项

```txt
GET    /api/assets
POST   /api/assets
PATCH  /api/assets/:id
DELETE /api/assets/:id
```

删除建议做软删除：把 `isActive` 设为 `false`。历史快照仍然可以引用这个资产项。

### 快照

```txt
GET  /api/snapshots
GET  /api/snapshots/latest
POST /api/snapshots
GET  /api/snapshots/:id
```

`POST /api/snapshots` 请求体：

```ts
type CreateSnapshotInput = {
  recordedAt: string
  note?: string
  values: Array<{
    assetId?: string
    asset?: {
      name: string
      type: AssetType
      institution?: string
      note?: string
    }
    amount: number
    profit?: number
    profitRate?: number
    note?: string
  }>
}
```

`assetId` 和 `asset` 二选一。传 `asset` 时表示在录入过程中顺手新增资产项。

### 分析接口

第一版可以先在前端基于快照计算；如果后续数据量变大，再把分析下沉到后端。

建议保留这些纯函数：

```ts
calculateSnapshotTotal(values)
calculateAllocation(assets, values)
compareSnapshots(assets, previousValues, currentValues)
buildTotalAssetSeries(snapshots, valuesBySnapshot)
```

## 存储设计

继续使用本地 JSON 文件，保持项目当前的简单部署方式。

新增文件：

```txt
data/assets.json
data/snapshots.json
data/snapshot-values.json
```

旧文件进入兼容期：

```txt
data/deposits.json
data/funds.json
data/transactions.json
data/nav-prices.json
```

兼容期内不立刻删除旧文件，避免丢失用户已有数据。导入导出需要同时支持新旧 schema。

## 类型与文件结构

建议新增或改造：

```txt
src/types/finance.ts
  定义 Asset、Snapshot、SnapshotValue、ExportData v2。

src/domain/assets.ts
  资产分类、投资类判断、资产名称格式化。

src/domain/snapshots.ts
  局部更新补全、快照聚合、区间比较。

src/domain/portfolio.ts
  改为基于快照计算总资产和占比。

src/pages/AssetsPage.tsx
  维护资产项清单。

src/pages/EntryPage.tsx
  从交易录入改为快照录入。

src/pages/DashboardPage.tsx
  展示最新快照、类别占比、总资产曲线。

src/components/SnapshotForm.tsx
  快照局部更新表单。

src/components/SnapshotComparison.tsx
  两个快照之间的变化展示。

server/storage.ts
  增加 assets、snapshots、snapshot-values 三个 collection。

server/routes/dataRoutes.ts
  增加资产项和快照 API。

server/routes/importExportRoutes.ts
  支持 schemaVersion 2 的导入导出。
```

## 页面设计

### 资产页

用于维护长期资产项。

字段：

- 名称
- 类型
- 平台或机构
- 备注
- 是否启用

用户也可以不提前创建资产项，而是在快照录入页里顺手新增。

### 录入页

从“新增操作”改为“新增资产快照”。

交互：

1. 默认显示所有启用资产项。
2. 用户只填写本次需要更新的资产。
3. 投资类资产显示金额、当前收益、当前收益率。
4. 余额类资产只显示金额。
5. 支持“新增资产项”内联操作。
6. 提交后生成一份完整快照。

为了避免误操作，表单可以区分：

- “本次更新”资产项：用户改过字段或手动勾选。
- “沿用上次”资产项：仅用于预览，不作为用户主动输入展示。

### 仪表盘

基于最新快照展示：

- 总资产
- 投资类资产总额
- 余额类资产总额
- 投资类当前收益合计
- 资产类别占比
- 总资产历史曲线
- 最近两次快照变化

### 区间对比

用户选择起始快照和结束快照。

展示：

- 总资产变化
- 各资产类别变化
- 各明细资产变化
- 投资类收益变化

收益变化口径：

```txt
区间收益变化 = 结束快照 profit - 起始快照 profit
```

如果任一快照缺少 `profit`，则显示为空，不自动估算。

## 迁移方案

建议采用 schemaVersion 2。

迁移原则：

1. 旧的 `deposits` 转为 `Asset`，类型映射到 `deposit`、`cash`、`other` 等。
2. 每个旧存款账户的当前余额转为一条最新快照值。
3. 旧的 `funds` 转为 `Asset`，类型统一为 `fund`。
4. 如果旧系统能算出基金当前市值，则写入最新快照值的 `amount`。
5. 如果旧系统能算出浮动盈亏，则写入 `profit`。
6. 旧交易和净值数据保留在备份中，但新 UI 不再依赖。

迁移后生成一份初始快照：

```txt
recordedAt = 迁移时间
note = 从旧版交易模型迁移生成
```

## 校验规则

后端必须校验：

- `Asset.name` 非空。
- `Asset.type` 必须属于允许枚举。
- `Snapshot.recordedAt` 必须是合法时间。
- `SnapshotValue.amount` 必须是有限数字。
- 投资类资产允许 `profit` 和 `profitRate`。
- 余额类资产提交 `profit` 或 `profitRate` 时后端忽略或返回 400。推荐返回 400，让数据口径更明确。
- `assetId` 必须存在且启用，除非本次提交的是内联新增资产。

## 测试策略

重点测试纯领域逻辑。

必须覆盖：

- 局部更新会沿用上一快照未填写的资产值。
- 局部更新会覆盖本次填写的资产值。
- 新资产项可以从本次快照开始出现。
- 投资类资产可以保存收益和收益率。
- 余额类资产不接受收益字段。
- 总资产按快照值求和。
- 类别占比按资产类型聚合。
- 区间变化按两个快照相减。
- 缺失收益时不估算收益变化。

服务端测试覆盖：

- 创建资产项。
- 创建快照。
- 创建快照时内联新增资产项。
- 获取最新快照。
- 导入导出 schemaVersion 2。

## 分阶段落地

### 阶段 1：新增快照领域模型

新增类型、纯函数和测试，不改 UI 主流程。

交付结果：

- `Asset`、`Snapshot`、`SnapshotValue` 类型可用。
- 局部更新补全逻辑有测试。
- 聚合和区间对比逻辑有测试。

### 阶段 2：新增后端存储和 API

新增 JSON collection 和快照相关 API。

交付结果：

- 可以创建资产项。
- 可以创建局部快照并保存为完整快照。
- 可以读取最新快照和历史快照。

### 阶段 3：替换录入页

把 `EntryPage` 从交易录入改为快照录入。

交付结果：

- 用户可以选择已有资产项录入金额。
- 用户可以内联新增资产项。
- 基金、股票、黄金显示收益字段。
- 存款、现金、公积金不显示收益字段。

### 阶段 4：改造仪表盘

仪表盘改为读取最新快照和历史快照。

交付结果：

- 总资产来自最新快照。
- 占比来自资产类型聚合。
- 曲线来自历史快照。
- 最近变化来自最近两次快照对比。

### 阶段 5：迁移和清理旧模型

提供旧数据迁移到新 schema 的路径，再逐步隐藏旧基金交易页面。

交付结果：

- 旧存款和基金可迁移为资产项。
- 旧当前余额和基金持仓可生成初始快照。
- 导入导出支持 schemaVersion 2。
- 旧交易页面不再作为主入口。

## 关键取舍

这个方案牺牲了逐笔交易可追踪性，换来更低的日常维护成本。它不会回答“这只基金我在哪一天买入了多少份”，但能很好回答“我在某个时间点有多少钱，资产分布如何，这段时间资产和收益如何变化”。

对于当前个人使用场景，这是更合适的主模型。
