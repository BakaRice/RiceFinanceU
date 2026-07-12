import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { IncomeSheetColumn, IncomeSheetRow } from '../pages/incomeSheetAdapter'
import type { IncomeRecord } from '../types/finance'
import { createIncomeSheetRuntime, type IncomeSheetRuntime } from './incomeSheetRuntime'
import './IncomeSheet.css'

export type IncomeSheetHandle = {
  reset(records: IncomeRecord[]): void
  focusCell(row: number, column: IncomeSheetColumn): void
}

type IncomeSheetProps = {
  records: IncomeRecord[]
  onRowsChange(rows: IncomeSheetRow[]): void
}

const IncomeSheet = forwardRef<IncomeSheetHandle, IncomeSheetProps>(function IncomeSheet(
  { records, onRowsChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<IncomeSheetRuntime | null>(null)
  const mountedRecordsRef = useRef(records)
  const onRowsChangeRef = useRef(onRowsChange)
  onRowsChangeRef.current = onRowsChange

  useImperativeHandle(ref, () => ({
    reset(nextRecords) {
      runtimeRef.current?.setRecords(nextRecords)
    },
    focusCell(row, column) {
      runtimeRef.current?.focusCell(row, column)
    },
  }), [])

  useEffect(() => {
    if (!containerRef.current) return
    const runtime = createIncomeSheetRuntime({
      container: containerRef.current,
      onRowsChange: (rows) => onRowsChangeRef.current(rows),
    })
    runtimeRef.current = runtime
    runtime.setRecords(records)
    const syncTheme = () => runtime.setDarkMode(document.documentElement.dataset.theme === 'dark')
    syncTheme()
    const themeObserver = new MutationObserver(syncTheme)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => {
      themeObserver.disconnect()
      runtime.dispose()
      runtimeRef.current = null
    }
  }, [])

  useEffect(() => {
    if (records === mountedRecordsRef.current) return
    runtimeRef.current?.setRecords(records)
  }, [records])

  return <div className="income-sheet" data-testid="income-sheet" ref={containerRef} />
})

export default IncomeSheet
