import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import IncomeSheet, { type IncomeSheetHandle } from '../components/IncomeSheet'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import TableWorkspace from '../components/TableWorkspace'
import { useUnsavedChangesWarning } from '../components/useUnsavedChangesWarning'
import type { IncomeRecord } from '../types/finance'
import {
  buildIncomeBatch,
  countIncomeChanges,
  IncomeSheetValidationError,
  recordsToIncomeSheetRows,
  type IncomeSheetRow,
} from './incomeSheetAdapter'
import './IncomeManagementPage.css'

export default function IncomeManagementPage() {
  const { toast } = useFeedback()
  const sheetRef = useRef<IncomeSheetHandle>(null)
  const loadRequestRef = useRef(0)
  const [records, setRecords] = useState<IncomeRecord[]>([])
  const [sheetRows, setSheetRows] = useState<IncomeSheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    const requestId = ++loadRequestRef.current
    setLoading(true)
    setError(null)
    try {
      const loaded = await api.getIncomeRecords()
      if (requestId !== loadRequestRef.current) return
      const sorted = [...loaded].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      setRecords(sorted)
      setSheetRows(recordsToIncomeSheetRows(sorted))
    } catch (loadError: any) {
      if (requestId !== loadRequestRef.current) return
      setError(loadError.message)
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false)
    }
  }

  const dirtyCount = useMemo(
    () => countIncomeChanges(records, sheetRows),
    [records, sheetRows],
  )
  useUnsavedChangesWarning(
    dirtyCount > 0,
    '收入修改尚未保存，离开后会丢失。确定要离开吗？',
  )

  function discardChanges() {
    const baseline = recordsToIncomeSheetRows(records)
    setSheetRows(baseline)
    sheetRef.current?.reset(records)
  }

  async function saveChanges() {
    let batch
    try {
      batch = buildIncomeBatch(records, sheetRows)
    } catch (validationError) {
      if (validationError instanceof IncomeSheetValidationError) {
        sheetRef.current?.focusCell(validationError.row, validationError.column)
        toast(validationError.message, 'error')
        return
      }
      throw validationError
    }

    if (dirtyCount === 0) return
    sheetRef.current?.setEditable(false)
    setSaving(true)
    try {
      const result = await api.saveIncomeRecords(batch)
      const savedRecords = [...result.records]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      sheetRef.current?.reset(savedRecords)
      setRecords(savedRecords)
      setSheetRows(recordsToIncomeSheetRows(savedRecords))
      toast(`已保存 ${dirtyCount} 条收入变更`)
    } catch (saveError: any) {
      toast('保存收入失败: ' + saveError.message, 'error')
    } finally {
      sheetRef.current?.setEditable(true)
      setSaving(false)
    }
  }

  if (loading) return <div className="page-loading">加载中...</div>
  if (error) {
    return (
      <div className="page-error">
        <p>{error}</p>
        <button type="button" onClick={() => void load()}>重试</button>
      </div>
    )
  }

  return (
    <div className="income-management-page">
      <TableWorkspace
        title="收入"
        description="收入事件表｜支持复制粘贴、批量操作，修改后统一保存"
        dirtyCount={dirtyCount}
        saving={saving}
        primaryActionLabel={saving ? '保存中...' : '保存收入'}
        onPrimaryAction={() => void saveChanges()}
        secondaryActions={(
          <>
            <span className="income-record-count">{records.length} 条已保存</span>
            <button
              className="btn-secondary"
              type="button"
              disabled={dirtyCount === 0 || saving}
              onClick={discardChanges}
            >
              放弃修改
            </button>
          </>
        )}
      >
        <IncomeSheet
          ref={sheetRef}
          records={records}
          onRowsChange={setSheetRows}
        />
      </TableWorkspace>
    </div>
  )
}
