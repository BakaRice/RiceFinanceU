import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'
import type { SnapshotValue, Currency } from '../types/finance'
import { isInvestmentType, ASSET_TYPE_LABELS } from '../domain/assets'
import { formatMoney } from '../domain/money'
import './SnapshotForm.css'

interface SnapshotFormProps {
  onSuccess: () => void
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
  isNew?: boolean
  inlineName?: string
  inlineType?: string
  inlineCurrency?: string
  inlineInstitution?: string
}

export default function SnapshotForm({ onSuccess }: SnapshotFormProps) {
  const latestValuesRef = useRef<Map<string, SnapshotValue>>(new Map())
  const [rows, setRows] = useState<AssetRow[]>([])
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().split('T')[0])
  const [recordingTime, setRecordingTime] = useState(new Date().toTimeString().slice(0, 5))
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAddAsset, setShowAddAsset] = useState(false)
  const [newAssetName, setNewAssetName] = useState('')
  const [newAssetType, setNewAssetType] = useState('fund')
  const [newAssetCurrency, setNewAssetCurrency] = useState<Currency>('CNY')
  const [newAssetInstitution, setNewAssetInstitution] = useState('')

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

      // Build rows from active assets
      const assetRows: AssetRow[] = activeAssets.map((a) => {
        const prev = prevMap.get(a.id)
        return {
          assetId: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency || 'CNY',
          amount: prev ? String(prev.amount) : '',
          profit: prev?.profit !== undefined ? String(prev.profit) : '',
          profitRate: prev?.profitRate !== undefined ? String(prev.profitRate * 100) : '',
          previousAmount: prev?.amount,
          previousProfit: prev?.profit,
          previousProfitRate: prev?.profitRate,
          included: !!prev, // Pre-check if asset was in previous snapshot
        }
      })
      setRows(assetRows)
    } catch (e: any) {
      console.error('Failed to load data:', e)
    }
  }

  function toggleIncluded(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, included: !r.included } : r)))
  }

  function updateRow(index: number, field: string, value: string) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const updated = { ...r, [field]: value }

        if (!isInvestmentType(r.type as any)) return updated

        // Skip auto-calc if the new value is an incomplete decimal (e.g. "2." or "-")
        if (value === '' || value === '-' || value.endsWith('.')) return updated

        // Parse current values (use new value for the field being edited, old for others)
        const curAmount = field === 'amount' ? Number(value) : Number(r.amount)
        const curProfit = field === 'profit' ? Number(value) : Number(r.profit)
        const curRatePct = field === 'profitRate' ? Number(value) : Number(r.profitRate)
        const curRate = curRatePct / 100

        const hasAmount = Number.isFinite(curAmount) && curAmount > 0
        const hasProfit = Number.isFinite(curProfit)
        const hasRate = Number.isFinite(curRate) && curRate > -1

        // Priority: when editing X, only auto-calc the OTHER fields.
        //   edit amount → calc profitRate (if profit) or calc profit (if rate)
        //   edit profit → calc profitRate (if amount) or calc amount (if rate)
        //   edit profitRate → calc profit (if amount) or calc amount (if profit)

        if (field === 'amount') {
          if (hasProfit) {
            const cost = curAmount - curProfit
            if (cost > 0) updated.profitRate = ((curProfit / cost) * 100).toFixed(2)
          } else if (hasRate) {
            const cost = curAmount / (1 + curRate)
            updated.profit = (curAmount - cost).toFixed(2)
          }
        } else if (field === 'profit') {
          if (hasAmount) {
            const cost = curAmount - curProfit
            if (cost > 0) updated.profitRate = ((curProfit / cost) * 100).toFixed(2)
          } else if (hasRate && curRate > 0) {
            const cost = curProfit / curRate
            updated.amount = (cost + curProfit).toFixed(2)
          }
        } else if (field === 'profitRate') {
          if (hasAmount) {
            const cost = curAmount / (1 + curRate)
            updated.profit = (curAmount - cost).toFixed(2)
          } else if (hasProfit && curRate > 0) {
            const cost = curProfit / curRate
            updated.amount = (cost + curProfit).toFixed(2)
          }
        }

        return updated
      })
    )
    if (!rows[index].included) {
      toggleIncluded(index)
    }
  }

  function addInlineAsset() {
    if (!newAssetName.trim()) return
    const inlineRow: AssetRow = {
      assetId: '',
      name: newAssetName.trim(),
      type: newAssetType,
      currency: newAssetCurrency,
      amount: '',
      profit: '',
      profitRate: '',
      included: true,
      isNew: true,
      inlineName: newAssetName.trim(),
      inlineType: newAssetType,
      inlineCurrency: newAssetCurrency,
      inlineInstitution: newAssetInstitution || undefined,
    }
    setRows((prev) => [...prev, inlineRow])
    setNewAssetName('')
    setNewAssetType('fund')
    setNewAssetCurrency('CNY')
    setNewAssetInstitution('')
    setShowAddAsset(false)
  }

  function removeInlineAsset(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      const includedRows = rows.filter((r) => r.included)
      if (includedRows.length === 0) {
        alert('请至少选择一个资产项')
        setSubmitting(false)
        return
      }

      const values = includedRows.map((r) => {
        const amount = Number(r.amount)
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error(`资产 "${r.name}" 的金额无效`)
        }

        const item: any = { amount }

        if (r.isNew) {
          item.asset = {
            name: r.inlineName!,
            type: r.inlineType! as any,
            currency: (r.inlineCurrency || 'CNY') as any,
            institution: r.inlineInstitution || undefined,
          }
        } else {
          item.assetId = r.assetId
        }

        if (isInvestmentType(r.type as any)) {
          if (r.profit !== '') {
            const profit = Number(r.profit)
            if (Number.isFinite(profit)) item.profit = profit
          }
          if (r.profitRate !== '') {
            const rate = Number(r.profitRate)
            if (Number.isFinite(rate)) item.profitRate = rate / 100 // Convert % to decimal
          }
        }

        return item
      })

      const recordedAtStr = `${recordedAt}T${recordingTime}:00`
      await api.createSnapshot({
        recordedAt: recordedAtStr,
        note: note || undefined,
        values,
      })

      onSuccess()
      // Reload to show updated previous values
      await loadData()
      setNote('')
      alert('快照保存成功！')
    } catch (e: any) {
      alert('保存失败: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Group rows: investment first, then balance
  const investmentRows = rows.filter((r) => isInvestmentType(r.type as any))
  const balanceRows = rows.filter((r) => !isInvestmentType(r.type as any))

  function renderRow(r: AssetRow, index: number) {
    const isInvestment = isInvestmentType(r.type as any)
    const hasChanged = r.included && r.previousAmount !== undefined && Number(r.amount) !== r.previousAmount

    return (
      <div key={r.isNew ? `new-${index}` : r.assetId} className={`snapshot-row ${r.included ? 'included' : 'excluded'} ${r.isNew ? 'is-new' : ''}`}>
        <div className="snapshot-row-header">
          <label className="snapshot-checkbox">
            <input
              type="checkbox"
              checked={r.included}
              onChange={() => {
                const realIndex = rows.findIndex(
                  (x) => x.assetId === r.assetId && x.isNew === r.isNew && x.name === r.name
                )
                if (realIndex >= 0) toggleIncluded(realIndex)
              }}
            />
            <span className="snapshot-asset-name">{r.name}</span>
            {r.currency && r.currency !== 'CNY' && <span className="snapshot-currency">{r.currency}</span>}
          </label>
          <span className="snapshot-asset-type">{ASSET_TYPE_LABELS[r.type as keyof typeof ASSET_TYPE_LABELS] || r.type}</span>
          {r.isNew && (
            <button type="button" className="btn-remove-inline" onClick={() => removeInlineAsset(index)}>
              ✕
            </button>
          )}
        </div>

        <div className={`snapshot-row-fields ${r.included ? '' : 'disabled'}`}>
          <div className="snapshot-field">
            <label>金额</label>
            <input
              type="number" step="0.01" min="0"
              value={r.amount}
              onChange={(e) => {
                const realIndex = rows.findIndex(
                  (x) => x.assetId === r.assetId && x.isNew === r.isNew && x.name === r.name
                )
                if (realIndex >= 0) updateRow(realIndex, 'amount', e.target.value)
              }}
              placeholder={r.previousAmount !== undefined ? `上次: ${formatMoney(r.previousAmount)}` : '0.00'}
              disabled={!r.included}
            />
            {hasChanged && r.previousAmount !== undefined && (
              <span className={`change-indicator ${Number(r.amount) > r.previousAmount ? 'increase' : 'decrease'}`}>
                {Number(r.amount) > r.previousAmount ? '↑' : '↓'}
              </span>
            )}
          </div>

          {isInvestment && (
            <>
              <div className="snapshot-field">
                <label>当前收益</label>
                <input
                  type="number" step="0.01"
                  value={r.profit}
                  onChange={(e) => {
                    const realIndex = rows.findIndex(
                      (x) => x.assetId === r.assetId && x.isNew === r.isNew && x.name === r.name
                    )
                    if (realIndex >= 0) updateRow(realIndex, 'profit', e.target.value)
                  }}
                  placeholder={r.previousProfit !== undefined ? `上次: ${formatMoney(r.previousProfit)}` : '如 500.00'}
                  disabled={!r.included}
                />
              </div>
              <div className="snapshot-field">
                <label>收益率(%)</label>
                <input
                  type="number" step="0.01"
                  value={r.profitRate}
                  onChange={(e) => {
                    const realIndex = rows.findIndex(
                      (x) => x.assetId === r.assetId && x.isNew === r.isNew && x.name === r.name
                    )
                    if (realIndex >= 0) updateRow(realIndex, 'profitRate', e.target.value)
                  }}
                  placeholder={r.previousProfitRate !== undefined ? `上次: ${(r.previousProfitRate * 100).toFixed(2)}%` : '如 8.65'}
                  disabled={!r.included}
                />
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="snapshot-form-container">
      <form onSubmit={handleSubmit}>
        <div className="snapshot-form-header">
          <h2>新增资产快照</h2>
          <div className="snapshot-meta">
            <div className="snapshot-field">
              <label>日期 *</label>
              <input type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} required />
            </div>
            <div className="snapshot-field">
              <label>时间</label>
              <input type="time" value={recordingTime} onChange={(e) => setRecordingTime(e.target.value)} />
            </div>
            <div className="snapshot-field" style={{ flex: 2 }}>
              <label>备注</label>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="如：月末盘点" />
            </div>
          </div>
        </div>

        <div className="snapshot-actions-bar">
          <span className="hint-text">
            勾选需要更新的资产，填写当前金额。未勾选的资产沿用上次快照值。投资类资产可填写收益。
          </span>
          <button type="button" className="btn-secondary" onClick={() => setShowAddAsset(!showAddAsset)}>
            + 新增资产项
          </button>
        </div>

        {showAddAsset && (
          <div className="inline-add-asset">
            <input type="text" value={newAssetName} onChange={(e) => setNewAssetName(e.target.value)} placeholder="资产名称 *" />
            <select value={newAssetType} onChange={(e) => setNewAssetType(e.target.value)}>
              <option value="fund">基金</option>
              <option value="stock">股票</option>
              <option value="gold">黄金</option>
              <option value="deposit">存款</option>
              <option value="cash">现金</option>
              <option value="housing_fund">公积金</option>
              <option value="other">其他</option>
            </select>
            <select value={newAssetCurrency} onChange={(e) => setNewAssetCurrency(e.target.value as Currency)}>
              <option value="CNY">CNY ¥</option>
              <option value="USD">USD $</option>
              <option value="HKD">HKD HK$</option>
            </select>
            <input type="text" value={newAssetInstitution} onChange={(e) => setNewAssetInstitution(e.target.value)} placeholder="平台/机构（可选）" />
            <button type="button" className="btn-primary" onClick={addInlineAsset}>添加</button>
            <button type="button" className="btn-secondary" onClick={() => setShowAddAsset(false)}>取消</button>
          </div>
        )}

        {/* Investment assets */}
        {investmentRows.length > 0 && (
          <div className="snapshot-group">
            <h3 className="group-label">📈 投资类资产</h3>
            {investmentRows.map((r) => {
              const realIndex = rows.findIndex(
                (x) => x.assetId === r.assetId && x.isNew === r.isNew && x.name === r.name
              )
              return renderRow(r, realIndex)
            })}
          </div>
        )}

        {/* Balance assets */}
        {balanceRows.length > 0 && (
          <div className="snapshot-group">
            <h3 className="group-label">💰 余额类资产</h3>
            {balanceRows.map((r) => {
              const realIndex = rows.findIndex(
                (x) => x.assetId === r.assetId && x.isNew === r.isNew && x.name === r.name
              )
              return renderRow(r, realIndex)
            })}
          </div>
        )}

        {rows.length === 0 && (
          <div className="empty-assets-hint">
            <p>暂无资产项。</p>
            <p>点击"+ 新增资产项"添加你的第一个资产，或直接在下方录入。</p>
          </div>
        )}

        <div className="snapshot-form-footer">
          <button type="submit" className="btn-primary btn-large" disabled={submitting}>
            {submitting ? '保存中...' : '保存快照'}
          </button>
        </div>
      </form>
    </div>
  )
}
