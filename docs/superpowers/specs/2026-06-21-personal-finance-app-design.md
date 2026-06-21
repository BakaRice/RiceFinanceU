# 个人财务管理软件技术设计

日期：2026-06-21

## 设计约定

本项目的设计文档、UI 方案、评审说明默认使用中文，便于审查和讨论。代码文件名、类型名、函数名、接口字段名使用英文，保持工程可维护性。

## 目标

构建一个本机单人使用的个人财务管理 Web App，用于管理存款和基金持仓。第一版应当简单、透明、可用，并且不依赖数据库。

第一版支持：

- 查看总资产、存款总额、基金市值和浮动盈亏。
- 管理存款账户，例如银行活期、定期、支付宝、微信余额和类似现金资产。
- 管理基金持仓，包括手动录入买入、卖出和基金净值。
- 查看每个基金的整体走势图，包括单位净值、持仓市值、累计投入和收益变化。
- 记录基础财务操作，方便之后追踪资产变化来源。
- 使用本机 JSON 文件持久化所有数据。
- 导出和导入完整 JSON 备份。

第一版明确不做：

- 多用户。
- 云同步。
- 登录和认证。
- 数据库存储。
- 自动联网拉取基金净值。
- 完整收入、支出、分类、预算或复式记账流程。

核心设计原则是：本机优先、存储简单、数据透明、模块边界清楚，并且保留未来演进空间。

## 总体架构

采用基于路由拆分的 React/Vite 单页应用，加一个很薄的本机 Node/Express API。

```txt
React/Vite 前端
    |
    | HTTP JSON API
    v
Node/Express 本机后端
    |
    | fs 读写
    v
data/*.json 文件
```

推荐技术栈：

- 前端：React、Vite、TypeScript。
- 路由：React Router。
- 图表：Recharts。
- 表单：第一版使用 React 原生状态，不引入复杂表单库。
- 后端：Node.js 和 Express。
- 持久化：`data/` 目录下的本机 JSON 文件。
- 校验：Zod 或类似的小型 schema 校验层。
- 样式：普通 CSS 或 CSS Modules。
- 测试：Vitest，重点覆盖领域计算和存储行为。

这里的“单页应用”只表示浏览器一次加载前端应用，并不表示所有代码写在一个页面里。前端必须按页面、组件、API client、共享类型和纯领域计算拆分。

## 项目结构

```txt
RiceFinanceU/
  package.json
  vite.config.ts
  tsconfig.json

  src/
    main.tsx
    App.tsx

    pages/
      DashboardPage.tsx
      DepositsPage.tsx
      FundsPage.tsx
      FundDetailPage.tsx
      EntryPage.tsx

    components/
      Layout.tsx
      AssetSummary.tsx
      DepositTable.tsx
      FundTable.tsx
      FundChart.tsx
      TransactionList.tsx
      TransactionForm.tsx

    api/
      client.ts

    domain/
      deposits.ts
      funds.ts
      portfolio.ts
      money.ts

    types/
      finance.ts

  server/
    index.ts
    storage.ts
    routes/
      dataRoutes.ts
      importExportRoutes.ts

  data/
    deposits.json
    funds.json
    transactions.json
    nav-prices.json
    meta.json

  docs/
    superpowers/
      specs/
```

## 数据模型

### 存款账户

```ts
type DepositAccount = {
  id: string
  name: string
  institution: string
  accountType: 'cash' | 'current' | 'fixed' | 'money_market' | 'other'
  balance: number
  currency: 'CNY'
  note?: string
  updatedAt: string
}
```

存款账户保存当前状态。余额变化也会记录到操作流水中，并包含调整前和调整后的余额，方便追踪账户为什么发生变化。

### 基金

```ts
type Fund = {
  id: string
  code?: string
  name: string
  platform?: string
  currency: 'CNY'
  note?: string
  createdAt: string
  updatedAt: string
}
```

基金只保存稳定的身份信息和元数据。持仓、当前市值和盈亏都由交易流水和净值点推导得出。

### 操作流水

```ts
type Transaction =
  | {
      id: string
      type: 'deposit_adjustment'
      depositAccountId: string
      amountBefore: number
      amountAfter: number
      occurredAt: string
      note?: string
    }
  | {
      id: string
      type: 'fund_buy'
      fundId: string
      amount: number
      shares: number
      fee?: number
      occurredAt: string
      note?: string
    }
  | {
      id: string
      type: 'fund_sell'
      fundId: string
      amount: number
      shares: number
      fee?: number
      occurredAt: string
      note?: string
    }
  | {
      id: string
      type: 'fund_nav'
      fundId: string
      nav: number
      occurredAt: string
      note?: string
    }
```

操作流水是追加式记录，不是完整记账账本。第一版只记录资产管理必需的几类操作：存款余额调整、基金买入、基金卖出和基金净值录入。

### 基金净值点

```ts
type FundNavPrice = {
  id: string
  fundId: string
  nav: number
  date: string
}
```

净值点单独存储，因为图表需要直接读取时间序列数据。录入净值时，也应同时创建一条 `fund_nav` 操作流水，保证操作历史完整。

后端应把“写入净值点”和“写入净值操作流水”当成一次逻辑 mutation。如果其中任一步失败，就不能把这次录入视为成功。

### 元数据

```ts
type Meta = {
  schemaVersion: 1
  updatedAt: string
}
```

`schemaVersion` 用于将来 JSON 结构变化时做数据迁移。

## 持久化设计

采用多个 JSON 文件：

```txt
data/
  deposits.json       # 存款账户当前状态
  funds.json          # 基金元数据
  transactions.json   # 操作流水
  nav-prices.json     # 基金净值时间序列
  meta.json           # 数据版本和最后更新时间
```

后端存储规则：

- 启动时确保 `data/` 目录和所有必需 JSON 文件存在。
- 缺失文件用合法的空数组或元数据初始化。
- 所有 JSON 读取通过统一的 storage 模块完成。
- 返回数据前进行结构校验。
- 写入时先写临时文件，再替换目标文件，降低写坏风险。
- 如果新数据无法通过校验，绝不覆盖已有数据。
- 每次成功 mutation 后更新 `meta.json`。

这个方案保持了文件持久化的简单性，同时降低写入过程中损坏数据的概率。

## 页面设计

### 总览页

`DashboardPage` 展示：

- 总资产。
- 存款总额。
- 基金市值。
- 浮动盈亏。
- 资产构成摘要。
- 最近操作记录。

### 存款页

`DepositsPage` 展示：

- 存款账户列表。
- 账户机构和账户类型。
- 当前余额。
- 最后更新时间。
- 新增账户入口。
- 调整余额入口。

### 基金页

`FundsPage` 展示：

- 基金列表。
- 当前份额。
- 最新净值。
- 当前市值。
- 累计投入。
- 浮动盈亏。
- 基金详情页入口。

### 基金详情页

`FundDetailPage` 展示：

- 基金基础信息。
- 当前持仓摘要。
- 图表：单位净值、持仓市值、累计投入和盈亏。
- 买入和卖出历史。
- 净值录入历史。

### 录入页

`EntryPage` 提供统一录入口：

- 存款余额调整。
- 基金买入。
- 基金卖出。
- 基金净值录入。

第一版使用统一录入页，保持流程简单。后续可以在存款页和基金详情页增加快捷操作。

## 领域计算

业务计算放在 `src/domain/` 下的纯函数中。React 组件不直接写财务计算逻辑，而是调用这些领域函数。

建议模块：

```txt
src/domain/
  deposits.ts
    calculateDepositTotal()

  funds.ts
    calculateFundPosition()
    calculateFundMarketValue()
    calculateFundProfit()
    buildFundChartSeries()

  portfolio.ts
    calculateTotalAssets()
    calculateAssetAllocation()

  money.ts
    formatMoney()
    roundMoney()
```

基金持仓计算使用平均成本法：

- 买入增加份额和总投入成本。
- 卖出减少份额，并按照平均成本法减少对应成本。
- 最新净值取该基金最近一个净值点。
- 当前市值 = 当前份额 × 最新净值。
- 已实现收益 = 卖出回收金额 - 被卖出份额的平均成本，扣除卖出手续费。
- 浮动收益 = 当前市值 - 当前持有份额的剩余平均成本。
- 总收益 = 已实现收益 + 浮动收益。

第一版推荐平均成本法，因为它容易解释、容易测试，也足够满足个人资产管理。

## API 设计

使用资源式接口：

```txt
GET    /api/deposits
POST   /api/deposits
PATCH  /api/deposits/:id
DELETE /api/deposits/:id

GET    /api/funds
POST   /api/funds
PATCH  /api/funds/:id
DELETE /api/funds/:id

GET    /api/transactions
POST   /api/transactions

GET    /api/funds/:id/nav-prices
POST   /api/funds/:id/nav-prices

GET    /api/export
POST   /api/import
```

后端保持很薄：

- 校验输入。
- 读取和写入 JSON 文件。
- 返回清晰错误。
- 第一版不负责资产组合计算。

前端通过纯领域函数计算派生数据。这样后端接近一个本机文件 API，整体更简单。

## 前端状态

第一版不使用 Redux，也不引入复杂状态管理器。

状态策略：

- 通过 `src/api/client.ts` 加载页面数据。
- 使用页面级 `useState` 和 `useEffect`。
- mutation 成功后重新加载受影响的资源或页面数据。
- 派生值不进入存储状态，而是从源数据实时计算。

如果后续请求缓存、加载状态和 mutation invalidation 变得重复，再考虑引入 TanStack Query。

## 错误处理

前端行为：

- 读取数据时显示加载状态。
- 加载失败时显示错误提示和重试入口。
- 表单输入不合法时显示字段级错误。
- 保存失败时明确提示“未保存成功”。
- 删除和备份恢复前要求二次确认。

后端行为：

- 缺失 JSON 文件自动初始化。
- JSON 文件损坏或解析失败时返回错误，不自动覆盖。
- 请求体不合法时返回 400。
- 存储失败时返回 500。
- mutation 在文件层面尽量做到全有或全无。

任何写入失败都必须让用户看见，不能静默吞掉。

## 备份与恢复

第一版包含完整数据导出和导入。

导出：

- 返回一个完整 JSON 备份，包含存款、基金、操作流水、净值点和元数据。

导入：

- 校验备份结构和 `schemaVersion`。
- 拒绝非法备份。
- 覆盖本地数据前要求用户明确确认。
- 只有全部校验通过后才写入替换文件。

这样可以提供一个简单可靠的手动备份路径，而不引入云同步。

## 安全策略

第一版定位为本机使用：

- 不做登录。
- 不做认证。
- 不做加密。
- 后端监听 `127.0.0.1`。
- 应用面向一台机器上的一个可信本地用户。

这样可以避免加入表面安全但实际增加复杂度的功能。如果未来需要远程访问、多设备同步或多人使用，应先重新设计安全模型。

## 测试策略

优先测试纯领域逻辑和存储安全。

领域测试：

- 存款总额计算。
- 基金买入后的持仓计算。
- 基金卖出后的持仓计算。
- 平均成本行为。
- 最新净值选择。
- 市值计算。
- 盈亏计算。
- 图表序列生成。
- 资产总额和资产配置计算。

存储测试：

- 空数据文件初始化。
- JSON 读取行为。
- JSON 写入行为。
- 非法 JSON 拒绝。
- 导入结构不合法的备份时拒绝覆盖。

建议测试文件：

```txt
src/domain/funds.test.ts
src/domain/portfolio.test.ts
server/storage.test.ts
```

## 开发顺序

1. 初始化 React、Vite、TypeScript、Express 和 Vitest。
2. 创建 JSON 数据文件和 storage 模块。
3. 定义共享财务类型。
4. 实现领域计算函数并编写测试。
5. 实现后端 API 路由。
6. 实现总览页。
7. 实现存款页。
8. 实现基金页。
9. 实现基金详情走势图。
10. 实现统一录入页。
11. 实现导出和导入。
12. 使用样例数据做一次端到端手动验收。

## 后续增强

后续可以考虑：

- 自动拉取基金净值，并加入缓存和失败处理。
- 本地访问密码或加密备份导出。
- 当 JSON 文件变得受限时迁移到 SQLite。
- 使用 Tauri 或 Electron 打包为桌面应用。
- 增加移动端友好的 PWA 布局。
- 扩展完整记账能力：收入、支出、转账、分类、预算和报表。

这些能力都不属于第一版范围。

## 推荐结论

采用：

```txt
React/Vite 路由式 SPA
+ Node/Express 本机文件 API
+ TypeScript
+ 多 JSON 文件
+ Recharts
+ Vitest
```

这个方案符合第一性原理目标：不用数据库，持久化清楚透明，有足够结构维持可维护性，并且未来可以在不推翻核心架构的前提下继续演进。
