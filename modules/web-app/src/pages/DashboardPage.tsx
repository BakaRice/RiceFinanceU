import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import {
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildScaledTotalAssetSeries,
} from '../domain/snapshots'
import {
  buildIncomeSeriesByScale,
  calculateIncomeRecordTotal,
  calculateRestrictedIncomeRecordTotal,
  calculateSpendableIncomeRecordTotal,
  getIncomeLineLabel,
} from '../domain/income'
import type {
  SnapshotTotal,
  AllocationItem,
  SnapshotComparison as SnapshotComparisonType,
  TotalAssetPoint,
  TrendScale,
} from '../domain/snapshots'
import { ASSET_TYPE_LABELS } from '../domain/assets'
import MoneyDisplay from '../components/MoneyDisplay'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import type { Asset, Snapshot, SnapshotValue, ExchangeRates, IncomeCategory, IncomeRecord } from '../types/finance'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import './DashboardPage.css'

const TREND_SCALE_OPTIONS: Array<{ value: TrendScale; label: string }> = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季' },
  { value: 'year', label: '年' },
]

type IncomeTrendPoint = {
  periodKey: string
  periodLabel: string
  incomeAmount?: number
}

function formatChartDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatChartMoney(value: unknown): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null

  const point = payload[0].payload as TotalAssetPoint

  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-row">
        <span>周期</span>
        <strong>{label}</strong>
      </div>
      {point.recordedAt && (
        <div className="trend-tooltip-row">
          <span>实际快照</span>
          <strong>{formatChartDateTime(point.recordedAt)}</strong>
        </div>
      )}
      {payload.map((item: any) => (
        <div key={item.dataKey} className="trend-tooltip-row">
          <span>{item.name}</span>
          <strong>{formatChartMoney(item.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { toast, confirm } = useFeedback()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<SnapshotTotal | null>(null)
  const [allocation, setAllocation] = useState<AllocationItem[]>([])
  const [comparison, setComparison] = useState<SnapshotComparisonType | null>(null)
  const [trendScale, setTrendScale] = useState<TrendScale>('day')
  const [incomeTrendScale, setIncomeTrendScale] = useState<TrendScale>('month')
  const [hasSnapshots, setHasSnapshots] = useState(false)
  const [allSnapshots, setAllSnapshots] = useState<Snapshot[]>([])
  const [allValues, setAllValues] = useState<SnapshotValue[]>([])
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rates, setRates] = useState<ExchangeRates>({ USD: 7.2, HKD: 0.92, updatedAt: '' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [assets, latestData, snapshots, values, incomeData, ratesData] = await Promise.all([
        api.getAssets(),
        api.getLatestSnapshot(),
        api.getSnapshots(),
        api.getSnapshotValues(),
        api.getIncomeRecords(),
        api.getRates(),
      ])

      setRates(ratesData)
      setAllSnapshots(snapshots)
      setAllValues(values)
      setAllAssets(assets)
      setIncomeRecords(incomeData)

      if (!latestData || latestData.values.length === 0) {
        setHasSnapshots(false)
        setLoading(false)
        return
      }

      setHasSnapshots(true)
      setTotal(calculateSnapshotTotal(latestData.values, assets, ratesData))
      setAllocation(calculateAllocation(latestData.values, assets, ratesData))

      const sortedSnapshots = [...snapshots].sort((a, b) =>
        a.recordedAt.localeCompare(b.recordedAt)
      )
      const valuesBySnapshot = new Map<string, SnapshotValue[]>()
      for (const v of values) {
        const list = valuesBySnapshot.get(v.snapshotId) || []
        list.push(v)
        valuesBySnapshot.set(v.snapshotId, list)
      }
      if (sortedSnapshots.length >= 2) {
        const latest = sortedSnapshots[sortedSnapshots.length - 1]
        const previous = sortedSnapshots[sortedSnapshots.length - 2]
        const latestValues = valuesBySnapshot.get(latest.id) || []
        const previousValues = valuesBySnapshot.get(previous.id) || []
        setComparison(compareSnapshots(assets, previousValues, latestValues))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const ledgerAssetsForChart = allAssets

  const chartValuesBySnapshot = useMemo(() => {
    const map = new Map<string, SnapshotValue[]>()
    for (const value of allValues) {
      const list = map.get(value.snapshotId) || []
      list.push(value)
      map.set(value.snapshotId, list)
    }
    return map
  }, [allValues])

  const assetChartData = useMemo<TotalAssetPoint[]>(() => (
    buildScaledTotalAssetSeries(
      allSnapshots,
      chartValuesBySnapshot,
      ledgerAssetsForChart,
      trendScale,
      rates,
    )
  ), [allSnapshots, chartValuesBySnapshot, ledgerAssetsForChart, trendScale, rates])

  const incomeChartData = useMemo<IncomeTrendPoint[]>(() => (
    [...buildIncomeSeriesByScale(incomeRecords, incomeTrendScale).entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([periodKey, incomeAmount]) => ({
        periodKey,
        periodLabel: periodKey,
        incomeAmount,
      }))
  ), [incomeRecords, incomeTrendScale])

  const latestIncomeRecord = useMemo(
    () => [...incomeRecords].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0],
    [incomeRecords],
  )
  const latestIncomeMonth = latestIncomeRecord?.occurredAt.slice(0, 7)
  const latestMonthIncomeRecords = useMemo(
    () => latestIncomeMonth
      ? incomeRecords.filter((income) => income.occurredAt.slice(0, 7) === latestIncomeMonth)
      : [],
    [incomeRecords, latestIncomeMonth],
  )
  const latestIncomeTotal = latestMonthIncomeRecords.length > 0
    ? calculateIncomeRecordTotal(latestMonthIncomeRecords)
    : undefined
  const latestSpendableIncomeTotal = latestMonthIncomeRecords.length > 0
    ? calculateSpendableIncomeRecordTotal(latestMonthIncomeRecords)
    : undefined
  const latestRestrictedIncomeTotal = latestMonthIncomeRecords.length > 0
    ? calculateRestrictedIncomeRecordTotal(latestMonthIncomeRecords)
    : undefined
  const latestMonthIncomeByCategory = useMemo(() => {
    const totals = new Map<IncomeCategory, number>()
    for (const income of latestMonthIncomeRecords) {
      totals.set(income.category, (totals.get(income.category) || 0) + income.amount)
    }
    return totals
  }, [latestMonthIncomeRecords])
  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '删除快照',
      message: '确定删除这个快照吗？快照下的所有资产值也会被删除。',
      confirmLabel: '删除',
      cancelLabel: '取消',
      variant: 'danger',
    })
    if (!ok) return
    setDeletingId(id)
    try {
      await api.deleteSnapshot(id)
      toast('快照已删除')
      await load()
    } catch (e: any) {
      toast('删除失败: ' + e.message, 'error')
    } finally {
      setDeletingId(null)
    }
  }

  function getSnapshotValues(snapshotId: string): SnapshotValue[] {
    return allValues.filter((v) => v.snapshotId === snapshotId)
  }

  function getSnapshotTotalCNY(snapshotId: string): number {
    const assetIds = new Set(allAssets.map((asset) => asset.id))
    return allValues
      .filter((v) => v.snapshotId === snapshotId && assetIds.has(v.assetId))
      .reduce((sum, v) => {
        const asset = allAssets.find((a) => a.id === v.assetId)
        const factor =
          asset?.currency === 'USD'
            ? rates.USD
            : asset?.currency === 'HKD'
              ? rates.HKD
              : 1
        return sum + v.amount * factor
      }, 0)
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error)
    return (
      <div className="page-error">
        <p>{error}</p>
        <button onClick={load}>重试</button>
      </div>
    )

  if (!hasSnapshots) {
    return (
      <div className="dash-empty">
        <h1>总览</h1>
        <div className="empty-state">
          <h2>欢迎使用资产快照账本</h2>
          <p>
            还没有快照数据。去<strong>录入</strong>页面创建你的第一份资产快照。
          </p>
          <p className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
            每次录入只需填写本次变化的资产，未填写的资产会自动沿用上次的值。
          </p>
        </div>
      </div>
    )
  }

  const maxAllocAmount = Math.max(...allocation.map((a) => a.amount), 1)
  const historySnapshots = [...allSnapshots].sort((a, b) =>
    b.recordedAt.localeCompare(a.recordedAt)
  )
  const latestSnapshotTime = historySnapshots[0]
    ? formatChartDateTime(historySnapshots[0].recordedAt)
    : '-'

  return (
    <div className="dashboard">
      <header className="page-header dashboard-header">
        <div className="page-heading">
          <h1 className="page-title">资产总览</h1>
          <p className="page-subtitle">截至最近快照 · {latestSnapshotTime}</p>
        </div>
        <div className="dashboard-tools">
          <span className="dashboard-mode">CNY 综合视图</span>
          <div className="rates-bar">
            <Link className="rates-trigger" to="/rates">
              汇率 · USD {rates.USD.toFixed(2)} · HKD {rates.HKD.toFixed(2)}
            </Link>
          </div>
        </div>
      </header>

      {/* Compact stat bar */}
      <div className="dash-stat-bar">
        <div className="dash-stat-item dash-stat-primary">
          <span className="dash-stat-label">总资产 (CNY)</span>
          <MoneyDisplay value={total?.totalAmountCNY} />
        </div>
        {comparison && (
          <div className="dash-stat-item">
            <span className="dash-stat-label">较上次变化</span>
            <MoneyDisplay value={comparison.totalAmountChange} isProfit />
          </div>
        )}
        <div className="dash-stat-item">
          <span className="dash-stat-label">投资类</span>
          <MoneyDisplay value={total?.investmentAmountCNY} />
        </div>
        <div className="dash-stat-item">
          <span className="dash-stat-label">余额类</span>
          <MoneyDisplay value={total?.balanceAmountCNY} />
        </div>
        <div className="dash-stat-item">
          <span className="dash-stat-label">投资收益</span>
          <MoneyDisplay value={total?.totalProfitCNY} isProfit />
        </div>
      </div>

      {assetChartData.length > 0 && (
        <div className="dashboard-trend-row" data-testid="dashboard-trend-row">
        <section className="dash-section dashboard-trend" data-testid="asset-trend-panel">
          <div className="chart-section-head">
            <h3 className="section-title">总资产走势</h3>
            <div className="trend-scale-control segmented-control" aria-label="总资产走势图尺度">
              {TREND_SCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`trend-scale-btn ${trendScale === option.value ? 'active' : ''}`}
                  aria-pressed={trendScale === option.value}
                  onClick={() => setTrendScale(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={assetChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="asset"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)
                  }
                />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  yAxisId="asset"
                  type="monotone"
                  dataKey="totalAmount"
                  name="总资产"
                  stroke="var(--chart-total)"
                  strokeWidth={2.6}
                  dot={{ r: 2.5 }}
                />
                <Line
                  yAxisId="asset"
                  type="monotone"
                  dataKey="investmentAmount"
                  name="投资类"
                  stroke="var(--chart-investment)"
                  strokeWidth={1.6}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line
                  yAxisId="asset"
                  type="monotone"
                  dataKey="balanceAmount"
                  name="余额类"
                  stroke="var(--chart-balance)"
                  strokeWidth={1.6}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="dash-section dashboard-trend" data-testid="income-trend-panel">
          <div className="chart-section-head">
            <h3 className="section-title">收入走势</h3>
            <div className="trend-scale-control segmented-control" aria-label="收入走势图尺度">
              {TREND_SCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`trend-scale-btn ${incomeTrendScale === option.value ? 'active' : ''}`}
                  aria-pressed={incomeTrendScale === option.value}
                  onClick={() => setIncomeTrendScale(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={incomeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="income"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)
                  }
                />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  yAxisId="income"
                  type="monotone"
                  dataKey="incomeAmount"
                  name={getIncomeLineLabel(incomeTrendScale)}
                  stroke="var(--chart-income)"
                  strokeWidth={2.4}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        </div>
      )}

      <div className="dashboard-paired-row dashboard-flow-row" data-testid="flow-structure-row">
      <section className="dash-section income-section dashboard-income">
        <div className="income-section-head">
          <div>
            <h3 className="section-title">收入流入</h3>
            <p className="income-section-subtitle">
              {latestIncomeRecord
                ? `${latestIncomeMonth} 税后收入 · 最近一笔 ${latestIncomeRecord.occurredAt}`
                : '暂无收入记录'}
            </p>
          </div>
          <div className="income-section-actions">
            <Link className="btn-link" to="/income">
              查看收入明细
            </Link>
          </div>
        </div>
        <div className="income-summary-grid">
          <div className="income-summary-main">
            <span className="dash-stat-label">最近月可支配</span>
            <MoneyDisplay value={latestSpendableIncomeTotal} />
          </div>
          <div className="income-summary-item">
            <span>最近月总流入</span>
            <MoneyDisplay value={latestIncomeTotal} showCurrency={false} />
          </div>
          <div className="income-summary-item income-summary-restricted">
            <span className="income-summary-item-head">
              <span>受限流入</span>
              <span className="income-availability-badge">不可支配</span>
            </span>
            <MoneyDisplay value={latestRestrictedIncomeTotal} showCurrency={false} />
          </div>
          <div className="income-summary-item">
            <span>工资</span>
            <MoneyDisplay value={latestMonthIncomeByCategory.get('salary')} showCurrency={false} />
          </div>
          <div className="income-summary-item">
            <span>奖金</span>
            <MoneyDisplay value={latestMonthIncomeByCategory.get('bonus')} showCurrency={false} />
          </div>
          <div className="income-summary-item">
            <span>副业/额外</span>
            <MoneyDisplay value={latestMonthIncomeByCategory.get('side_income')} showCurrency={false} />
          </div>
          <div className="income-summary-item">
            <span>投资/其他</span>
            <MoneyDisplay
              value={
                latestMonthIncomeByCategory.get('investment') !== undefined ||
                latestMonthIncomeByCategory.get('other') !== undefined
                  ? (latestMonthIncomeByCategory.get('investment') || 0) +
                    (latestMonthIncomeByCategory.get('other') || 0)
                  : undefined
              }
              showCurrency={false}
            />
          </div>
        </div>
      </section>

      <section className="dash-section dashboard-allocation">
        <h3 className="section-title">资产结构</h3>
        {allocation.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', padding: 20 }}>
            暂无数据
          </p>
        ) : (
          <div className="allocation-list">
            {allocation.map((item) => (
              <div key={item.type} className="allocation-row">
                <div className="allocation-head">
                  <span className="allocation-type">{item.label}</span>
                  <span className="allocation-amount">
                    <MoneyDisplay value={item.amount} showCurrency={false} />
                  </span>
                </div>
                <div className="allocation-bar-track">
                  <div
                    className="allocation-bar-fill"
                    style={{ width: `${(item.amount / maxAllocAmount) * 100}%` }}
                  />
                </div>
                <span className="allocation-pct">{item.percentage}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>

      {/* Snapshot History */}
      <div className="dashboard-paired-row dashboard-activity-row" data-testid="snapshot-change-row">
      <section className="dash-section dashboard-history">
        <h3 className="section-title">快照历史 ({historySnapshots.length})</h3>
        {historySnapshots.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', padding: 20 }}>
            暂无记录
          </p>
        ) : (
          <div className="history-list">
            {historySnapshots.map((snap) => {
              const snapValues = getSnapshotValues(snap.id)
              const snapTotal = getSnapshotTotalCNY(snap.id)
              const isExpanded = expandedId === snap.id
              const date = new Date(snap.recordedAt)

              return (
                <div
                  key={snap.id}
                  className={`history-item ${isExpanded ? 'expanded' : ''}`}
                >
                  <div
                    className="history-item-header"
                    onClick={() => setExpandedId(isExpanded ? null : snap.id)}
                  >
                    <span className="history-date">
                      {date.toLocaleDateString('zh-CN')}{' '}
                      {date.toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="history-note">{snap.note || '快照'}</span>
                    <div className="history-item-actions">
                      <MoneyDisplay value={snapTotal} />
                      <span className="history-count">{snapValues.length} 项</span>
                      <button
                        className="btn-delete-snapshot row-menu-button"
                        disabled={deletingId === snap.id}
                        aria-label={`删除 ${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })} 的快照`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(snap.id)
                        }}
                      >
                        {deletingId === snap.id ? '删除中' : '删除'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="history-item-detail">
                      <table className="fin-table">
                        <thead>
                          <tr>
                            <th>资产</th>
                            <th>类型</th>
                            <th className="align-right">金额</th>
                            <th className="align-right">收益</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snapValues.map((v) => {
                            const asset = allAssets.find((a) => a.id === v.assetId)
                            return (
                              <tr key={v.id}>
                                <td>{asset?.name || v.assetId}</td>
                                <td>
                                  <span className="type-badge">
                                    {ASSET_TYPE_LABELS[
                                      asset?.type as keyof typeof ASSET_TYPE_LABELS
                                    ] || asset?.type || '-'}
                                  </span>
                                </td>
                                <td className="align-right">
                                  <MoneyDisplay
                                    value={v.amount}
                                    currency={asset?.currency}
                                    showCurrency={false}
                                  />
                                </td>
                                <td className="align-right">
                                  <MoneyDisplay value={v.profit} isProfit />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="dash-section dashboard-changes">
        <h3 className="section-title">最近变化</h3>
        {comparison && comparison.items.filter((i) => i.amountChange !== 0).length > 0 ? (
          <table className="fin-table">
            <thead>
              <tr>
                <th>资产</th>
                <th className="align-right">上次金额</th>
                <th className="align-right">本次金额</th>
                <th className="align-right">变化</th>
              </tr>
            </thead>
            <tbody>
              {comparison.items
                .filter((i) => i.amountChange !== 0)
                .slice(0, 10)
                .map((item) => {
                  const asset = allAssets.find((a) => a.id === item.assetId)
                  return (
                    <tr key={item.assetId}>
                      <td>{item.assetName}</td>
                      <td className="align-right">
                        <MoneyDisplay
                          value={item.previousAmount}
                          currency={asset?.currency}
                          showCurrency={false}
                        />
                      </td>
                      <td className="align-right">
                        <MoneyDisplay
                          value={item.currentAmount}
                          currency={asset?.currency}
                          showCurrency={false}
                        />
                      </td>
                      <td className="align-right">
                        <MoneyDisplay value={item.amountChange} isProfit showCurrency={false} />
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        ) : (
          <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', padding: 20 }}>
            暂无变化
          </p>
        )}
      </section>
      </div>
    </div>
  )
}
