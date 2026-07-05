import { useState, useEffect, useMemo } from 'react'
import { api } from '../api/client'
import {
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildScaledTotalAssetSeries,
} from '../domain/snapshots'
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
import type { Asset, Snapshot, SnapshotValue, ExchangeRates } from '../types/finance'
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
  return Number(value).toLocaleString('en-US', {
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
      <div className="trend-tooltip-row">
        <span>实际快照</span>
        <strong>{formatChartDateTime(point.recordedAt)}</strong>
      </div>
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
  const [hasSnapshots, setHasSnapshots] = useState(false)
  const [allSnapshots, setAllSnapshots] = useState<Snapshot[]>([])
  const [allValues, setAllValues] = useState<SnapshotValue[]>([])
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rates, setRates] = useState<ExchangeRates>({ USD: 7.2, HKD: 0.92, updatedAt: '' })
  const [editingRates, setEditingRates] = useState(false)
  const [usdRate, setUsdRate] = useState('7.2')
  const [hkdRate, setHkdRate] = useState('0.92')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [assets, latestData, snapshots, values, ratesData] = await Promise.all([
        api.getAssets(),
        api.getLatestSnapshot(),
        api.getSnapshots(),
        api.getSnapshotValues(),
        api.getRates(),
      ])

      setRates(ratesData)
      setUsdRate(String(ratesData.USD))
      setHkdRate(String(ratesData.HKD))
      setAllSnapshots(snapshots)
      setAllValues(values)
      setAllAssets(assets)

      if (!latestData || latestData.values.length === 0) {
        setHasSnapshots(false)
        setLoading(false)
        return
      }

      setHasSnapshots(true)
      const activeAssets = assets.filter((a) => a.isActive)

      setTotal(calculateSnapshotTotal(latestData.values, activeAssets, ratesData))
      setAllocation(calculateAllocation(latestData.values, activeAssets, ratesData))

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
        setComparison(compareSnapshots(activeAssets, previousValues, latestValues))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const activeAssetsForChart = useMemo(
    () => allAssets.filter((asset) => asset.isActive),
    [allAssets]
  )

  const chartValuesBySnapshot = useMemo(() => {
    const map = new Map<string, SnapshotValue[]>()
    for (const value of allValues) {
      const list = map.get(value.snapshotId) || []
      list.push(value)
      map.set(value.snapshotId, list)
    }
    return map
  }, [allValues])

  const chartData = useMemo(
    () =>
      buildScaledTotalAssetSeries(
        allSnapshots,
        chartValuesBySnapshot,
        activeAssetsForChart,
        trendScale,
        rates
      ),
    [allSnapshots, chartValuesBySnapshot, activeAssetsForChart, trendScale, rates]
  )

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
    const activeAssetIds = new Set(allAssets.filter((a) => a.isActive).map((a) => a.id))
    return allValues
      .filter((v) => v.snapshotId === snapshotId && activeAssetIds.has(v.assetId))
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

  return (
    <div className="dashboard">
      <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginBottom: 16 }}>
        总览
      </h1>

      {/* Compact stat bar */}
      <div className="dash-stat-bar">
        <div className="dash-stat-item">
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

      {/* Exchange rates */}
      <div className="rates-bar">
        {editingRates ? (
          <>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>汇率:</span>
            <label>
              USD{' '}
              <input
                type="number"
                step="0.01"
                value={usdRate}
                onChange={(e) => setUsdRate(e.target.value)}
                className="rates-input"
              />
            </label>
            <label>
              HKD{' '}
              <input
                type="number"
                step="0.01"
                value={hkdRate}
                onChange={(e) => setHkdRate(e.target.value)}
                className="rates-input"
              />
            </label>
            <button
              className="btn-link"
              onClick={async () => {
                await api.updateRates({ USD: Number(usdRate), HKD: Number(hkdRate) })
                setEditingRates(false)
                load()
              }}
            >
              保存
            </button>
            <button className="btn-link" onClick={() => setEditingRates(false)}>
              取消
            </button>
          </>
        ) : (
          <span
            onClick={() => setEditingRates(true)}
            style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-text-muted)' }}
          >
            汇率: USD {rates.USD.toFixed(2)} | HKD {rates.HKD.toFixed(2)}{' '}
            <span style={{ color: 'var(--color-primary)', fontSize: 11 }}>修改</span>
          </span>
        )}
      </div>

      <div className="dash-grid">
        {/* Allocation */}
        <div className="dash-section">
          <h3 className="section-title">资产类别占比</h3>
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
        </div>

        {/* Recent changes */}
        <div className="dash-section">
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
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="dash-section" style={{ marginTop: 16 }}>
          <div className="chart-section-head">
            <h3 className="section-title">总资产走势</h3>
            <div className="trend-scale-control" aria-label="走势图尺度">
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
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)
                  }
                />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  type="monotone"
                  dataKey="totalAmount"
                  name="总资产"
                  stroke="#2d5f7e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="investmentAmount"
                  name="投资类"
                  stroke="#3a7d5a"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="balanceAmount"
                  name="余额类"
                  stroke="#b8860b"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Snapshot History */}
      <div className="dash-section" style={{ marginTop: 16 }}>
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
                    <div className="history-item-main">
                      <span className="history-date">
                        {date.toLocaleDateString('zh-CN')}{' '}
                        {date.toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="history-note">{snap.note || '快照'}</span>
                    </div>
                    <div className="history-item-actions">
                      <MoneyDisplay value={snapTotal} />
                      <span className="history-count">{snapValues.length} 项</span>
                      <button
                        className="btn-delete-snapshot"
                        disabled={deletingId === snap.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(snap.id)
                        }}
                      >
                        {deletingId === snap.id ? '...' : '✕'}
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
      </div>
    </div>
  )
}
