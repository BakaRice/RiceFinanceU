# 定投计划与周期投入估算设计

日期：2026-07-05

## 背景

RiceFinanceU 当前是个人资产快照账本，不是交易流水系统。资产管理维护长期存在的资产主数据，快照录入记录某个时间点的资产状态。用户现在希望为资产增加定投能力，用来判断一段周期内的投入是否明显偏离计划，并且方便导出结构化数据后交给 AI 做进一步分析。

这个能力不追求精密投顾、收益预测或交易明细还原。它要回答的是一个更朴素的问题：按照我给这个资产设定的计划，到某个目标时间前，每期大概要投多少，当前计划是否明显偏离目标。

## 产品边界

资产管理负责：

- 资产基础信息。
- 类型档案。
- 可选定投计划。
- 定投计划的结构化导出。

资产详情负责：

- 展示资产当前快照状态。
- 展示定投计划。
- 基于最新快照金额做轻量估算。
- 提示计划投入和建议投入的偏差。

快照录入负责：

- 记录某个时间点的资产金额。
- 记录投资类资产的收益和收益率。
- 保持已有部分快照补全规则。

本次不把定投拆成交易流水，不自动生成快照，不接行情，不做提醒推送，也不把计划字段用于资产估值或收益计算。

## 产品目标

1. 每个投资类资产可以保存一份可选定投计划。
2. 用户可以从资产详情看到目标周期内的建议每期投入和偏差。
3. 估算逻辑足够透明，避免给人“精密预测”的错觉。
4. 导出 JSON 中保留结构化计划字段，方便发给 AI 分析。
5. 保持资产主数据和快照录入的现有边界，不引入交易流水模型。

## 非目标

- 不支持一个资产多份并行定投计划。
- 不记录每次真实买入、卖出、扣款或成交。
- 不基于收益率预测未来市值。
- 不接入净值、股价、汇率或银行扣款接口。
- 不做提醒、日历、自动任务或计划完成状态流转。
- 不把定投计划同步到小程序端第一版 UI。

## 信息模型

在 `Asset` 上新增可选字段 `dcaPlan`。它属于资产主数据，表达“我计划怎么投入”，不表达“这个资产现在值多少钱”。

示意：

```ts
type DcaFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

type AssetDcaPlan = {
  enabled: boolean
  frequency: DcaFrequency
  excludeWeekends?: boolean
  plannedContribution: number
  targetAmount?: number
  targetDate?: string
  toleranceRate?: number
  note?: string
}

type Asset = {
  id: string
  name: string
  type: AssetType
  institution?: string
  currency: Currency
  isActive: boolean
  note?: string
  profile?: AssetProfile
  dcaPlan?: AssetDcaPlan
  createdAt: string
  updatedAt: string
}
```

字段说明：

- `enabled`：是否启用定投计划。关闭时保留字段也可以，但页面不展示估算结果。
- `frequency`：定投周期。第一版支持每日、每周、每两周、每月、每季度。
- `excludeWeekends`：每日定投估算时是否排除周六和周日，缺省为 `true`。非每日周期第一版不使用这个字段。
- `plannedContribution`：当前计划每期投入金额，使用资产原币种。
- `targetAmount`：目标金额，使用资产原币种。
- `targetDate`：目标日期，使用 `YYYY-MM-DD`。
- `toleranceRate`：可接受偏差比例，小数存储。例如 `0.2` 表示 20%。缺省时按 20% 处理。
- `note`：计划备注，用来记录策略、资金来源或给 AI 分析的上下文。

定投计划只对投资类资产显示和保存：基金、股票、黄金。余额类资产不显示计划入口。Worker API 收到余额类资产的 `dcaPlan` 时应丢弃或拒绝，推荐第一版直接清理掉，保持个人工具的容错性。

## 估算逻辑

估算使用纯函数完成，输入为：

- 当前日期。
- 资产。
- 最新快照金额。
- 资产定投计划。

输出为：

- `periodsRemaining`：从当前日期到目标日期之间还剩多少个投入周期。
- `remainingAmount`：目标金额减去最新金额，低于 0 时按 0 处理。
- `suggestedContribution`：如果要按期达到目标，每期建议投入金额。
- `plannedContribution`：资产计划中保存的每期投入金额。
- `contributionGap`：计划每期投入减去建议每期投入。
- `contributionGapRate`：偏差比例。
- `status`：`on_track`、`underfunded`、`overfunded`、`insufficient_data`。
- `message`：给页面展示的短提示。

基础公式：

```txt
remainingAmount = max(targetAmount - latestAmount, 0)
suggestedContribution = periodsRemaining > 0
  ? remainingAmount / periodsRemaining
  : remainingAmount
contributionGap = plannedContribution - suggestedContribution
contributionGapRate = suggestedContribution > 0
  ? contributionGap / suggestedContribution
  : 0
```

剩余周期数按定投周期计算：

- 每日：从当前日期之后到目标日期当天，按天计数；`excludeWeekends` 缺省为 `true`，默认不把周六和周日计入周期。
- 每周：按 7 天为一个周期估算。
- 每两周：按 14 天为一个周期估算。
- 每月：按自然月近似估算。
- 每季度：按 3 个自然月近似估算。

每日周期的周末排除只影响 `periodsRemaining`。它不代表真实交易日历，也不处理节假日，避免把第一版做成精密日历系统。

状态规则：

- 缺少 `targetAmount`、`targetDate`、`plannedContribution` 或最新金额时，状态为 `insufficient_data`。
- 目标日期已经过去且仍有剩余目标金额时，状态为 `underfunded`。
- `plannedContribution` 低于建议每期投入超过容忍比例时，状态为 `underfunded`。
- `plannedContribution` 高于建议每期投入超过容忍比例时，状态为 `overfunded`。
- 其余情况为 `on_track`。

页面文案不使用投资建议语气，只表达偏差。例如：

- `计划投入低于目标倒推金额，后续可能需要提高每期投入。`
- `计划投入高于目标倒推金额，可检查是否有意加速投入。`
- `计划投入与目标倒推金额接近。`

## 页面设计

### 资产列表

资产列表第一版不新增定投估算列，避免表格继续变宽。可以在资产名称或标识附近显示一个低权重的 `定投` 标签，用来说明该资产有计划。若空间不足，第一版可以只在详情页展示。

### 新增和编辑资产

资产弹窗在投资类资产下增加“定投计划”区块：

- 启用定投计划。
- 周期。
- 排除周末。只在选择每日周期时显示或启用，默认勾选。
- 每期计划投入。
- 目标金额。
- 目标日期。
- 容忍偏差。
- 备注。

余额类资产隐藏该区块。切换资产类型时，如果从投资类切到余额类，保存时清理 `dcaPlan`。

定投字段全部可选，但启用计划后至少需要周期和每期计划投入才算有效。目标金额和目标日期缺失时，可以保存计划，但详情页只展示计划本身，不输出目标倒推估算。

### 资产详情

资产详情页新增“定投计划”区域。展示内容：

- 周期。
- 每日计划是否排除周末。
- 每期计划投入。
- 目标金额。
- 目标日期。
- 最新金额。
- 剩余目标金额。
- 剩余周期数。
- 建议每期投入。
- 当前计划与建议值的偏差。
- 计划备注。

如果缺少估算所需字段，展示“计划已保存，补充目标金额和目标日期后可估算周期投入”。如果资产没有定投计划，不展示该区域或显示低权重空状态。

## 数据和兼容性

1. 老资产没有 `dcaPlan` 时继续正常显示和编辑。
2. 新建或编辑投资类资产时可以提交 `dcaPlan`。
3. 后端保存资产时清理 `dcaPlan`，只保留投资类资产上的有效字段。
4. 导入备份时允许 `dcaPlan` 缺失。
5. 导入备份时如果 `dcaPlan` 存在，必须按字段类型清理：周期必须在允许枚举内，金额和比例必须是有限数字，日期必须是有效日期字符串，`excludeWeekends` 必须是布尔值，备注必须是非空字符串。
6. 导出备份保留 `dcaPlan`，让 AI 可以读取计划上下文。
7. schema 版本第一版可以保持 `2`，因为新增字段是向后兼容的可选资产属性。

## 架构和模块

新增纯领域函数放在 Web 端当前领域层，后续小程序也要使用时再抽到 `modules/finance-core`：

- `modules/web-app/src/domain/dca.ts`：定投计划清理、周期换算、估算逻辑。
- `modules/web-app/src/domain/dca.test.ts`：估算和清理测试。

Web 页面负责表单状态和展示：

- `modules/web-app/src/pages/AssetsPage.tsx`：编辑定投计划。
- `modules/web-app/src/pages/AssetDetailPage.tsx`：展示计划和估算。

Worker API 负责生产数据守门：

- `modules/worker-api/index.js`：创建、更新、导入资产时清理 `dcaPlan`。
- `modules/worker-api/worker.test.mjs`：验证投资类资产保留计划、余额类资产清理计划、导出保留结构化字段。

## 错误处理

- 无效周期：清理为默认 `monthly` 或丢弃计划，推荐丢弃计划并由前端表单避免提交。
- 每日周期缺少 `excludeWeekends`：按 `true` 处理，默认排除周末。
- 非法金额：不保存该数字字段。
- 目标日期无效：不保存目标日期。
- 目标日期已经过去：允许保存，详情页估算显示偏差状态。
- 最新快照缺失：计划可保存，但详情页显示数据不足。

## 验收标准

1. 投资类资产可以保存、编辑、清空定投计划。
2. 余额类资产不会保存定投计划。
3. 定投周期支持每日、每周、每两周、每月和每季度。
4. 每日定投默认排除周六和周日，且这个设置能被保存和导出。
5. 资产详情页可以基于最新快照金额、目标金额和目标日期估算建议每期投入。
6. 估算结果能区分数据不足、计划偏低、计划偏高和接近目标。
7. 定投计划不会影响快照录入、资产汇总、趋势和收益计算。
8. 导出 JSON 保留资产上的 `dcaPlan` 字段。
9. 导入 JSON 时会清理非法 `dcaPlan` 字段。
10. 新增领域测试、页面测试和 Worker 测试覆盖核心行为。
