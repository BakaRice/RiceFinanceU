# 总资产走势尺度切换设计

## 背景

当前总览页的“总资产走势”直接按快照历史绘制折线。这个口径忠实反映录入事件，但和长期使用场景不完全匹配：用户可能在同一天多次补录或修正，也可能只在某些资产变化时录入快照。把每条快照都画成一个点，会让走势图更像“录入历史”，而不是“资产趋势”。

新的目标是让用户按日、周、月、季、年查看总资产趋势，并在每个周期内只保留最后一条快照作为该周期的资产状态。

## 目标

1. 总览页的走势图支持 `日`、`周`、`月`、`季`、`年` 五种尺度。
2. 同一周期内有多条快照时，只展示该周期最后一条快照。
3. 默认尺度为 `日`，保持当前使用习惯。
4. 图表控件保持紧凑，放在“总资产走势”标题右侧。
5. Tooltip 明确展示周期标签和实际快照时间，避免用户误解为周期平均值。

## 非目标

1. 不新增后端趋势接口。
2. 不改变快照保存、删除、导入导出的数据结构。
3. 不做趋势缓存或预计算。
4. 不在本次加入自定义时间范围筛选。
5. 不调整微信小程序总览页，因为小程序当前没有总资产走势图。

## 用户体验

总览页中，“总资产走势”标题右侧增加一个紧凑的分段控件：

```text
日  周  月  季  年
```

用户点击不同尺度后，图表立即使用相同快照数据重新聚合并渲染。

日视图下，如果同一天录入多次，只展示当天最后一次录入的总资产。周、月、季、年视图同理，只展示该自然周期内最后一次录入的总资产。

当聚合后的点少于原始快照数量时，不额外提示“已合并 N 条快照”。Tooltip 中展示足够信息：

```text
周期：2026-07
实际快照：2026-07-05 21:30
总资产：¥123,456.78
投资类：¥80,000.00
余额类：¥43,456.78
```

## 周期定义

所有周期按浏览器本地时区解释快照时间。

| 尺度 | 分组规则 | 示例标签 |
| --- | --- | --- |
| 日 | 本地自然日 | `2026-07-05` |
| 周 | 周一到周日的自然周 | `2026-06-29 周` |
| 月 | 本地自然月 | `2026-07` |
| 季 | 本地自然季度 | `2026 Q3` |
| 年 | 本地自然年 | `2026` |

每个周期点保留该周期内 `recordedAt` 最晚的快照。折线的横轴展示周期标签，Tooltip 展示实际快照时间。

## 技术方案

采用前端聚合。

当前 `DashboardPage` 已经加载：

- `assets`
- `latestData`
- `snapshots`
- `snapshotValues`
- `rates`

因此不需要增加 API。实现会在 `src/domain/snapshots.ts` 中扩展趋势构建能力，让领域层负责把快照序列转换为可展示的周期序列。

建议新增类型：

```ts
export type TrendScale = 'day' | 'week' | 'month' | 'quarter' | 'year'
```

建议扩展 `TotalAssetPoint`：

```ts
export interface TotalAssetPoint {
  recordedAt: string
  periodKey: string
  periodLabel: string
  totalAmount: number
  investmentAmount: number
  balanceAmount: number
  totalProfit: number
}
```

`recordedAt` 保留真实快照时间，`periodKey` 用于稳定分组和排序，`periodLabel` 用于横轴显示。

建议新增函数：

```ts
export function buildScaledTotalAssetSeries(
  snapshots: Snapshot[],
  valuesBySnapshot: Map<string, SnapshotValue[]>,
  assets: Asset[],
  scale: TrendScale,
  rates?: ExchangeRates
): TotalAssetPoint[]
```

函数职责：

1. 按 `recordedAt` 升序遍历快照。
2. 为每条快照计算周期 key 和 label。
3. 计算该快照的总资产、投资类、余额类、收益。
4. 同一周期内如果遇到更晚快照，用新点覆盖旧点。
5. 返回按周期 key 升序排列的点。

旧的 `buildTotalAssetSeries` 可以保留为日尺度兼容包装，避免无关调用点被迫迁移。

## 组件改动

`DashboardPage` 增加一个本地状态：

```ts
const [trendScale, setTrendScale] = useState<TrendScale>('day')
```

在加载完成后，页面保留原始 `snapshots`、`valuesBySnapshot` 或足够的数据，以便 `trendScale` 切换时重新计算 `chartData`。

可选实现方式：

1. 在 `load()` 中保存聚合输入，切换尺度时通过 `useMemo` 生成 `chartData`。
2. 或者在 `trendScale` 改变时调用一个本地函数重新设置 `chartData`。

推荐使用 `useMemo`，因为它减少重复状态，`chartData` 是由快照、资产、汇率、尺度推导出来的数据。

图表横轴从 `recordedAt` 改为 `periodLabel`。Tooltip 使用自定义内容，展示周期标签与真实快照时间。

## 数据流

```text
API snapshots + snapshotValues + assets + rates
  -> DashboardPage state
  -> buildScaledTotalAssetSeries(scale)
  -> Recharts LineChart
```

切换尺度只改变前端派生数据，不触发网络请求。

## 错误处理

如果快照时间无法解析：

1. 不让页面崩溃。
2. 该快照不参与趋势聚合。
3. 其他总览数据继续按现有逻辑展示。

如果聚合后没有点，隐藏走势图，行为和当前 `chartData.length === 0` 保持一致。

## 测试策略

领域层测试优先覆盖：

1. 日尺度同一天多条快照只保留最后一条。
2. 周尺度按周一到周日分组。
3. 月、季、年尺度能正确生成 label 和排序。
4. 多币种汇率换算仍然用于趋势点。
5. 无快照时返回空数组。

页面层测试覆盖：

1. 总览页渲染 `日/周/月/季/年` 控件。
2. 点击尺度按钮后，图表数据使用聚合后的周期点。

## 验收标准

1. 总览页“总资产走势”右侧出现 `日/周/月/季/年` 控件。
2. 默认选中 `日`。
3. 同一天多条快照只在日视图显示一个点，取当天最后一条快照。
4. 周、月、季、年视图分别按周期末状态展示趋势。
5. 切换尺度不发起额外 API 请求。
6. Tooltip 能看到周期标签和实际快照时间。
7. 现有快照历史列表不受影响，仍展示每条快照。
