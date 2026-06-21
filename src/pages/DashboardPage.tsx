import { useState, useEffect } from 'react'
import { api } from '../api/client'
import {
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildTotalAssetSeries,
} from '../domain/snapshots'
import type { SnapshotTotal, AllocationItem, SnapshotComparison as SnapshotComparisonType, TotalAssetPoint } from '../domain/snapshots'
import { formatMoney } from '../domain/money'
import SnapshotComparison from '../components/SnapshotComparison'
import type { SnapshotValue } from '../types/finance'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import './DashboardPage.css'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState<SnapshotTotal | null>(null)
  const [allocation, setAllocation] = useState<AllocationItem[]>([])
  const [comparison, setComparison] = useState<SnapshotComparisonType | null>(null)
  const [chartData, setChartData] = useState<TotalAssetPoint[]>([])
  const [hasSnapshots, setHasSnapshots] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [assets, latestData, allSnapshots, allValues] = await Promise.all([
        api.getAssets(),
        api.getLatestSnapshot(),
        api.getSnapshots(),
        api.getSnapshotValues(),
      ])

      if (!latestData || latestData.values.length === 0) {
        setHasSnapshots(false)
        setLoading(false)
        return
      }

      setHasSnapshots(true)
      const activeAssets = assets.filter((a) => a.isActive)

      // Total and allocation from latest snapshot
      setTotal(calculateSnapshotTotal(latestData.values, activeAssets))
      setAllocation(calculateAllocation(latestData.values, activeAssets))

      // Build time series
      const sortedSnapshots = [...allSnapshots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      const valuesBySnapshot = new Map<string, SnapshotValue[]>()
      for (const v of allValues) {
        const list = valuesBySnapshot.get(v.snapshotId) || []
        list.push(v)
        valuesBySnapshot.set(v.snapshotId, list)
      }
      setChartData(buildTotalAssetSeries(sortedSnapshots, valuesBySnapshot, activeAssets))

      // Comparison: latest two snapshots
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

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) return <div className="page-error"><p>{error}</p><button onClick={load}>重试</button></div>

  if (!hasSnapshots) {
    return (
      <div className="dashboard-empty">
        <h1>总览</h1>
        <div className="empty-state">
          <p className="empty-icon">📊</p>
          <h2>欢迎使用资产快照账本</h2>
          <p>还没有快照数据。去<strong>录入</strong>页面创建你的第一份资产快照吧！</p>
          <p className="empty-hint">每次录入只需要填写本次变化的资产，未填写的资产会自动沿用上次的值。</p>
        </div>
      </div>
    )
  }

  const maxAllocAmount = Math.max(...allocation.map((a) => a.amount), 1)

  return (
    <div className="dashboard">
      <h1>总览</h1>

      {/* Summary cards */}
      <div className="dashboard-cards">
        <div className="dash-card">
          <div className="dash-card-label">总资产</div>
          <div className="dash-card-value">{total ? formatMoney(total.totalAmount) : '-'}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">投资类资产</div>
          <div className="dash-card-value">{total ? formatMoney(total.investmentAmount) : '-'}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">余额类资产</div>
          <div className="dash-card-value">{total ? formatMoney(total.balanceAmount) : '-'}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">投资类当前收益</div>
          <div className={`dash-card-value ${(total?.totalProfit || 0) >= 0 ? 'profit' : 'loss'}`}>
            {total ? ((total.totalProfit >= 0 ? '+' : '') + formatMoney(total.totalProfit)) : '-'}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Allocation */}
        <div className="dash-section">
          <h3>资产类别占比</h3>
          {allocation.length === 0 ? (
            <p className="tx-empty">暂无数据</p>
          ) : (
            <div className="allocation-bars">
              {allocation.map((item) => (
                <div key={item.type} className="allocation-row">
                  <div className="allocation-label">
                    <span>{item.label}</span>
                    <span>{formatMoney(item.amount)}</span>
                  </div>
                  <div className="allocation-bar-bg">
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

        {/* Comparison */}
        <div className="dash-section">
          <h3>最近变化</h3>
          <SnapshotComparison comparison={comparison} />
        </div>
      </div>

      {/* Total asset history chart */}
      {chartData.length > 0 && (
        <div className="dash-section">
          <h3>总资产走势</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="recordedAt" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v))} />
                <Tooltip
                  formatter={((value: any) => [formatMoney(Number(value))]) as any}
                />
                <Line type="monotone" dataKey="totalAmount" name="总资产" stroke="#4a90d9" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="investmentAmount" name="投资类" stroke="#52c41a" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="balanceAmount" name="余额类" stroke="#faad14" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
