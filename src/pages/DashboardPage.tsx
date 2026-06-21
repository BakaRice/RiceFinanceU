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
import { ASSET_TYPE_LABELS } from '../domain/assets'
import SnapshotComparison from '../components/SnapshotComparison'
import type { Asset, Snapshot, SnapshotValue, ExchangeRates } from '../types/finance'
import { CURRENCY_SYMBOLS } from '../types/finance'
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
  // History
  const [allSnapshots, setAllSnapshots] = useState<Snapshot[]>([])
  const [allValues, setAllValues] = useState<SnapshotValue[]>([])
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rates, setRates] = useState<ExchangeRates>({ USD: 7.2, HKD: 0.92, updatedAt: '' })
  const [editingRates, setEditingRates] = useState(false)
  const [usdRate, setUsdRate] = useState('7.2')
  const [hkdRate, setHkdRate] = useState('0.92')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
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

      const sortedSnapshots = [...snapshots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      const valuesBySnapshot = new Map<string, SnapshotValue[]>()
      for (const v of values) {
        const list = valuesBySnapshot.get(v.snapshotId) || []
        list.push(v)
        valuesBySnapshot.set(v.snapshotId, list)
      }
      setChartData(buildTotalAssetSeries(sortedSnapshots, valuesBySnapshot, activeAssets, ratesData))

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

  async function handleDelete(id: string) {
    if (!confirm('确定删除这个快照吗？快照下的所有资产值也会被删除。')) return
    setDeletingId(id)
    try {
      await api.deleteSnapshot(id)
      await load()
    } catch (e: any) {
      alert('删除失败: ' + e.message)
    } finally {
      setDeletingId(null)
    }
  }

  function getSnapshotTotal(snapshotId: string): number {
    const activeAssetIds = new Set(allAssets.filter((a) => a.isActive).map((a) => a.id))
    return allValues
      .filter((v) => v.snapshotId === snapshotId && activeAssetIds.has(v.assetId))
      .reduce((sum, v) => sum + v.amount, 0)
  }

  function getSnapshotValues(snapshotId: string): SnapshotValue[] {
    return allValues.filter((v) => v.snapshotId === snapshotId)
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
  // Reverse chronological for history display
  const historySnapshots = [...allSnapshots].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))

  return (
    <div className="dashboard">
      <h1>总览</h1>

      <div className="dashboard-cards">
        <div className="dash-card">
          <div className="dash-card-label">总资产 (折合CNY)</div>
          <div className="dash-card-value">{total ? formatMoney(total.totalAmountCNY) : '-'}</div>
          {total && total.byCurrency.length > 1 && (
            <div className="dash-card-sub">
              {total.byCurrency.map((bc) => (
                <span key={bc.currency}>{CURRENCY_SYMBOLS[bc.currency as keyof typeof CURRENCY_SYMBOLS] || bc.currency}{formatMoney(bc.amount)}</span>
              ))}
            </div>
          )}
        </div>
        <div className="dash-card">
          <div className="dash-card-label">投资类 (折合CNY)</div>
          <div className="dash-card-value">{total ? formatMoney(total.investmentAmountCNY) : '-'}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">余额类 (折合CNY)</div>
          <div className="dash-card-value">{total ? formatMoney(total.balanceAmountCNY) : '-'}</div>
        </div>
        <div className="dash-card">
          <div className="dash-card-label">投资收益 (折合CNY)</div>
          <div className={`dash-card-value ${(total?.totalProfitCNY || 0) >= 0 ? 'profit' : 'loss'}`}>
            {total ? ((total.totalProfitCNY >= 0 ? '+' : '') + formatMoney(total.totalProfitCNY)) : '-'}
          </div>
        </div>
      </div>

      {/* Exchange rates */}
      <div className="rates-bar">
        {editingRates ? (
          <>
            <span>汇率: </span>
            <label>USD <input type="number" step="0.01" value={usdRate} onChange={(e) => setUsdRate(e.target.value)} style={{width:70}} /></label>
            <label>HKD <input type="number" step="0.01" value={hkdRate} onChange={(e) => setHkdRate(e.target.value)} style={{width:70}} /></label>
            <button className="btn-link" onClick={async () => {
              await api.updateRates({ USD: Number(usdRate), HKD: Number(hkdRate) })
              setEditingRates(false)
              load()
            }}>保存</button>
            <button className="btn-link" onClick={() => setEditingRates(false)}>取消</button>
          </>
        ) : (
          <span onClick={() => setEditingRates(true)} style={{cursor:'pointer'}}>
            汇率: USD {rates.USD} | HKD {rates.HKD} <span style={{color:'#4a90d9',fontSize:12}}>修改</span>
          </span>
        )}
      </div>

      <div className="dashboard-grid">
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
                    <div className="allocation-bar-fill" style={{ width: `${(item.amount / maxAllocAmount) * 100}%` }} />
                  </div>
                  <span className="allocation-pct">{item.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dash-section">
          <h3>最近变化</h3>
          <SnapshotComparison comparison={comparison} />
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="dash-section">
          <h3>总资产走势</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="recordedAt" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v))} />
                <Tooltip formatter={((value: any) => [formatMoney(Number(value))]) as any} />
                <Line type="monotone" dataKey="totalAmount" name="总资产" stroke="#4a90d9" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="investmentAmount" name="投资类" stroke="#52c41a" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <Line type="monotone" dataKey="balanceAmount" name="余额类" stroke="#faad14" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Snapshot History */}
      <div className="dash-section">
        <h3>快照历史 ({historySnapshots.length})</h3>
        {historySnapshots.length === 0 ? (
          <p className="tx-empty">暂无记录</p>
        ) : (
          <div className="history-list">
            {historySnapshots.map((snap) => {
              const snapValues = getSnapshotValues(snap.id)
              const snapTotal = getSnapshotTotal(snap.id)
              const isExpanded = expandedId === snap.id
              const date = new Date(snap.recordedAt)

              return (
                <div key={snap.id} className={`history-item ${isExpanded ? 'expanded' : ''}`}>
                  <div className="history-item-header" onClick={() => setExpandedId(isExpanded ? null : snap.id)}>
                    <div className="history-item-main">
                      <span className="history-date">
                        {date.toLocaleDateString('zh-CN')} {date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="history-note">{snap.note || '快照'}</span>
                    </div>
                    <div className="history-item-actions">
                      <span className="history-total">{formatMoney(snapTotal)}</span>
                      <span className="history-count">{snapValues.length} 项</span>
                      <button
                        className="btn-delete-snapshot"
                        disabled={deletingId === snap.id}
                        onClick={(e) => { e.stopPropagation(); handleDelete(snap.id) }}
                      >
                        {deletingId === snap.id ? '...' : '✕'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="history-item-detail">
                      <table className="history-value-table">
                        <thead><tr><th>资产</th><th>类型</th><th>金额</th><th>收益</th></tr></thead>
                        <tbody>
                          {snapValues.map((v) => {
                            const asset = allAssets.find((a) => a.id === v.assetId)
                            return (
                              <tr key={v.id}>
                                <td>{asset?.name || v.assetId}</td>
                                <td><span className="type-badge">{ASSET_TYPE_LABELS[asset?.type as keyof typeof ASSET_TYPE_LABELS] || asset?.type || '-'}</span></td>
                                <td className="amount-cell">{formatMoney(v.amount)}</td>
                                <td className={`amount-cell ${(v.profit || 0) >= 0 ? 'profit' : 'loss'}`}>
                                  {v.profit !== undefined ? ((v.profit >= 0 ? '+' : '') + formatMoney(v.profit)) : '-'}
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
