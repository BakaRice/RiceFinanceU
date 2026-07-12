import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import IncomeSheet, { type IncomeSheetHandle } from '../components/IncomeSheet'
import { useFeedback } from '../components/Feedback/FeedbackContext'
import TableWorkspace from '../components/TableWorkspace'
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
  const [records, setRecords] = useState<IncomeRecord[]>([])
  const [sheetRows, setSheetRows] = useState<IncomeSheetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const loaded = await api.getIncomeRecords()
      const sorted = [...loaded].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      setRecords(sorted)
      setSheetRows(recordsToIncomeSheetRows(sorted))
    } catch (loadError: any) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  const dirtyCount = useMemo(
    () => countIncomeChanges(records, sheetRows),
    [records, sheetRows],
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
    setSaving(true)
    try {
      await api.saveIncomeRecords(batch)
      toast(`已保存 ${dirtyCount} 条收入变更`)
      await load()
    } catch (saveError: any) {
      toast('保存收入失败: ' + saveError.message, 'error')
    } finally {
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
