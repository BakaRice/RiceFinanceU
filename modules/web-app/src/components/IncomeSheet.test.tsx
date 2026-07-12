/**
 * @vitest-environment jsdom
 */
import { act, createRef } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IncomeRecord } from '../types/finance'
import type { IncomeSheetRow } from '../pages/incomeSheetAdapter'
import IncomeSheet, { type IncomeSheetHandle } from './IncomeSheet'
import { createIncomeSheetRuntime } from './incomeSheetRuntime'

vi.mock('./incomeSheetRuntime', () => ({
  createIncomeSheetRuntime: vi.fn(),
}))

const mockedCreateRuntime = vi.mocked(createIncomeSheetRuntime)

const records: IncomeRecord[] = [{
  id: 'salary-1',
  occurredAt: '2026-07-01',
  category: 'salary',
  amount: 10000,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}]

describe('IncomeSheet', () => {
  const runtime = {
    setRecords: vi.fn(),
    focusCell: vi.fn(),
    dispose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockedCreateRuntime.mockReturnValue(runtime)
  })

  afterEach(() => cleanup())

  it('owns one runtime and disposes it on unmount', () => {
    const onRowsChange = vi.fn()
    const view = render(<IncomeSheet records={records} onRowsChange={onRowsChange} />)

    expect(mockedCreateRuntime).toHaveBeenCalledTimes(1)
    expect(mockedCreateRuntime).toHaveBeenCalledWith(expect.objectContaining({
      container: expect.any(HTMLDivElement),
      onRowsChange: expect.any(Function),
    }))
    expect(runtime.setRecords).toHaveBeenCalledTimes(1)
    expect(runtime.setRecords).toHaveBeenCalledWith(records)

    view.unmount()
    expect(runtime.dispose).toHaveBeenCalledTimes(1)
  })

  it('publishes runtime changes and exposes reset and error focus', () => {
    const ref = createRef<IncomeSheetHandle>()
    const onRowsChange = vi.fn()
    render(<IncomeSheet ref={ref} records={records} onRowsChange={onRowsChange} />)
    const runtimeOptions = mockedCreateRuntime.mock.calls[0][0]
    const changedRows: IncomeSheetRow[] = [{
      rowKey: 'salary-1',
      occurredAt: '2026-07-01',
      category: 'salary',
      amount: '12000',
      sourceName: '',
      note: '',
    }]

    act(() => runtimeOptions.onRowsChange(changedRows))
    expect(onRowsChange).toHaveBeenCalledWith(changedRows)

    act(() => ref.current?.reset(records))
    expect(runtime.setRecords).toHaveBeenLastCalledWith(records)

    act(() => ref.current?.focusCell(2, 'amount'))
    expect(runtime.focusCell).toHaveBeenCalledWith(2, 'amount')
  })
})
