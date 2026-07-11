import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import MoneyDisplay from '../components/MoneyDisplay'
import {
  calculateIncomeRecordTotal,
  calculateRestrictedIncomeRecordTotal,
  calculateSpendableIncomeRecordTotal,
  INCOME_CATEGORY_LABELS,
  isRestrictedIncomeCategory,
} from '../domain/income'
import type { IncomeCategory, IncomeRecord } from '../types/finance'
import './IncomeManagementPage.css'

type IncomeFormState = {
  id?: string
  occurredAt: string
  amount: string
  category: IncomeCategory
  sourceName: string
  note: string
}

type MonthlyIncomePoint = {
  month: string
  amount: number
}

const CATEGORY_OPTIONS: Array<{ value: IncomeCategory; label: string }> = [
  { value: 'salary', label: INCOME_CATEGORY_LABELS.salary },
  { value: 'bonus', label: INCOME_CATEGORY_LABELS.bonus },
  { value: 'side_income', label: INCOME_CATEGORY_LABELS.side_income },
  { value: 'housing_fund', label: INCOME_CATEGORY_LABELS.housing_fund },
  { value: 'investment', label: INCOME_CATEGORY_LABELS.investment },
  { value: 'other', label: INCOME_CATEGORY_LABELS.other },
]

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7)
}

function shiftMonthKey(monthKey: string, offset: number): string {
  const [yearText, monthText] = monthKey.split('-')
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 1))
  date.setUTCMonth(date.getUTCMonth() + offset)
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`
}

function filterRollingTwelveMonthRecords(records: IncomeRecord[], latestMonth: string): IncomeRecord[] {
  const startMonth = shiftMonthKey(latestMonth, -11)
  return records.filter((record) => {
    const month = monthKeyOf(record.occurredAt)
    return month >= startMonth && month <= latestMonth
  })
}

function createEmptyForm(): IncomeFormState {
  return {
    occurredAt: formatDateKey(new Date()),
    amount: '',
    category: 'salary',
    sourceName: '',
    note: '',
  }
}

function incomeToForm(record: IncomeRecord): IncomeFormState {
  return {
    id: record.id,
    occurredAt: record.occurredAt,
    amount: String(record.amount),
    category: record.category,
    sourceName: record.sourceName || '',
    note: record.note || '',
  }
}

function parseAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100) / 100
}

function buildMonthlyPoints(records: IncomeRecord[]): MonthlyIncomePoint[] {
  const totals = new Map<string, number>()
  for (const record of records) {
    const month = monthKeyOf(record.occurredAt)
    totals.set(month, Math.round(((totals.get(month) || 0) + record.amount) * 100) / 100)
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-12)
    .map(([month, amount]) => ({ month, amount }))
}

function calculateRecordedMonthAverage(records: IncomeRecord[]): number {
  const recordedMonthCount = new Set(records.map((record) => monthKeyOf(record.occurredAt))).size
  if (recordedMonthCount === 0) return 0
  return Math.round((calculateIncomeRecordTotal(records) / recordedMonthCount) * 100) / 100
}

function formatChartMoney(value: unknown): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '-'
  return amount >= 10000 ? `${(amount / 10000).toFixed(1)}万` : amount.toFixed(0)
}

function IncomeChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="trend-tooltip">
      <div className="trend-tooltip-row">
        <span>月份</span>
        <strong>{label}</strong>
      </div>
      <div className="trend-tooltip-row">
        <span>收入</span>
        <strong>
          {Number(payload[0].value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </strong>
      </div>
    </div>
  )
}

export default function IncomeManagementPage() {
  const { toast, confirm } = useFeedback()
  const [records, setRecords] = useState<IncomeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<IncomeFormState>(() => createEmptyForm())

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const incomeRecords = await api.getIncomeRecords()
      setRecords(incomeRecords)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [records],
  )
  const latestMonth = sortedRecords[0] ? monthKeyOf(sortedRecords[0].occurredAt) : formatDateKey(new Date()).slice(0, 7)
  const rollingTwelveMonthRecords = useMemo(
    () => filterRollingTwelveMonthRecords(records, latestMonth),
    [records, latestMonth],
  )
  const rollingTwelveMonthTotal = calculateIncomeRecordTotal(rollingTwelveMonthRecords)
  const rollingTwelveMonthSpendableTotal = calculateSpendableIncomeRecordTotal(rollingTwelveMonthRecords)
  const rollingTwelveMonthRestrictedTotal = calculateRestrictedIncomeRecordTotal(rollingTwelveMonthRecords)
  const recordedMonthAverage = calculateRecordedMonthAverage(rollingTwelveMonthRecords)
  const monthlyPoints = useMemo(() => buildMonthlyPoints(rollingTwelveMonthRecords), [rollingTwelveMonthRecords])
  const categoryTotals = useMemo(() => {
    const totals = new Map<IncomeCategory, number>()
    for (const record of rollingTwelveMonthRecords) {
      totals.set(record.category, (totals.get(record.category) || 0) + record.amount)
    }
    return CATEGORY_OPTIONS.map((item) => ({
      ...item,
      amount: Math.round((totals.get(item.value) || 0) * 100) / 100,
      restricted: isRestrictedIncomeCategory(item.value),
    })).filter((item) => item.amount > 0)
  }, [rollingTwelveMonthRecords])
  const allIncomeTotal = calculateIncomeRecordTotal(rollingTwelveMonthRecords)
  const primaryCategory = categoryTotals.length > 0
    ? [...categoryTotals].sort((a, b) => b.amount - a.amount)[0]
    : undefined

  function updateFormField<K extends keyof IncomeFormState>(key: K, value: IncomeFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function openCreateForm() {
    setForm(createEmptyForm())
    setFormOpen(true)
  }

  function openEditForm(record: IncomeRecord) {
    setForm(incomeToForm(record))
    setFormOpen(true)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const amount = parseAmount(form.amount)
    if (amount === null) {
      toast('收入金额必须是大于等于 0 的数字', 'error')
      return
    }

    setSaving(true)
    try {
      const payload = {
        occurredAt: form.occurredAt,
        amount,
        category: form.category,
        ...(form.sourceName.trim() ? { sourceName: form.sourceName.trim() } : {}),
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
      }

      if (form.id) {
        await api.updateIncomeRecord(form.id, payload)
        toast('收入已更新')
      } else {
        await api.createIncomeRecord(payload)
        toast('收入已记录')
      }

      setFormOpen(false)
      await load()
    } catch (e: any) {
      toast('保存收入失败: ' + e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(record: IncomeRecord) {
    const ok = await confirm({
      title: '删除收入',
      message: `确定删除 ${record.occurredAt} 的 ${INCOME_CATEGORY_LABELS[record.category]} 收入 ${record.amount.toFixed(2)} 吗？`,
      confirmLabel: '删除',
      cancelLabel: '取消',
      variant: 'danger',
    })
    if (!ok) return

    try {
      await api.deleteIncomeRecord(record.id)
      toast('收入已删除')
      await load()
    } catch (e: any) {
      toast('删除收入失败: ' + e.message, 'error')
    }
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <button onClick={load}>重试</button>
      </div>
    )
  }

  return (
    <div className="income-management-page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">收入管理</h1>
          <p className="page-subtitle">集中查看和修正收入流入记录</p>
          <div className="page-stats">
            <span>税后收入 · 公积金按受限流入追踪 · CNY 口径</span>
          </div>
        </div>
        <button className="btn-primary" type="button" onClick={openCreateForm}>
          记录收入
        </button>
      </header>

      <div className="income-summary-strip section-panel">
        <div className="income-summary-stat income-summary-primary">
          <span className="income-summary-label">近 12 个月可支配收入</span>
          <MoneyDisplay value={rollingTwelveMonthSpendableTotal} currency="CNY" />
        </div>
        <div className="income-summary-stat">
          <span className="income-summary-label">近 12 个月受限收入</span>
          <MoneyDisplay value={rollingTwelveMonthRestrictedTotal} currency="CNY" />
          <span className="income-summary-note">不可支配</span>
        </div>
        <div className="income-summary-stat">
          <span className="income-summary-label">近 12 个月总流入</span>
          <MoneyDisplay value={rollingTwelveMonthTotal} currency="CNY" />
        </div>
        <div className="income-summary-stat">
          <span className="income-summary-label">有记录月均</span>
          <MoneyDisplay value={recordedMonthAverage} currency="CNY" />
        </div>
        <div className="income-summary-stat">
          <span className="income-summary-label">主要类别</span>
          <strong>{primaryCategory ? primaryCategory.label : '-'}</strong>
        </div>
      </div>

      <div className="income-analysis-grid">
        <section className="section-panel income-trend-panel">
          <div className="section-head-row">
            <h3 className="section-title">月度收入趋势</h3>
            <span className="income-section-note">最近 12 个月</span>
          </div>
          {monthlyPoints.length === 0 ? (
            <p className="income-empty-inline">暂无收入记录</p>
          ) : (
            <div className="income-chart-container">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={monthlyPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#edf0ed" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={formatChartMoney} />
                  <Tooltip content={<IncomeChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name="月度收入"
                    stroke="#6f5bd1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="section-panel income-category-panel">
          <div className="section-head-row">
            <h3 className="section-title">分类结构</h3>
            <span className="income-section-note">近 12 个月</span>
          </div>
          {categoryTotals.length === 0 ? (
            <p className="income-empty-inline">暂无分类数据</p>
          ) : (
            <div className="income-category-list">
              {categoryTotals.map((item) => (
                <div
                  className={`income-category-row ${item.restricted ? 'is-restricted' : ''}`}
                  key={item.value}
                >
                  <div className="income-category-main">
                    <span className="income-category-name">
                      <span>{item.label}</span>
                      {item.restricted && <span className="income-availability-badge">不可支配</span>}
                    </span>
                    <MoneyDisplay value={item.amount} currency="CNY" showCurrency={false} />
                  </div>
                  <div className="income-category-track">
                    <div
                      className="income-category-fill"
                      style={{ width: `${allIncomeTotal > 0 ? (item.amount / allIncomeTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="income-category-percent">
                    {allIncomeTotal > 0 ? Math.round((item.amount / allIncomeTotal) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="section-panel income-history-panel">
        <div className="section-head-row">
          <h3 className="section-title">收入历史</h3>
          <span className="income-section-note">{records.length} 条记录</span>
        </div>
        {sortedRecords.length === 0 ? (
          <div className="empty-state income-empty-state">
            <p>还没有收入记录</p>
            <button className="btn-primary" type="button" onClick={openCreateForm}>
              记录收入
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="fin-table income-history-table">
              <thead>
                <tr>
                  <th>发生日期</th>
                  <th>分类</th>
                  <th className="align-right">金额</th>
                  <th>来源</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="income-date-cell">{record.occurredAt}</td>
                    <td>
                      <span
                        className={`income-category-chip ${
                          isRestrictedIncomeCategory(record.category) ? 'is-restricted' : ''
                        }`}
                      >
                        <span>{INCOME_CATEGORY_LABELS[record.category]}</span>
                        {isRestrictedIncomeCategory(record.category) && (
                          <span className="income-availability-badge">不可支配</span>
                        )}
                      </span>
                    </td>
                    <td className="align-right">
                      <MoneyDisplay value={record.amount} currency="CNY" showCurrency={false} />
                    </td>
                    <td>{record.sourceName || '-'}</td>
                    <td className="income-note-cell" title={record.note || undefined}>
                      {record.note || '-'}
                    </td>
                    <td className="income-row-actions">
                      <button
                        className="btn-link"
                        type="button"
                        aria-label={`编辑 ${record.occurredAt} ${INCOME_CATEGORY_LABELS[record.category]}`}
                        onClick={() => openEditForm(record)}
                      >
                        编辑
                      </button>
                      <button
                        className="btn-link danger-link"
                        type="button"
                        aria-label={`删除 ${record.occurredAt} ${INCOME_CATEGORY_LABELS[record.category]}`}
                        onClick={() => handleDelete(record)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="modal-overlay" onClick={() => setFormOpen(false)}>
          <form
            className="modal income-record-modal"
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="income-record-modal-head">
              <h2>{form.id ? '编辑收入' : '记录收入'}</h2>
              <button type="button" className="btn-link" onClick={() => setFormOpen(false)}>
                关闭
              </button>
            </div>
            <div className="income-record-form-grid">
              <label className="income-record-field" htmlFor="income-page-date">
                <span>发生日期</span>
                <input
                  id="income-page-date"
                  type="date"
                  required
                  value={form.occurredAt}
                  onChange={(e) => updateFormField('occurredAt', e.target.value)}
                />
              </label>
              <label className="income-record-field" htmlFor="income-page-category">
                <span>分类</span>
                <select
                  id="income-page-category"
                  value={form.category}
                  onChange={(e) => updateFormField('category', e.target.value as IncomeCategory)}
                >
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="income-record-field" htmlFor="income-page-amount">
                <span>金额</span>
                <input
                  id="income-page-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => updateFormField('amount', e.target.value)}
                />
              </label>
              <label className="income-record-field" htmlFor="income-page-source">
                <span>来源</span>
                <input
                  id="income-page-source"
                  type="text"
                  value={form.sourceName}
                  onChange={(e) => updateFormField('sourceName', e.target.value)}
                />
              </label>
              <label className="income-record-field income-record-field-full" htmlFor="income-page-note">
                <span>备注</span>
                <input
                  id="income-page-note"
                  type="text"
                  value={form.note}
                  onChange={(e) => updateFormField('note', e.target.value)}
                />
              </label>
            </div>
            <div className="income-record-modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
                取消
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? '保存中...' : '保存收入'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
