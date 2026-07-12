import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import TableWorkspace from '../components/TableWorkspace'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import {
  INCOME_CATEGORY_LABELS,
  isRestrictedIncomeCategory,
  normalizeIncomeDateInput,
} from '../domain/income'
import type { IncomeCategory, IncomeRecord } from '../types/finance'
import './IncomeManagementPage.css'

type IncomeDraft = {
  localId: string
  id?: string
  rowLabel: string
  occurredAt: string
  amount: string
  category: IncomeCategory
  sourceName: string
  note: string
  pendingDelete: boolean
}

const CATEGORY_OPTIONS: Array<{ value: IncomeCategory; label: string }> = [
  { value: 'salary', label: INCOME_CATEGORY_LABELS.salary },
  { value: 'bonus', label: INCOME_CATEGORY_LABELS.bonus },
  { value: 'side_income', label: INCOME_CATEGORY_LABELS.side_income },
  { value: 'housing_fund', label: INCOME_CATEGORY_LABELS.housing_fund },
  { value: 'investment', label: INCOME_CATEGORY_LABELS.investment },
  { value: 'other', label: INCOME_CATEGORY_LABELS.other },
]

let newRowCounter = 0

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function recordToDraft(record: IncomeRecord): IncomeDraft {
  return {
    localId: record.id,
    id: record.id,
    rowLabel: `${record.occurredAt} ${INCOME_CATEGORY_LABELS[record.category]}`,
    occurredAt: record.occurredAt,
    amount: String(record.amount),
    category: record.category,
    sourceName: record.sourceName || '',
    note: record.note || '',
    pendingDelete: false,
  }
}

function createNewDraft(): IncomeDraft {
  newRowCounter += 1
  return {
    localId: `new-income-${newRowCounter}`,
    rowLabel: `新增收入 ${newRowCounter}`,
    occurredAt: formatDateKey(new Date()),
    amount: '',
    category: 'salary',
    sourceName: '',
    note: '',
    pendingDelete: false,
  }
}

function parseAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100) / 100
}

function isExistingDraftChanged(draft: IncomeDraft, record: IncomeRecord | undefined): boolean {
  if (!record) return true
  return (
    draft.occurredAt !== record.occurredAt ||
    parseAmount(draft.amount) !== record.amount ||
    draft.category !== record.category ||
    draft.sourceName !== (record.sourceName || '') ||
    draft.note !== (record.note || '')
  )
}

function buildPayload(draft: IncomeDraft) {
  const amount = parseAmount(draft.amount)
  const occurredAt = normalizeIncomeDateInput(draft.occurredAt)
  if (!occurredAt) throw new Error(`${draft.rowLabel}的发生日期格式无效`)
  if (amount === null) throw new Error(`${draft.rowLabel}的金额必须是大于等于 0 的数字`)

  return {
    occurredAt,
    category: draft.category,
    amount,
    ...(draft.sourceName.trim() ? { sourceName: draft.sourceName.trim() } : {}),
    ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
  }
}

export default function IncomeManagementPage() {
  const { toast } = useFeedback()
  const [records, setRecords] = useState<IncomeRecord[]>([])
  const [drafts, setDrafts] = useState<IncomeDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')
  const [filterCategory, setFilterCategory] = useState<IncomeCategory | 'all'>('all')
  const [filterSource, setFilterSource] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const loaded = await api.getIncomeRecords()
      const sorted = [...loaded].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      setRecords(sorted)
      setDrafts(sorted.map(recordToDraft))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const recordById = useMemo(
    () => new Map(records.map((record) => [record.id, record])),
    [records],
  )

  const dirtyDrafts = useMemo(
    () => drafts.filter((draft) => (
      !draft.id || draft.pendingDelete || isExistingDraftChanged(draft, recordById.get(draft.id))
    )),
    [drafts, recordById],
  )

  const normalizedFilterStart = filterStart.trim()
    ? normalizeIncomeDateInput(filterStart)
    : undefined
  const normalizedFilterEnd = filterEnd.trim()
    ? normalizeIncomeDateInput(filterEnd)
    : undefined
  const filterStartInvalid = filterStart.trim() !== '' && !normalizedFilterStart
  const filterEndInvalid = filterEnd.trim() !== '' && !normalizedFilterEnd
  const normalizedSourceFilter = filterSource.trim().toLocaleLowerCase('zh-CN')

  const visibleDrafts = useMemo(() => drafts.filter((draft) => {
    const occurredAt = normalizeIncomeDateInput(draft.occurredAt)
    if (normalizedFilterStart && (!occurredAt || occurredAt < normalizedFilterStart)) return false
    if (normalizedFilterEnd && (!occurredAt || occurredAt > normalizedFilterEnd)) return false
    if (filterCategory !== 'all' && draft.category !== filterCategory) return false
    if (
      normalizedSourceFilter &&
      !draft.sourceName.toLocaleLowerCase('zh-CN').includes(normalizedSourceFilter)
    ) return false
    return true
  }), [
    drafts,
    filterCategory,
    normalizedFilterEnd,
    normalizedFilterStart,
    normalizedSourceFilter,
  ])

  function updateDraft<K extends keyof IncomeDraft>(localId: string, key: K, value: IncomeDraft[K]) {
    setDrafts((current) => current.map((draft) => (
      draft.localId === localId ? { ...draft, [key]: value } : draft
    )))
  }

  function addRow() {
    setDrafts((current) => [...current, createNewDraft()])
  }

  function toggleDelete(draft: IncomeDraft) {
    if (!draft.id) {
      setDrafts((current) => current.filter((item) => item.localId !== draft.localId))
      return
    }
    updateDraft(draft.localId, 'pendingDelete', !draft.pendingDelete)
  }

  function discardChanges() {
    setDrafts(records.map(recordToDraft))
  }

  function normalizeDraftDate(draft: IncomeDraft) {
    const normalized = normalizeIncomeDateInput(draft.occurredAt)
    if (normalized) updateDraft(draft.localId, 'occurredAt', normalized)
  }

  function normalizeFilterDate(value: string, setter: (next: string) => void) {
    if (!value.trim()) return
    const normalized = normalizeIncomeDateInput(value)
    if (normalized) setter(normalized)
  }

  function clearFilters() {
    setFilterStart('')
    setFilterEnd('')
    setFilterCategory('all')
    setFilterSource('')
  }

  async function saveChanges() {
    const changedRows = dirtyDrafts.filter((draft) => !draft.pendingDelete)
    let payloads: Array<{ draft: IncomeDraft; payload: ReturnType<typeof buildPayload> }>

    try {
      payloads = changedRows.map((draft) => ({ draft, payload: buildPayload(draft) }))
    } catch (e: any) {
      toast(e.message, 'error')
      return
    }

    setSaving(true)
    try {
      for (const { draft, payload } of payloads) {
        if (draft.id) {
          await api.updateIncomeRecord(draft.id, payload)
        } else {
          await api.createIncomeRecord(payload)
        }
      }
      for (const draft of dirtyDrafts.filter((item) => item.id && item.pendingDelete)) {
        await api.deleteIncomeRecord(draft.id!)
      }
      toast(`已保存 ${dirtyDrafts.length} 条收入变更`)
      await load()
    } catch (e: any) {
      toast('保存收入失败: ' + e.message, 'error')
    } finally {
      setSaving(false)
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
      <TableWorkspace
        title="收入"
        description="收入事件表｜一行一笔流入，修改后统一保存"
        dirtyCount={dirtyDrafts.length}
        saving={saving}
        primaryActionLabel={saving ? '保存中...' : '保存收入'}
        onPrimaryAction={saveChanges}
        secondaryActions={(
          <>
            <span className="income-record-count">{records.length} 条已保存</span>
            <button className="btn-secondary" type="button" onClick={addRow}>
              新增行
            </button>
            <button
              className="btn-secondary"
              type="button"
              disabled={dirtyDrafts.length === 0 || saving}
              onClick={discardChanges}
            >
              放弃修改
            </button>
          </>
        )}
      >
        <div className="income-filter-bar" aria-label="收入筛选">
          <label className="income-filter-field">
            <span>开始日期</span>
            <input
              aria-label="开始日期"
              className={filterStartInvalid ? 'is-invalid' : ''}
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={filterStart}
              aria-invalid={filterStartInvalid}
              onChange={(event) => setFilterStart(event.target.value)}
              onBlur={() => normalizeFilterDate(filterStart, setFilterStart)}
            />
          </label>
          <label className="income-filter-field">
            <span>结束日期</span>
            <input
              aria-label="结束日期"
              className={filterEndInvalid ? 'is-invalid' : ''}
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={filterEnd}
              aria-invalid={filterEndInvalid}
              onChange={(event) => setFilterEnd(event.target.value)}
              onBlur={() => normalizeFilterDate(filterEnd, setFilterEnd)}
            />
          </label>
          <label className="income-filter-field">
            <span>分类</span>
            <select
              aria-label="收入分类"
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value as IncomeCategory | 'all')}
            >
              <option value="all">全部分类</option>
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="income-filter-field income-filter-source">
            <span>来源</span>
            <input
              aria-label="来源关键词"
              type="search"
              placeholder="输入来源关键词"
              value={filterSource}
              onChange={(event) => setFilterSource(event.target.value)}
            />
          </label>
          <span className="income-filter-result">显示 {visibleDrafts.length} / {drafts.length} 条</span>
          <button className="btn-link" type="button" onClick={clearFilters}>
            清除筛选
          </button>
        </div>
        <div className="income-table-scroll">
          <table className="fin-table income-workbook-table" aria-label="收入记录">
            <thead>
              <tr>
                <th>发生日期</th>
                <th>分类</th>
                <th className="align-right">金额</th>
                <th>来源</th>
                <th>备注</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleDrafts.length === 0 ? (
                <tr>
                  <td className="income-table-empty" colSpan={7}>
                    {drafts.length === 0
                      ? '暂无收入记录，点击“新增行”开始录入。'
                      : '没有符合当前筛选条件的收入。'}
                  </td>
                </tr>
              ) : visibleDrafts.map((draft) => {
                const changed = Boolean(draft.id && isExistingDraftChanged(draft, recordById.get(draft.id)))
                const dateInvalid = normalizeIncomeDateInput(draft.occurredAt) === null
                const status = draft.pendingDelete
                  ? '待删除'
                  : dateInvalid
                    ? '日期错误'
                    : !draft.id
                      ? '新增'
                      : changed
                        ? '已修改'
                        : '-'
                const restricted = isRestrictedIncomeCategory(draft.category)

                return (
                  <tr
                    className={`${draft.pendingDelete ? 'is-pending-delete' : ''} ${!draft.id ? 'is-new-row' : ''}`.trim()}
                    key={draft.localId}
                  >
                    <td>
                      <input
                        aria-label={`${draft.rowLabel} 日期`}
                        className={dateInvalid ? 'is-invalid' : ''}
                        type="text"
                        inputMode="numeric"
                        placeholder="YYYY-MM-DD"
                        value={draft.occurredAt}
                        aria-invalid={dateInvalid}
                        disabled={draft.pendingDelete}
                        onChange={(event) => updateDraft(draft.localId, 'occurredAt', event.target.value)}
                        onBlur={() => normalizeDraftDate(draft)}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`${draft.rowLabel} 分类`}
                        value={draft.category}
                        disabled={draft.pendingDelete}
                        onChange={(event) => updateDraft(
                          draft.localId,
                          'category',
                          event.target.value as IncomeCategory,
                        )}
                      >
                        {CATEGORY_OPTIONS.map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                      {restricted && <span className="income-restricted-mark">受限</span>}
                    </td>
                    <td>
                      <input
                        className="income-amount-input"
                        aria-label={`${draft.rowLabel} 金额`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.amount}
                        disabled={draft.pendingDelete}
                        onChange={(event) => updateDraft(draft.localId, 'amount', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${draft.rowLabel} 来源`}
                        type="text"
                        value={draft.sourceName}
                        disabled={draft.pendingDelete}
                        placeholder="可选"
                        onChange={(event) => updateDraft(draft.localId, 'sourceName', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${draft.rowLabel} 备注`}
                        type="text"
                        value={draft.note}
                        disabled={draft.pendingDelete}
                        placeholder="可选"
                        onChange={(event) => updateDraft(draft.localId, 'note', event.target.value)}
                      />
                    </td>
                    <td>
                      <span className={`income-row-status status-${status === '-' ? 'clean' : 'dirty'}`}>
                        {status}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn-link ${draft.pendingDelete ? '' : 'danger-link'}`}
                        type="button"
                        aria-label={`${draft.pendingDelete ? '撤销删除' : '标记删除'} ${draft.rowLabel}`}
                        onClick={() => toggleDelete(draft)}
                      >
                        {draft.pendingDelete ? '撤销' : !draft.id ? '移除' : '删除'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWorkspace>
    </div>
  )
}
