import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Asset, AssetDcaPlan, AssetEntryStatus, AssetProfile, AssetProfileKey, AssetType, Currency, DcaFrequency, SnapshotValue } from '../types/finance'
import {
  ASSET_TYPE_LABELS,
  formatAssetProfileIdentifier,
  getAssetEntryStatus,
  getAssetProfileFields,
  isInvestmentType,
  isRestrictedAssetType,
  sanitizeAssetProfile,
} from '../domain/assets'
import { DCA_FREQUENCY_LABELS, sanitizeDcaPlan } from '../domain/dca'
import { formatProfitRateInput } from '../domain/money'
import MoneyDisplay from '../components/MoneyDisplay'
import TableWorkspace from '../components/TableWorkspace'
import ColumnResizeHandle from '../components/ColumnResizeHandle'
import { useResizableColumns } from '../components/useResizableColumns'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import './AssetsPage.css'

type SortKey = 'name' | 'type' | 'currency' | 'amount' | 'profit' | 'profitRate' | 'institution'
type AssetFieldKey = 'name' | 'type' | 'identifier' | 'institution' | 'currency' | 'note'

type AssetFieldPreferences = {
  order: AssetFieldKey[]
  hidden: AssetFieldKey[]
}

const ASSET_FIELD_STORAGE_KEY = 'ricefinanceu:asset-table-fields'
const DEFAULT_ASSET_FIELD_ORDER: AssetFieldKey[] = [
  'name',
  'type',
  'identifier',
  'institution',
  'currency',
  'note',
]
const ASSET_FIELD_LABELS: Record<AssetFieldKey, string> = {
  name: '名称',
  type: '类型',
  identifier: '标识',
  institution: '机构',
  currency: '币种',
  note: '备注',
}

const ASSET_COLUMN_WIDTHS = {
  name: 180,
  type: 130,
  identifier: 150,
  institution: 140,
  currency: 90,
  amount: 130,
  profit: 110,
  profitRate: 100,
  status: 90,
  note: 180,
  actions: 190,
}

type AssetDraft = {
  id: string
  name: string
  type: AssetType
  institution: string
  currency: Currency
  entryStatus: AssetEntryStatus
  note: string
  original: Asset
}

function assetToDraft(asset: Asset): AssetDraft {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    institution: asset.institution || '',
    currency: asset.currency,
    entryStatus: getAssetEntryStatus(asset),
    note: asset.note || '',
    original: asset,
  }
}

function loadAssetFieldPreferences(): AssetFieldPreferences {
  const fallback: AssetFieldPreferences = { order: [...DEFAULT_ASSET_FIELD_ORDER], hidden: [] }
  if (typeof localStorage === 'undefined') return fallback

  try {
    const parsed = JSON.parse(localStorage.getItem(ASSET_FIELD_STORAGE_KEY) || '{}') as {
      order?: unknown
      hidden?: unknown
    }
    const storedOrder = Array.isArray(parsed.order)
      ? (parsed.order as unknown[]).filter((key): key is AssetFieldKey => (
        typeof key === 'string' && DEFAULT_ASSET_FIELD_ORDER.includes(key as AssetFieldKey)
      ))
      : []
    const order = [
      ...new Set(storedOrder),
      ...DEFAULT_ASSET_FIELD_ORDER.filter((key) => !storedOrder.includes(key)),
    ]
    const hidden = Array.isArray(parsed.hidden)
      ? (parsed.hidden as unknown[]).filter((key): key is AssetFieldKey => (
        key !== 'name' && typeof key === 'string' && DEFAULT_ASSET_FIELD_ORDER.includes(key as AssetFieldKey)
      ))
      : []
    return { order, hidden: [...new Set(hidden)] }
  } catch {
    return fallback
  }
}

export default function AssetsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast, confirm } = useFeedback()
  const { widths: columnWidths, startResize } = useResizableColumns('assets', ASSET_COLUMN_WIDTHS)

  const [assets, setAssets] = useState<Asset[]>([])
  const [drafts, setDrafts] = useState<AssetDraft[]>([])
  const [latestValues, setLatestValues] = useState<Map<string, SnapshotValue>>(new Map())
  const [savingDrafts, setSavingDrafts] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<AssetType>('fund')
  const [currency, setCurrency] = useState<Currency>('CNY')
  const [institution, setInstitution] = useState('')
  const [note, setNote] = useState('')
  const [profileDraft, setProfileDraft] = useState<AssetProfile>({})
  const [dcaEnabled, setDcaEnabled] = useState(false)
  const [dcaFrequency, setDcaFrequency] = useState<DcaFrequency>('monthly')
  const [dcaExcludeWeekends, setDcaExcludeWeekends] = useState(true)
  const [dcaPlannedContribution, setDcaPlannedContribution] = useState('')
  const [dcaTargetAmount, setDcaTargetAmount] = useState('')
  const [dcaTargetDate, setDcaTargetDate] = useState('')
  const [dcaTolerancePercent, setDcaTolerancePercent] = useState('')
  const [dcaNote, setDcaNote] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('type')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [showFieldSettings, setShowFieldSettings] = useState(false)
  const [fieldPreferences, setFieldPreferences] = useState(loadAssetFieldPreferences)
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingAsset, setDeletingAsset] = useState(false)

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ASSET_FIELD_STORAGE_KEY, JSON.stringify(fieldPreferences))
    }
  }, [fieldPreferences])

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [allAssets, latestData] = await Promise.all([
        api.getAssets(),
        api.getLatestSnapshot(),
      ])
      setAssets(allAssets)
      setDrafts(allAssets.map(assetToDraft))
      const valMap = new Map<string, SnapshotValue>()
      if (latestData && latestData.values) {
        for (const v of latestData.values) {
          valMap.set(v.assetId, v)
        }
      }
      setLatestValues(valMap)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setName('')
    setType('fund')
    setCurrency('CNY')
    setInstitution('')
    setNote('')
    setProfileDraft({})
    resetDcaDraft()
    setShowForm(true)
  }

  function openEdit(a: Asset) {
    setEditingId(a.id)
    setName(a.name)
    setType(a.type)
    setCurrency(a.currency)
    setInstitution(a.institution || '')
    setNote(a.note || '')
    setProfileDraft(a.profile || {})
    setDcaDraft(a.dcaPlan)
    setShowForm(true)
  }

  useEffect(() => {
    if (loading || showForm) return

    const editId = (location.state as { editId?: string } | null)?.editId
    if (!editId) return

    const target = assets.find((a) => a.id === editId)
    if (!target) return

    openEdit(target)
    navigate('/assets', { replace: true, state: null })
  }, [assets, loading, location.state, navigate, showForm])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const profile = sanitizeAssetProfile(type, profileDraft)
    const dcaPlan = buildDcaPlanPayload()
    const payload = {
      name,
      type,
      currency,
      institution: institution || undefined,
      note: note || undefined,
      // Send {} when the form has no usable dossier fields so editing can clear
      // an older profile instead of silently keeping hidden values on the server.
      profile: profile || {},
      ...(editingId
        ? { dcaPlan: dcaPlan || ({} as AssetDcaPlan) }
        : dcaPlan
          ? { dcaPlan }
          : {}),
    }
    try {
      if (editingId) {
        await api.updateAsset(editingId, payload)
        toast('资产已更新')
      } else {
        await api.createAsset(payload)
        toast('资产已创建')
      }
      setShowForm(false)
      load()
    } catch (e: any) {
      toast('保存失败: ' + e.message, 'error')
    }
  }

  function updateProfileDraft(key: AssetProfileKey, value: string) {
    setProfileDraft((prev) => ({ ...prev, [key]: value }))
  }

  function resetDcaDraft() {
    setDcaEnabled(false)
    setDcaFrequency('monthly')
    setDcaExcludeWeekends(true)
    setDcaPlannedContribution('')
    setDcaTargetAmount('')
    setDcaTargetDate('')
    setDcaTolerancePercent('')
    setDcaNote('')
  }

  function setDcaDraft(plan: AssetDcaPlan | undefined) {
    if (!plan?.enabled) {
      resetDcaDraft()
      return
    }

    setDcaEnabled(true)
    setDcaFrequency(plan.frequency)
    setDcaExcludeWeekends(plan.excludeWeekends !== false)
    setDcaPlannedContribution(String(plan.plannedContribution))
    setDcaTargetAmount(plan.targetAmount === undefined ? '' : String(plan.targetAmount))
    setDcaTargetDate(plan.targetDate || '')
    setDcaTolerancePercent(
      plan.toleranceRate === undefined ? '' : String(plan.toleranceRate * 100),
    )
    setDcaNote(plan.note || '')
  }

  function buildDcaPlanPayload(): AssetDcaPlan | undefined {
    if (!dcaEnabled || !isInvestmentType(type)) return undefined

    return sanitizeDcaPlan(type, {
      enabled: true,
      frequency: dcaFrequency,
      excludeWeekends: dcaFrequency === 'daily' ? dcaExcludeWeekends : undefined,
      plannedContribution: dcaPlannedContribution,
      targetAmount: dcaTargetAmount,
      targetDate: dcaTargetDate,
      toleranceRate: dcaTolerancePercent === '' ? undefined : Number(dcaTolerancePercent) / 100,
      note: dcaNote,
    })
  }

  function isDraftDirty(draft: AssetDraft): boolean {
    return (
      draft.name !== draft.original.name ||
      draft.type !== draft.original.type ||
      draft.institution !== (draft.original.institution || '') ||
      draft.currency !== draft.original.currency ||
      draft.entryStatus !== getAssetEntryStatus(draft.original) ||
      draft.note !== (draft.original.note || '')
    )
  }

  function updateDraft<K extends keyof Omit<AssetDraft, 'id' | 'original'>>(
    id: string,
    key: K,
    value: AssetDraft[K],
  ) {
    setDrafts((current) => current.map((draft) => (
      draft.id === id ? { ...draft, [key]: value } : draft
    )))
  }

  const dirtyDrafts = drafts.filter(isDraftDirty)

  async function saveDrafts() {
    const invalidDraft = dirtyDrafts.find((draft) => !draft.name.trim())
    if (invalidDraft) {
      toast('资产名称不能为空', 'error')
      return
    }

    setSavingDrafts(true)
    try {
      for (const draft of dirtyDrafts) {
        await api.updateAsset(draft.id, {
          name: draft.name.trim(),
          type: draft.type,
          institution: draft.institution.trim() || undefined,
          currency: draft.currency,
          entryStatus: draft.entryStatus,
          note: draft.note.trim() || undefined,
        })
      }
      toast(`已保存 ${dirtyDrafts.length} 项资产修改`)
      await load()
    } catch (e: any) {
      toast('保存失败: ' + e.message, 'error')
    } finally {
      setSavingDrafts(false)
    }
  }

  async function handleRequestDelete(a: Asset) {
    const ok = await confirm({
      title: '永久删除资产',
      message: `即将永久删除 "${a.name}"。此操作不可恢复。`,
      detail: '只有从未进入任何快照的错误资产可以永久删除；已有历史的资产只能暂停录入。',
      confirmLabel: '继续删除',
      cancelLabel: '取消',
      variant: 'danger',
    })
    if (!ok) return
    setDeleteTarget(a)
    setDeleteConfirmation('')
  }

  async function handlePermanentDelete() {
    if (!deleteTarget || deleteConfirmation !== deleteTarget.name) return
    setDeletingAsset(true)
    try {
      await api.deleteAsset(deleteTarget.id, deleteConfirmation)
      toast(`已永久删除 "${deleteTarget.name}"`)
      setDeleteTarget(null)
      setDeleteConfirmation('')
      await load()
    } catch (e: any) {
      toast('删除失败: ' + e.message, 'error')
    } finally {
      setDeletingAsset(false)
    }
  }

  async function updateEntryStatus(asset: Asset, entryStatus: AssetEntryStatus) {
    try {
      await api.updateAsset(asset.id, { entryStatus })
      toast(entryStatus === 'paused' ? `已暂停录入 "${asset.name}"` : `已恢复录入 "${asset.name}"`)
      await load()
    } catch (e: any) {
      toast('操作失败: ' + e.message, 'error')
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 1 ? -1 : 1)
    } else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="sort-icon">▸</span>
    return <span className="sort-icon active">{sortDir === 1 ? '▲' : '▼'}</span>
  }

  function sortAssets(list: Asset[]): Asset[] {
    return [...list].sort((a, b) => {
      const va = latestValues.get(a.id)
      const vb = latestValues.get(b.id)
      let cmp = 0
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'zh')
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'currency':
          cmp = a.currency.localeCompare(b.currency)
          break
        case 'institution':
          cmp = (a.institution || '').localeCompare(b.institution || '', 'zh')
          break
        case 'amount':
          cmp = (va?.amount || 0) - (vb?.amount || 0)
          break
        case 'profit':
          cmp = (va?.profit || 0) - (vb?.profit || 0)
          break
        case 'profitRate':
          cmp = (va?.profitRate || 0) - (vb?.profitRate || 0)
          break
      }
      return cmp * sortDir
    })
  }

  const draftsById = new Map(drafts.map((draft) => [draft.id, draft]))
  const sortedDrafts = sortAssets(assets)
    .map((asset) => draftsById.get(asset.id))
    .filter((draft): draft is AssetDraft => Boolean(draft))

  const visibleAssetFields = fieldPreferences.order.filter(
    (key) => !fieldPreferences.hidden.includes(key),
  )

  function moveAssetField(key: AssetFieldKey, offset: -1 | 1) {
    setFieldPreferences((current) => {
      const index = current.order.indexOf(key)
      const nextIndex = index + offset
      if (index < 0 || nextIndex < 0 || nextIndex >= current.order.length) return current
      const order = [...current.order]
      ;[order[index], order[nextIndex]] = [order[nextIndex], order[index]]
      return { ...current, order }
    })
  }

  function toggleAssetField(key: AssetFieldKey) {
    if (key === 'name') return
    setFieldPreferences((current) => ({
      ...current,
      hidden: current.hidden.includes(key)
        ? current.hidden.filter((hiddenKey) => hiddenKey !== key)
        : [...current.hidden, key],
    }))
  }

  function renderAssetFieldHeader(key: AssetFieldKey) {
    const label = ASSET_FIELD_LABELS[key]
    const sortKeys: Partial<Record<AssetFieldKey, SortKey>> = {
      name: 'name',
      type: 'type',
      institution: 'institution',
      currency: 'currency',
    }
    const fieldSortKey = sortKeys[key]
    return (
      <th
        key={key}
        className={fieldSortKey ? 'sortable' : undefined}
        onClick={fieldSortKey ? () => toggleSort(fieldSortKey) : undefined}
      >
        {label} {fieldSortKey && sortIcon(fieldSortKey)}
        <ColumnResizeHandle column={key} label={label} onResizeStart={startResize} />
      </th>
    )
  }

  function renderAssetFieldCell(key: AssetFieldKey, draft: AssetDraft) {
    switch (key) {
      case 'name':
        return (
          <td key={key} className="asset-edit-cell asset-name-edit-cell">
            <input
              aria-label={`${draft.original.name} 名称`}
              value={draft.name}
              onChange={(event) => updateDraft(draft.id, 'name', event.target.value)}
            />
            <a
              className="asset-detail-link"
              href={`/assets/${draft.id}`}
              aria-label={draft.original.name}
              onClick={(event) => {
                event.preventDefault()
                navigate(`/assets/${draft.id}`)
              }}
            >
              ↗
            </a>
            {draft.original.dcaPlan?.enabled && <span className="asset-dca-tag">定投</span>}
          </td>
        )
      case 'type':
        return (
          <td key={key} className="asset-edit-cell asset-type-cell">
            <select
              aria-label={`${draft.original.name} 类型`}
              value={draft.type}
              onChange={(event) => updateDraft(draft.id, 'type', event.target.value as AssetType)}
            >
              {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
            {isRestrictedAssetType(draft.type) && (
              <span className="asset-restricted-marker">
                <span>受限资产</span>
                <small>不可随意提取</small>
              </span>
            )}
          </td>
        )
      case 'identifier':
        return (
          <td key={key} className="asset-profile-identifier is-readonly">
            {formatAssetProfileIdentifier(draft.original)}
          </td>
        )
      case 'institution':
        return (
          <td key={key} className="asset-edit-cell">
            <input
              aria-label={`${draft.original.name} 机构`}
              value={draft.institution}
              onChange={(event) => updateDraft(draft.id, 'institution', event.target.value)}
            />
          </td>
        )
      case 'currency':
        return (
          <td key={key} className="asset-edit-cell">
            <select
              aria-label={`${draft.original.name} 币种`}
              value={draft.currency}
              onChange={(event) => updateDraft(draft.id, 'currency', event.target.value as Currency)}
            >
              <option value="CNY">CNY</option>
              <option value="USD">USD</option>
              <option value="HKD">HKD</option>
            </select>
          </td>
        )
      case 'note':
        return (
          <td key={key} className="asset-edit-cell">
            <input
              aria-label={`${draft.original.name} 备注`}
              value={draft.note}
              onChange={(event) => updateDraft(draft.id, 'note', event.target.value)}
            />
          </td>
        )
    }
  }

  function renderFieldSettings() {
    return (
      <div className="asset-field-settings">
        <button
          className="btn-secondary asset-field-settings-trigger"
          type="button"
          aria-expanded={showFieldSettings}
          onClick={() => setShowFieldSettings((visible) => !visible)}
        >
          字段设置
        </button>
        {showFieldSettings && (
          <div className="asset-field-settings-panel" role="dialog" aria-label="资产字段设置">
            <div className="asset-field-settings-title">字段顺序与显示</div>
            {fieldPreferences.order.map((key, index) => {
              const label = ASSET_FIELD_LABELS[key]
              return (
                <div className="asset-field-setting-row" key={key}>
                  <span className="asset-field-order">{index + 1}</span>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`显示${label}`}
                      checked={!fieldPreferences.hidden.includes(key)}
                      disabled={key === 'name'}
                      onChange={() => toggleAssetField(key)}
                    />
                    <span>{label}</span>
                  </label>
                  <button
                    className="asset-field-move-button"
                    type="button"
                    aria-label={`上移${label}`}
                    disabled={index === 0}
                    onClick={() => moveAssetField(key, -1)}
                  ><span className="asset-field-move-icon" aria-hidden="true">↑</span></button>
                  <button
                    className="asset-field-move-button"
                    type="button"
                    aria-label={`下移${label}`}
                    disabled={index === fieldPreferences.order.length - 1}
                    onClick={() => moveAssetField(key, 1)}
                  ><span className="asset-field-move-icon" aria-hidden="true">↓</span></button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  function renderAssetTable() {
    return (
      <table className="fin-table assets-table assets-table-excel resizable-table" aria-label="资产表">
        <colgroup>
          {[...visibleAssetFields, 'amount', 'profit', 'profitRate', 'status', 'actions'].map((column) => (
            <col key={column} style={{ width: columnWidths[column] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {visibleAssetFields.map(renderAssetFieldHeader)}
            <th className="sortable" onClick={() => toggleSort('amount')}>最新金额 {sortIcon('amount')}<ColumnResizeHandle column="amount" label="最新金额" onResizeStart={startResize} /></th>
            <th className="sortable" onClick={() => toggleSort('profit')}>收益 {sortIcon('profit')}<ColumnResizeHandle column="profit" label="收益" onResizeStart={startResize} /></th>
            <th className="sortable" onClick={() => toggleSort('profitRate')}>收益率 {sortIcon('profitRate')}<ColumnResizeHandle column="profitRate" label="收益率" onResizeStart={startResize} /></th>
            <th>状态<ColumnResizeHandle column="status" label="状态" onResizeStart={startResize} /></th>
            <th>更多<ColumnResizeHandle column="actions" label="更多" onResizeStart={startResize} /></th>
          </tr>
        </thead>
        <tbody>
          {sortedDrafts.map((draft) => {
            const latest = latestValues.get(draft.id)
            const investment = isInvestmentType(draft.type)
            return (
              <tr key={draft.id} className={`${draft.entryStatus === 'paused' ? 'row-paused' : ''} ${isDraftDirty(draft) ? 'is-dirty' : ''}`.trim()}>
                {visibleAssetFields.map((key) => renderAssetFieldCell(key, draft))}
                <td className="asset-amount-cell is-readonly">
                  {latest ? <MoneyDisplay value={latest.amount} currency={draft.currency} showCurrency={false} /> : <span className="text-muted">-</span>}
                </td>
                <td className="is-readonly">
                  {investment ? <MoneyDisplay value={latest?.profit} isProfit /> : <span className="text-muted">-</span>}
                </td>
                <td className="is-readonly">
                  {investment && latest?.profitRate !== undefined ? (
                    <span className={`money-display ${latest.profitRate >= 0 ? 'is-profit' : 'is-loss'}`}>
                      {latest.profitRate >= 0 ? '+' : ''}{formatProfitRateInput(latest.profitRate)}%
                    </span>
                  ) : <span className="text-muted">-</span>}
                </td>
                <td className="asset-edit-cell">
                  <select
                    aria-label={`${draft.original.name} 状态`}
                    value={draft.entryStatus}
                    onChange={(event) => updateDraft(draft.id, 'entryStatus', event.target.value as AssetEntryStatus)}
                  >
                    <option value="normal">正常录入</option>
                    <option value="paused">暂停录入</option>
                  </select>
                </td>
                <td className="asset-actions">
                  <button className="btn-link" aria-label={`编辑 ${draft.original.name}`} onClick={() => openEdit(draft.original)}>档案</button>
                  <button
                    className="btn-link"
                    aria-label={`${draft.entryStatus === 'normal' ? '暂停录入' : '恢复录入'} ${draft.original.name}`}
                    onClick={() => updateEntryStatus(draft.original, draft.entryStatus === 'normal' ? 'paused' : 'normal')}
                  >{draft.entryStatus === 'normal' ? '暂停录入' : '恢复录入'}</button>
                  <button className="btn-link btn-link-danger" aria-label={`永久删除 ${draft.original.name}`} onClick={() => handleRequestDelete(draft.original)}>永久删除</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="assets-page">
      <TableWorkspace
        dirtyCount={dirtyDrafts.length}
        saving={savingDrafts}
        primaryActionLabel={savingDrafts ? '保存中…' : '保存资产'}
        onPrimaryAction={saveDrafts}
        secondaryActions={(
          <>
            {renderFieldSettings()}
            <button className="btn-secondary" type="button" onClick={openCreate}>新增资产</button>
          </>
        )}
      >
        {sortedDrafts.length > 0 ? renderAssetTable() : (
          <div className="empty-state"><p>暂无资产项。先新增资产，再录入快照。</p></div>
        )}
      </TableWorkspace>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deletingAsset && setDeleteTarget(null)}>
          <div
            className="modal asset-delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-delete-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="asset-delete-confirm-title">输入资产名称确认</h2>
            <p className="confirm-body">
              请输入 <strong>{deleteTarget.name}</strong>，确认永久删除该资产。
            </p>
            <label className="form-label" htmlFor="asset-delete-confirm-name">输入资产名称</label>
            <input
              id="asset-delete-confirm-name"
              className="form-input"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              autoFocus
            />
            <div className="form-buttons">
              <button type="button" className="btn-secondary" disabled={deletingAsset} onClick={() => setDeleteTarget(null)}>取消</button>
              <button
                type="button"
                className="btn-danger"
                disabled={deletingAsset || deleteConfirmation !== deleteTarget.name}
                onClick={handlePermanentDelete}
              >{deletingAsset ? '删除中…' : '永久删除'}</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? '编辑资产' : '新增资产'}</h2>
            <form onSubmit={handleSubmit}>
              <label className="form-label">名称 *</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <label className="form-label">类型 *</label>
              <select
                className="form-input"
                value={type}
                onChange={(e) => setType(e.target.value as AssetType)}
              >
                <option value="fund">基金</option>
                <option value="stock">股票</option>
                <option value="gold">黄金</option>
                <option value="deposit">存款</option>
                <option value="cash">现金</option>
                <option value="housing_fund">公积金</option>
                <option value="other">其他</option>
              </select>
              {isRestrictedAssetType(type) && (
                <p className="asset-restricted-form-note">
                  受限资产：这类余额纳入总资产，但通常不可随意提取或日常使用。
                </p>
              )}
              <label className="form-label">币种</label>
              <select
                className="form-input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="CNY">CNY ¥ 人民币</option>
                <option value="USD">USD $ 美元</option>
                <option value="HKD">HKD HK$ 港币</option>
              </select>
              <label className="form-label">平台/机构</label>
              <input
                type="text"
                className="form-input"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="如：蚂蚁财富、工商银行"
              />
              <label className="form-label">备注</label>
              <input
                type="text"
                className="form-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="profile-fields">
                <div className="profile-fields-title">类型档案</div>
                <div className="profile-field-grid">
                  {/* The field list follows the selected asset type. Hidden fields
                      are still cleaned again by sanitizeAssetProfile before save. */}
                  {getAssetProfileFields(type).map((field) => (
                    <label className="profile-field" key={field.key}>
                      <span className="form-label">{field.label}</span>
                      <input
                        type={field.inputType || 'text'}
                        className="form-input"
                        value={profileDraft[field.key] || ''}
                        onChange={(e) => updateProfileDraft(field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    </label>
                  ))}
                </div>
              </div>
              {isInvestmentType(type) && (
                <div className="dca-fields">
                  <div className="profile-fields-title">定投计划</div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={dcaEnabled}
                      onChange={(e) => setDcaEnabled(e.target.checked)}
                    />
                    <span>启用定投计划</span>
                  </label>
                  {dcaEnabled && (
                    <>
                      <div className="profile-field-grid">
                        <label className="profile-field" htmlFor="dca-frequency">
                          <span className="form-label">定投周期</span>
                          <select
                            id="dca-frequency"
                            className="form-input"
                            value={dcaFrequency}
                            onChange={(e) => setDcaFrequency(e.target.value as DcaFrequency)}
                          >
                            {Object.entries(DCA_FREQUENCY_LABELS).map(([value, label]) => (
                              <option value={value} key={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="profile-field" htmlFor="dca-planned-contribution">
                          <span className="form-label">每期计划投入</span>
                          <input
                            id="dca-planned-contribution"
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={dcaPlannedContribution}
                            onChange={(e) => setDcaPlannedContribution(e.target.value)}
                            required={dcaEnabled}
                          />
                        </label>
                        <label className="profile-field" htmlFor="dca-target-amount">
                          <span className="form-label">目标金额</span>
                          <input
                            id="dca-target-amount"
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={dcaTargetAmount}
                            onChange={(e) => setDcaTargetAmount(e.target.value)}
                          />
                        </label>
                        <label className="profile-field" htmlFor="dca-target-date">
                          <span className="form-label">目标日期</span>
                          <input
                            id="dca-target-date"
                            type="date"
                            className="form-input"
                            value={dcaTargetDate}
                            onChange={(e) => setDcaTargetDate(e.target.value)}
                          />
                        </label>
                        <label className="profile-field" htmlFor="dca-tolerance">
                          <span className="form-label">容忍偏差 (%)</span>
                          <input
                            id="dca-tolerance"
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-input"
                            value={dcaTolerancePercent}
                            onChange={(e) => setDcaTolerancePercent(e.target.value)}
                            placeholder="默认 20"
                          />
                        </label>
                        <label className="profile-field" htmlFor="dca-note">
                          <span className="form-label">定投备注</span>
                          <input
                            id="dca-note"
                            type="text"
                            className="form-input"
                            value={dcaNote}
                            onChange={(e) => setDcaNote(e.target.value)}
                            placeholder="如：工资到账后投入"
                          />
                        </label>
                      </div>
                      {dcaFrequency === 'daily' && (
                        <label className="checkbox-row dca-weekend-row">
                          <input
                            type="checkbox"
                            checked={dcaExcludeWeekends}
                            onChange={(e) => setDcaExcludeWeekends(e.target.checked)}
                          />
                          <span>排除周末</span>
                        </label>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="form-buttons">
                <button type="submit" className="btn-primary">保存</button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
