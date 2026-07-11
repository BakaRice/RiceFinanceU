import { useState, useEffect, useMemo } from 'react'
import { api } from '../api/client'
import {
  calculateSnapshotTotal,
  calculateAllocation,
  compareSnapshots,
  buildScaledTotalAssetSeries,
} from '../domain/snapshots'
import {
  buildIncomeSeriesByScale,
  calculateMonthlyIncomeTotal,
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
import type { Asset, Snapshot, SnapshotValue, ExchangeRates, MonthlyIncome } from '../types/finance'
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

type DashboardTrendPoint = TotalAssetPoint & {
  incomeAmount?: number
}

type IncomeFormState = {
  id?: string
  month: string
  salary: string
  extraIncome: string
  housingFund: string
  otherIncome: string
  note: string
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

function createEmptyIncomeForm(month = formatMonthKey(new Date())): IncomeFormState {
  return {
    month,
    salary: '0',
    extraIncome: '0',
    housingFund: '0',
    otherIncome: '0',
    note: '',
  }
}

function incomeToForm(income: MonthlyIncome): IncomeFormState {
  return {
    id: income.id,
    month: income.month,
    salary: String(income.salary),
    extraIncome: String(income.extraIncome),
    housingFund: String(income.housingFund),
    otherIncome: String(income.otherIncome),
    note: income.note || '',
  }
}

function parseIncomeAmount(value: string): number | null {
  if (value.trim() === '') return 0
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100) / 100
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

  const point = payload[0].payload as DashboardTrendPoint

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
  const [hasSnapshots, setHasSnapshots] = useState(false)
  const [allSnapshots, setAllSnapshots] = useState<Snapshot[]>([])
  const [allValues, setAllValues] = useState<SnapshotValue[]>([])
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const [monthlyIncomes, setMonthlyIncomes] = useState<MonthlyIncome[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [incomeFormOpen, setIncomeFormOpen] = useState(false)
  const [incomeSaving, setIncomeSaving] = useState(false)
  const [incomeDeleting, setIncomeDeleting] = useState(false)
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(() => createEmptyIncomeForm())
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
      const [assets, latestData, snapshots, values, incomeData, ratesData] = await Promise.all([
        api.getAssets(),
        api.getLatestSnapshot(),
        api.getSnapshots(),
        api.getSnapshotValues(),
        api.getMonthlyIncomes(),
        api.getRates(),
      ])

      setRates(ratesData)
      setUsdRate(String(ratesData.USD))
      setHkdRate(String(ratesData.HKD))
      setAllSnapshots(snapshots)
      setAllValues(values)
      setAllAssets(assets)
      setMonthlyIncomes(incomeData)

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

  const chartData = useMemo<DashboardTrendPoint[]>(() => {
    const assetSeries = buildScaledTotalAssetSeries(
      allSnapshots,
      chartValuesBySnapshot,
      activeAssetsForChart,
      trendScale,
      rates,
    )
    const incomeSeries = buildIncomeSeriesByScale(monthlyIncomes, trendScale)

    return assetSeries.map((point) => ({
      ...point,
      incomeAmount: incomeSeries.get(point.periodKey),
    }))
  }, [allSnapshots, chartValuesBySnapshot, activeAssetsForChart, trendScale, rates, monthlyIncomes])

  const currentMonth = useMemo(() => formatMonthKey(new Date()), [])
  const currentMonthIncome = useMemo(
    () => monthlyIncomes.find((income) => income.month === currentMonth),
    [monthlyIncomes, currentMonth],
  )
  const latestIncome = useMemo(
    () => [...monthlyIncomes].sort((a, b) => b.month.localeCompare(a.month))[0],
    [monthlyIncomes],
  )
  const latestIncomeTotal = latestIncome ? calculateMonthlyIncomeTotal(latestIncome) : undefined
  const shouldShowIncomeLine =
    trendScale !== 'day' &&
    trendScale !== 'week' &&
    chartData.some((point) => point.incomeAmount !== undefined)

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

  function updateIncomeFormField(key: keyof IncomeFormState, value: string) {
    setIncomeForm((form) => ({ ...form, [key]: value }))
  }

  function openIncomeForm() {
    setIncomeForm(
      currentMonthIncome ? incomeToForm(currentMonthIncome) : createEmptyIncomeForm(currentMonth),
    )
    setIncomeFormOpen(true)
  }

  async function handleSaveIncome(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const salary = parseIncomeAmount(incomeForm.salary)
    const extraIncome = parseIncomeAmount(incomeForm.extraIncome)
    const housingFund = parseIncomeAmount(incomeForm.housingFund)
    const otherIncome = parseIncomeAmount(incomeForm.otherIncome)

    if ([salary, extraIncome, housingFund, otherIncome].some((value) => value === null)) {
      toast('收入金额必须是大于等于 0 的数字', 'error')
      return
    }

    setIncomeSaving(true)
    try {
      const payload = {
        month: incomeForm.month,
        salary: salary as number,
        extraIncome: extraIncome as number,
        housingFund: housingFund as number,
        otherIncome: otherIncome as number,
        ...(incomeForm.note.trim() ? { note: incomeForm.note.trim() } : {}),
      }

      if (incomeForm.id) {
        await api.updateMonthlyIncome(incomeForm.id, payload)
        toast('月收入已更新')
      } else {
        await api.createMonthlyIncome(payload)
        toast('月收入已记录')
      }

      setIncomeFormOpen(false)
      await load()
    } catch (e: any) {
      toast('保存月收入失败: ' + e.message, 'error')
    } finally {
      setIncomeSaving(false)
    }
  }

  async function handleDeleteIncome() {
    if (!incomeForm.id) return

    const ok = await confirm({
      title: '删除月收入',
      message: `确定删除 ${incomeForm.month} 的收入记录吗？`,
      confirmLabel: '删除',
      cancelLabel: '取消',
      variant: 'danger',
    })
    if (!ok) return

    setIncomeDeleting(true)
    try {
      await api.deleteMonthlyIncome(incomeForm.id)
      toast('月收入已删除')
      setIncomeFormOpen(false)
      await load()
    } catch (e: any) {
      toast('删除月收入失败: ' + e.message, 'error')
    } finally {
      setIncomeDeleting(false)
    }
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
        <span className="dashboard-mode">CNY 综合视图</span>
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

      <div className="dash-section income-section dashboard-income">
        <div className="income-section-head">
          <div>
            <h3 className="section-title">月收入</h3>
            <p className="income-section-subtitle">
              {latestIncome ? `${latestIncome.month} 收入汇总` : '暂无收入记录'}
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={openIncomeForm}>
            {currentMonthIncome ? '编辑本月收入' : '记录本月收入'}
          </button>
        </div>
        <div className="income-summary-grid">
          <div className="income-summary-main">
            <span className="dash-stat-label">最近月收入</span>
            <MoneyDisplay value={latestIncomeTotal} />
          </div>
          <div className="income-summary-item">
            <span>工资</span>
            <MoneyDisplay value={latestIncome?.salary} showCurrency={false} />
          </div>
          <div className="income-summary-item">
            <span>额外收入</span>
            <MoneyDisplay value={latestIncome?.extraIncome} showCurrency={false} />
          </div>
          <div className="income-summary-item">
            <span>公积金</span>
            <MoneyDisplay value={latestIncome?.housingFund} showCurrency={false} />
          </div>
          <div className="income-summary-item">
            <span>其他收入</span>
            <MoneyDisplay value={latestIncome?.otherIncome} showCurrency={false} />
          </div>
        </div>
      </div>

      {incomeFormOpen && (
        <div className="modal-overlay" onClick={() => setIncomeFormOpen(false)}>
          <form
            className="modal income-modal"
            onSubmit={handleSaveIncome}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="income-modal-head">
              <h2>{incomeForm.id ? '编辑月收入' : '记录月收入'}</h2>
              <button type="button" className="btn-link" onClick={() => setIncomeFormOpen(false)}>
                关闭
              </button>
            </div>
            <div className="income-form-grid">
              <label className="income-form-field" htmlFor="income-month">
                <span>月份</span>
                <input
                  id="income-month"
                  type="month"
                  value={incomeForm.month}
                  onChange={(e) => updateIncomeFormField('month', e.target.value)}
                  required
                />
              </label>
              <label className="income-form-field" htmlFor="income-salary">
                <span>工资</span>
                <input
                  id="income-salary"
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeForm.salary}
                  onChange={(e) => updateIncomeFormField('salary', e.target.value)}
                />
              </label>
              <label className="income-form-field" htmlFor="income-extra">
                <span>额外收入</span>
                <input
                  id="income-extra"
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeForm.extraIncome}
                  onChange={(e) => updateIncomeFormField('extraIncome', e.target.value)}
                />
              </label>
              <label className="income-form-field" htmlFor="income-housing-fund">
                <span>公积金</span>
                <input
                  id="income-housing-fund"
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeForm.housingFund}
                  onChange={(e) => updateIncomeFormField('housingFund', e.target.value)}
                />
              </label>
              <label className="income-form-field" htmlFor="income-other">
                <span>其他收入</span>
                <input
                  id="income-other"
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeForm.otherIncome}
                  onChange={(e) => updateIncomeFormField('otherIncome', e.target.value)}
                />
              </label>
              <label className="income-form-field income-form-field-full" htmlFor="income-note">
                <span>备注</span>
                <input
                  id="income-note"
                  type="text"
                  value={incomeForm.note}
                  onChange={(e) => updateIncomeFormField('note', e.target.value)}
                />
              </label>
            </div>
            <div className="income-modal-actions">
              {incomeForm.id && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={handleDeleteIncome}
                  disabled={incomeDeleting || incomeSaving}
                >
                  {incomeDeleting ? '删除中...' : '删除收入'}
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={() => setIncomeFormOpen(false)}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={incomeSaving}>
                {incomeSaving ? '保存中...' : '保存收入'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="dash-grid dashboard-insights">
        {/* Allocation */}
        <div className="dash-section">
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
        <div className="dash-section dashboard-trend">
          <div className="chart-section-head">
            <h3 className="section-title">总资产走势</h3>
            <div className="trend-scale-control segmented-control" aria-label="走势图尺度">
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
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0ed" vertical={false} />
                <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="asset"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)
                  }
                />
                {shouldShowIncomeLine && (
                  <YAxis
                    yAxisId="income"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      v >= 10000 ? `${(v / 10000).toFixed(0)}万` : String(v)
                    }
                  />
                )}
                <Tooltip content={<TrendTooltip />} />
                <Line
                  yAxisId="asset"
                  type="monotone"
                  dataKey="totalAmount"
                  name="总资产"
                  stroke="#315f73"
                  strokeWidth={2.4}
                  dot={{ r: 2.5 }}
                />
                <Line
                  yAxisId="asset"
                  type="monotone"
                  dataKey="investmentAmount"
                  name="投资类"
                  stroke="#5f8770"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line
                  yAxisId="asset"
                  type="monotone"
                  dataKey="balanceAmount"
                  name="余额类"
                  stroke="#a48646"
                  strokeWidth={1.5}
                  dot={false}
                />
                {shouldShowIncomeLine && (
                  <Line
                    yAxisId="income"
                    type="monotone"
                    dataKey="incomeAmount"
                    name="月收入"
                    stroke="#6f5bd1"
                    strokeWidth={1.8}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Snapshot History */}
      <div className="dash-section dashboard-history">
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
      </div>
    </div>
  )
}
