# RiceFinanceU 项目索引

这份文档是给人和 AI 的项目地图。先读这里，再进入具体代码。

## 一句话模型

RiceFinanceU 是一个个人资产快照账本，不是交易流水系统。

用户先在资产管理中维护长期存在的资产主数据，再在快照录入中记录某个时间点的金额状态。系统通过连续快照展示总资产、分类占比、历史趋势和投资类收益。

## 核心边界

### 资产管理

资产管理维护的是主数据，类似 PMS 或商品系统：

- 资产名称。
- 资产类型。
- 币种。
- 机构或平台。
- 启用状态。
- 备注。
- 类型档案 `profile`。

类型档案只回答“这是什么资产、在哪里、如何识别和管理”。它不参与金额、收益、估值或趋势计算。

### 快照录入

快照录入维护的是某次时点状态，类似盘点单：

- 快照时间。
- 本次更新的资产金额。
- 投资类资产的收益和收益率。
- 快照备注。

未更新的资产会沿用上一份快照的值。因此，每一份保存后的快照都代表一个完整时点。

## 领域对象

### Asset

长期存在的资产主数据。

位置：`src/types/finance.ts`

关键字段：

- `type`：资产类型，决定是否属于投资类，也决定可用的档案字段。
- `currency`：资产原币种。
- `isActive`：是否在新的快照录入中显示。
- `profile`：类型档案字段，只用于识别和管理。

### Snapshot

一次快照录入事件。

关键字段：

- `recordedAt`：这份快照代表的时间。
- `note`：本次盘点备注。

### SnapshotValue

某份快照里某个资产的状态。

关键字段：

- `amount`：当前余额或市值。
- `profit`：投资类资产当前收益。
- `profitRate`：投资类资产当前收益率，存小数，例如 `0.0865` 表示 `8.65%`。

## 资产类型规则

投资类资产：

- 基金 `fund`
- 股票 `stock`
- 黄金 `gold`

投资类资产支持金额、收益、收益率。

余额类资产：

- 存款 `deposit`
- 现金 `cash`
- 公积金 `housing_fund`
- 其他 `other`

余额类资产只支持金额，不支持收益和收益率。后端会拒绝给余额类资产提交收益字段。

## 类型档案规则

档案字段定义在 `src/domain/assets.ts` 的 `ASSET_PROFILE_FIELDS`。

清理函数是 `sanitizeAssetProfile(type, profile)`：

1. 只接受对象。
2. 只保留当前资产类型允许的字段。
3. 只保留非空字符串。
4. 去掉前后空格。
5. 没有可用字段时返回 `undefined`。

这个函数同时被前端和 Worker API 使用或镜像实现。这样切换资产类型时，不会把隐藏字段留在数据里。

## 快照补全规则

核心函数：`completeSnapshotValues`。

位置：`src/domain/snapshots.ts`

保存快照时，用户可以只提交本次变化的资产。系统会：

1. 复制上一份完整快照的所有 `SnapshotValue`。
2. 用本次提交的值覆盖对应资产。
3. 保存一份新的完整快照。

这个规则让总览和趋势计算不需要回溯多份历史数据。

## 当前运行架构

当前正式路径：

```txt
浏览器或小程序
  -> Cloudflare Worker /api
  -> Cloudflare KV
```

本地开发：

```txt
Vite dev server http://localhost:5173
  -> proxy /api
  -> Wrangler local Worker http://localhost:8787
```

旧 Express 后端和旧 `data/` 本地 JSON 数据目录已经移除。正式 API 行为以 `worker/index.js` 为准。

## 主要目录

| 路径 | 作用 |
|---|---|
| `src/types/finance.ts` | 核心领域类型 |
| `src/domain/` | 纯业务逻辑和计算函数 |
| `src/api/` | 前端请求封装和 session token |
| `src/pages/` | 页面级 React 组件 |
| `src/components/` | 可复用 UI 和表单组件 |
| `worker/` | Cloudflare Worker API 和测试 |
| `demo/` | 非主项目的示例、实验和教学代码 |
| `wx-miniprogram/` | 微信小程序端 |
| `docs/superpowers/specs/` | 产品和设计规格 |
| `docs/superpowers/plans/` | 实现计划 |

## 关键文件索引

### 前端入口

- `src/main.tsx`：React 启动入口。
- `src/App.tsx`：登录门禁和路由表。
- `src/components/Layout.tsx`：主导航布局。

### 页面

- `src/pages/DashboardPage.tsx`：总览、资产汇总、分类占比、趋势图、快照历史。
- `src/pages/AssetsPage.tsx`：资产管理、资产档案编辑、最新金额只读展示。
- `src/pages/AssetDetailPage.tsx`：单资产详情、资产档案、历史变化。
- `src/pages/EntryPage.tsx`：快照录入页容器。
- `src/pages/DataManagementPage.tsx`：导入、导出、数据检查。

### 录入

- `src/components/SnapshotForm.tsx`：快照录入主表单。
- `src/components/MoneyInput.tsx`：金额输入。
- `src/components/MoneyDisplay.tsx`：金额展示。
- `src/components/Feedback/FeedbackContext.tsx`：页面内 toast 和确认弹窗。

### 业务逻辑

- `src/domain/assets.ts`：资产类型、档案字段、档案清理、列表标识。
- `src/domain/snapshots.ts`：快照补全、汇总、分类占比、对比、趋势序列。
- `src/domain/money.ts`：金额格式化和输入校验。
- `src/domain/portfolio.ts`：快照计算的兼容 re-export。

### API

- `src/api/client.ts`：浏览器端 API client。
- `worker/index.js`：当前主 API 实现。
- `worker/worker.test.mjs`：Worker API 行为测试。

## 常用命令

安装依赖：

```bash
npm install
```

同时启动前端和 Worker API：

```bash
npm run dev:all
```

运行默认测试：

```bash
npm run test
```

只运行前端和领域测试：

```bash
npm run test:app
```

只运行 Worker 测试：

```bash
npm run worker:test
```

构建：

```bash
npm run build
```

## 改代码前的注意事项

1. 不要把资产主数据编辑和快照录入混成一个流程。
2. 不要让资产档案字段参与金额或收益计算。
3. 改资产类型或档案字段时，检查 `src/domain/assets.ts`、`worker/index.js` 和导入导出逻辑。
4. 改快照保存规则时，先看 `completeSnapshotValues` 的测试。
5. 改金额输入或展示时，保持 2 位小数、千分位、空值 `-` 的金融软件规则。
6. 改 Worker API 时，跑 `npm run worker:test`。
7. 改前端页面时，跑 `npm run test:app` 和 `npm run build`。
