import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import type { AssetType, SnapshotValue } from '../types/finance'
import { isInvestmentType } from '../domain/assets'
import {
  isValidCurrencyAmount,
  isValidPercentInput,
  isValidSignedMoney,
  formatMoneyFixed,
  formatProfitRateInput,
  truncateDecimal,
} from '../domain/money'
import MoneyInput from './MoneyInput'
import MoneyDisplay from './MoneyDisplay'
import ColumnResizeHandle from './ColumnResizeHandle'
import { useResizableColumns } from './useResizableColumns'
import { useFeedback } from './Feedback/FeedbackContext'
import './SnapshotForm.css'

interface SnapshotFormProps {
  onSuccess: () => void
  onManageAssets: () => void
}

interface AssetRow {
  assetId: string
  name: string
  type: string
  currency: string
  amount: string
  profit: string
  profitRate: string
  previousAmount?: number
  previousProfit?: number
  previousProfitRate?: number
  included: boolean
  /** Status for visual feedback */
  status: 'default' | 'modified' | 'auto-calc'
}

const SNAPSHOT_COLUMN_WIDTHS = {
  included: 72,
  name: 180,
  currency: 80,
  previousAmount: 120,
  amount: 135,
  delta: 100,
  profit: 130,
  profitRate: 110,
  status: 100,
}

export default function SnapshotForm({ onSuccess, onManageAssets }: SnapshotFormProps) {
  const latestValuesRef = useRef<Map<string, SnapshotValue>>(new Map())
  const [rows, setRows] = useState<AssetRow[]>([])
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().split('T')[0])
  const [recordingTime, setRecordingTime] = useState(new Date().toTimeString().slice(0, 5))
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const { toast, confirm } = useFeedback()
  const { widths: columnWidths, startResize } = useResizableColumns(
    'snapshot-entry',
    SNAPSHOT_COLUMN_WIDTHS,
  )

  function markDirty() {
    if (!isDirty) setIsDirty(true)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [allAssets, latestData] = await Promise.all([
        api.getAssets(),
        api.getLatestSnapshot(),
      ])

      const activeAssets = allAssets.filter((a) => a.isActive)
      const prevMap = new Map<string, SnapshotValue>()
      if (latestData && latestData.values) {
        for (const v of latestData.values) {
          prevMap.set(v.assetId, v)
        }
      }
      latestValuesRef.current = prevMap

      const assetRows: AssetRow[] = activeAssets.map((a) => {
        const prev = prevMap.get(a.id)
        return {
          assetId: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency || 'CNY',
          amount: prev ? String(prev.amount) : '',
          profit: prev?.profit !== undefined ? String(prev.profit) : '',
          profitRate: formatProfitRateInput(prev?.profitRate),
          previousAmount: prev?.amount,
          previousProfit: prev?.profit,
          previousProfitRate: prev?.profitRate,
          included: true,
          status: 'default' as const,
        }
      })

      // Sort by amount descending
      assetRows.sort((a, b) => {
        const numA = Number(a.amount)
        const numB = Number(b.amount)
        if (!Number.isFinite(numA) && !Number.isFinite(numB)) return 0
        if (!Number.isFinite(numA)) return 1
        if (!Number.isFinite(numB)) return -1
        return numB - numA
      })
      setRows(assetRows)
    } catch (e: any) {
      console.error('Failed to load data:', e)
    }
  }

  function toggleIncluded(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, included: !r.included } : r))
    )
    markDirty()
  }

  function updateRow(index: number, field: string, value: string) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const updated = { ...r, [field]: value, status: 'modified' as const }

        // Editing a value means this asset belongs to the current snapshot.
        if (!r.included) {
          updated.included = true
        }

        if (!isInvestmentType(r.type as any)) return updated

        // Do not auto-calculate while the user is in the middle of typing.
        // For example "12." is not final enough to derive profit/rate from.
        if (value === '' || value === '-' || value.endsWith('.')) return updated

        const curAmount = field === 'amount' ? Number(value) : Number(r.amount)
        const curProfit = field === 'profit' ? Number(value) : Number(r.profit)
        const curRatePct = field === 'profitRate' ? Number(value) : Number(r.profitRate)
        const curRate = curRatePct / 100

        const hasAmount = Number.isFinite(curAmount) && curAmount > 0
        const hasProfit = Number.isFinite(curProfit)
        const hasRate = Number.isFinite(curRate) && curRate > -1

        let autoCalcField: string | null = null
        let autoCalcValue: string | null = null

        if (field === 'amount') {
          if (hasProfit) {
            const cost = curAmount - curProfit
            if (cost > 0) {
              autoCalcField = 'profitRate'
              autoCalcValue = truncateDecimal((curProfit / cost) * 100, 2).toFixed(2)
            }
          } else if (hasRate) {
            const cost = curAmount / (1 + curRate)
            autoCalcField = 'profit'
            autoCalcValue = (curAmount - cost).toFixed(2)
          }
        } else if (field === 'profit') {
          if (hasAmount) {
            const cost = curAmount - curProfit
            if (cost > 0) {
              autoCalcField = 'profitRate'
              autoCalcValue = truncateDecimal((curProfit / cost) * 100, 2).toFixed(2)
            }
          } else if (hasRate && curRate > 0) {
            const cost = curProfit / curRate
            autoCalcField = 'amount'
            autoCalcValue = (cost + curProfit).toFixed(2)
          }
        } else if (field === 'profitRate') {
          if (hasAmount) {
            const cost = curAmount / (1 + curRate)
            autoCalcField = 'profit'
            autoCalcValue = (curAmount - cost).toFixed(2)
          } else if (hasProfit && curRate > 0) {
            const cost = curProfit / curRate
            autoCalcField = 'amount'
            autoCalcValue = (cost + curProfit).toFixed(2)
          }
        }

        if (autoCalcField && autoCalcValue !== null) {
          ;(updated as any)[autoCalcField] = autoCalcValue
        }

        return updated
      })
    )
    markDirty()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (includedRows.length === 0) {
        toast('请至少选择一个资产项', 'error')
        setSubmitting(false)
        return
      }

      const values = includedRows.map((r) => {
        if (!isValidCurrencyAmount(r.amount)) {
          throw new Error(`资产 "${r.name}" 的金额无效`)
        }
        const amount = Number(r.amount)
        const item: any = { assetId: r.assetId, amount }

        if (isInvestmentType(r.type as any)) {
          if (r.profit !== '') {
            if (!isValidSignedMoney(r.profit)) {
              throw new Error(`资产 "${r.name}" 的收益无效`)
            }
            const profit = Number(r.profit)
            if (Number.isFinite(profit)) item.profit = profit
          }
          if (r.profitRate !== '') {
            if (!isValidPercentInput(r.profitRate)) {
              throw new Error(`资产 "${r.name}" 的收益率无效`)
            }
            const rate = Number(r.profitRate)
            if (Number.isFinite(rate)) item.profitRate = rate / 100
          }
        }
        return item
      })

      // Build a review sheet before saving. Snapshot entry is deliberately
      // time-bound, so the user should see which point in time they are about to write.
      const changedDetails: string[] = []
      let totalAmountDelta = 0
      for (const r of changedRows) {
        const newAmount = Number(r.amount)
        const prevAmount = r.previousAmount || 0
        const delta = newAmount - prevAmount
        totalAmountDelta += delta
        const sign = delta >= 0 ? '+' : ''
        const deltaStr = `${sign}${formatMoneyFixed(delta)}`
        const prevStr = r.previousAmount !== undefined ? formatMoneyFixed(r.previousAmount) : '-'
        changedDetails.push(
          `${r.name}: ${prevStr} → ${formatMoneyFixed(newAmount)} (${deltaStr})`
        )
      }

      const detailParts = [
        `快照时间：${recordedAt} ${recordingTime}`,
        `本次更新 ${includedRows.length} 项，金额变化 ${changedRows.length} 项`,
      ]
      if (totalAmountDelta !== 0) {
        const sign = totalAmountDelta >= 0 ? '+' : ''
        detailParts.push(`总资产变动：${sign}${formatMoneyFixed(Math.abs(totalAmountDelta))}`)
      }
      if (largeChangeRows.length > 0) {
        detailParts.push(`⚠ 大额变化 (超50%)：${largeChangeRows.map((r) => r.name).join('、')}`)
      }
      if (changedDetails.length > 0) {
        detailParts.push(`\n明细：\n${changedDetails.slice(0, 15).join('\n')}`)
        if (changedDetails.length > 15) {
          detailParts.push(`... 还有 ${changedDetails.length - 15} 项`)
        }
      }

      const ok = await confirm({
        title: '确认追加快照',
        message: detailParts.join('\n'),
        confirmLabel: '保存',
        cancelLabel: '取消',
        variant: 'primary',
      })
      if (!ok) {
        setSubmitting(false)
        return
      }

      const recordedAtStr = `${recordedAt}T${recordingTime}:00`
      await api.createSnapshot({
        recordedAt: recordedAtStr,
        note: note || undefined,
        values,
      })

      // Aggregate totals for toast
      let savedTotalDelta = 0
      for (const r of changedRows) {
        const na = Number(r.amount)
        const pa = r.previousAmount || 0
        if (Number.isFinite(na)) savedTotalDelta += na - pa
      }
      const deltaSign = savedTotalDelta >= 0 ? '+' : ''
      const deltaInfo = savedTotalDelta !== 0 ? ` · 总变动 ${deltaSign}${formatMoneyFixed(Math.abs(savedTotalDelta))}` : ''
      const largeInfo = largeChangeRows.length > 0 ? ` · ⚠ ${largeChangeRows.length} 项大额` : ''
      toast(`快照已追加 · ${recordedAt} ${recordingTime} · ${includedRows.length} 项更新${deltaInfo}${largeInfo}`)
      onSuccess()
      await loadData()
      setNote('')
      setIsDirty(false)
    } catch (e: any) {
      toast('保存失败: ' + e.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleManageAssets() {
    if (isDirty) {
      confirm({
        title: '离开确认',
        message: '当前快照尚未保存，离开后本次填写内容会丢失。确定要离开吗？',
        confirmLabel: '离开',
        cancelLabel: '继续编辑',
        variant: 'danger',
      }).then((ok) => {
        if (ok) onManageAssets()
      })
    } else {
      onManageAssets()
    }
  }

  const includedRows = rows.filter((r) => r.included)
  const changedRows = includedRows.filter((r) => {
    if (r.previousAmount === undefined) return true
    const amount = Number(r.amount)
    return Number.isFinite(amount) && amount !== r.previousAmount
  })
  const largeChangeRows = changedRows.filter((r) => {
    if (r.previousAmount === undefined || r.previousAmount === 0) return false
    const amount = Number(r.amount)
    if (!Number.isFinite(amount)) return false
    return Math.abs(amount - r.previousAmount) / Math.abs(r.previousAmount) > 0.5
  })

  function isLargeChange(r: AssetRow): boolean {
    return largeChangeRows.some((lr) => lr.assetId === r.assetId)
  }

  function getRowClass(r: AssetRow): string {
    if (!r.included) return 'row-disabled'
    if (isLargeChange(r)) return 'row-warning'
    if (r.status === 'modified') return 'row-selected'
    return ''
  }

  function renderTable() {
    return (
      <table className="fin-table snapshot-table resizable-table" aria-label="快照录入表">
        <colgroup>
          {Object.entries(columnWidths).map(([column, width]) => (
            <col key={column} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th>☑<ColumnResizeHandle column="included" label="纳入" onResizeStart={startResize} /></th>
            <th>名称<ColumnResizeHandle column="name" label="名称" onResizeStart={startResize} /></th>
            <th>币种<ColumnResizeHandle column="currency" label="币种" onResizeStart={startResize} /></th>
            <th className="align-right">上次金额<ColumnResizeHandle column="previousAmount" label="上次金额" onResizeStart={startResize} /></th>
            <th className="align-right">本次金额<ColumnResizeHandle column="amount" label="本次金额" onResizeStart={startResize} /></th>
            <th className="align-right">变化<ColumnResizeHandle column="delta" label="变化" onResizeStart={startResize} /></th>
            <th className="align-right">收益<ColumnResizeHandle column="profit" label="收益" onResizeStart={startResize} /></th>
            <th className="align-right">收益率<ColumnResizeHandle column="profitRate" label="收益率" onResizeStart={startResize} /></th>
            <th>状态<ColumnResizeHandle column="status" label="状态" onResizeStart={startResize} /></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const globalIdx = rows.findIndex((x) => x.assetId === r.assetId)
            const rowClass = getRowClass(r)
            const investment = isInvestmentType(r.type as AssetType)

            // Calculate delta
            const curAmount = Number(r.amount)
            const hasDelta =
              r.included &&
              r.previousAmount !== undefined &&
              Number.isFinite(curAmount) &&
              curAmount !== r.previousAmount
            const delta = hasDelta ? curAmount - r.previousAmount! : undefined

            const statusLabel = !r.included
              ? '沿用'
              : isLargeChange(r)
                ? '大额变化'
                : r.status === 'modified'
                  ? '已修改'
                  : '未变化'

            return (
              <tr key={r.assetId} className={rowClass}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${r.included ? '不纳入' : '纳入'} ${r.name}`}
                    checked={r.included}
                    onChange={() => globalIdx >= 0 && toggleIncluded(globalIdx)}
                  />
                </td>
                <td>
                  <span className={r.included ? 'snap-asset-name' : 'snap-asset-name-disabled'}>
                    {r.name}
                  </span>
                </td>
                <td>
                  <span className="currency-tag">{r.currency}</span>
                </td>
                <td className="align-right">
                  {r.previousAmount !== undefined ? (
                    <MoneyDisplay value={r.previousAmount} currency={r.currency as any} showCurrency={false} />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="align-right">
                  <MoneyInput
                    ariaLabel={`${r.name} 本次金额`}
                    value={r.amount}
                    onChange={(v) => globalIdx >= 0 && updateRow(globalIdx, 'amount', v)}
                    unit={r.currency}
                    placeholder={r.previousAmount !== undefined ? formatMoneyFixed(r.previousAmount) : '0.00'}
                    disabled={!r.included}
                    status={r.status}
                  />
                </td>
                <td className="align-right">
                  {delta !== undefined ? (
                    <MoneyDisplay value={delta} isProfit showCurrency={false} />
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className={`align-right ${investment ? '' : 'snapshot-na-cell'}`}>
                  <MoneyInput
                    ariaLabel={`${r.name} 收益`}
                    value={investment ? r.profit : ''}
                    onChange={(v) => globalIdx >= 0 && updateRow(globalIdx, 'profit', v)}
                    allowNegative
                    placeholder={investment ? '0.00' : '-'}
                    disabled={!investment || !r.included}
                    status={r.status}
                  />
                </td>
                <td className={`align-right ${investment ? '' : 'snapshot-na-cell'}`}>
                  <MoneyInput
                    ariaLabel={`${r.name} 收益率`}
                    value={investment ? r.profitRate : ''}
                    onChange={(v) => globalIdx >= 0 && updateRow(globalIdx, 'profitRate', v)}
                    unit={investment ? '%' : undefined}
                    allowNegative
                    minValue={-100}
                    placeholder={investment ? '0.00' : '-'}
                    disabled={!investment || !r.included}
                    status={r.status}
                  />
                </td>
                <td>
                  {statusLabel && (
                    <span
                      className={`snap-status ${
                        isLargeChange(r)
                          ? 'snap-status-warning'
                          : r.status === 'modified'
                            ? 'snap-status-modified'
                            : 'snap-status-default'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="snapshot-form-container">
      <form onSubmit={handleSubmit}>
        {/* Sticky header bar */}
        <div className="snapshot-sticky-bar">
          <div className="snapshot-sticky-left">
            <div className="snapshot-meta-inline">
              <label className="snap-field">
                <span className="snap-label">日期</span>
                <input
                  type="date"
                  className="snap-date-input"
                  value={recordedAt}
                  onChange={(e) => {
                    setRecordedAt(e.target.value)
                    markDirty()
                  }}
                  required
                />
              </label>
              <label className="snap-field">
                <span className="snap-label">时间</span>
                <input
                  type="time"
                  className="snap-time-input"
                  value={recordingTime}
                  onChange={(e) => {
                    setRecordingTime(e.target.value)
                    markDirty()
                  }}
                />
              </label>
              <label className="snap-field snap-field-note">
                <span className="snap-label">备注</span>
                <input
                  type="text"
                  className="snap-note-input"
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    markDirty()
                  }}
                  placeholder="如：月末盘点"
                />
              </label>
            </div>
          </div>
          <div className="snapshot-sticky-right">
            <span className="snapshot-stats">
              更新 {includedRows.length} 项 · 变化 {changedRows.length} 项
              {largeChangeRows.length > 0 && ` · 大额 ${largeChangeRows.length}`}
            </span>
            <button type="button" className="btn-secondary" onClick={handleManageAssets}>
              管理资产
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? '追加中...' : '追加快照'}
            </button>
          </div>
        </div>

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="empty-state">
            <p>暂无资产项。</p>
            <p>
              请先去<strong>资产管理</strong>添加资产，再回来录入快照。
            </p>
            <button type="button" className="btn-secondary" style={{ marginTop: 12 }} onClick={handleManageAssets}>
              管理资产项
            </button>
          </div>
        )}

        {rows.length > 0 && (
          <div className="snapshot-grid-wrap">
            {renderTable()}
          </div>
        )}

        {/* Bottom save for long forms */}
        {rows.length > 10 && (
          <div className="snapshot-bottom-bar">
            <button type="submit" className="btn-primary btn-large" disabled={submitting}>
              {submitting ? '追加中...' : '追加快照'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
