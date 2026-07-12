/**
 * @vitest-environment jsdom
 */
import { forwardRef, StrictMode, useImperativeHandle } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import type { IncomeSheetHandle } from '../components/IncomeSheet'
import { recordsToIncomeSheetRows } from './incomeSheetAdapter'
import IncomeManagementPage from './IncomeManagementPage'

const sheetHandle = {
  reset: vi.fn(),
  focusCell: vi.fn(),
  setEditable: vi.fn(),
}

vi.mock('../components/IncomeSheet', () => ({
  default: forwardRef<IncomeSheetHandle, any>(function FakeIncomeSheet(props, ref) {
    useImperativeHandle(ref, () => sheetHandle)
    const baseRows = recordsToIncomeSheetRows(props.records)
    return (
      <div data-testid="income-sheet">
        <button
          type="button"
          onClick={() => props.onRowsChange(baseRows.map((row) => (
            row.rowKey === 'salary-1' ? { ...row, amount: '12000' } : row
          )))}
        >
          模拟修改
        </button>
        <button
          type="button"
          onClick={() => props.onRowsChange(baseRows.map((row) => (
            row.rowKey === 'salary-1' ? { ...row, amount: '-1' } : row
          )))}
        >
          模拟非法金额
        </button>
      </div>
    )
  }),
}))

vi.mock('../api/client', () => ({
  api: {
    getIncomeRecords: vi.fn(),
    saveIncomeRecords: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api)
const records = [
  {
    id: 'salary-1',
    occurredAt: '2026-07-01',
    category: 'salary' as const,
    amount: 10000,
    sourceName: '公司',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'bonus-1',
    occurredAt: '2026-07-02',
    category: 'bonus' as const,
    amount: 1000,
    createdAt: '2026-07-02T00:00:00.000Z',
    updatedAt: '2026-07-02T00:00:00.000Z',
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <FeedbackProvider>
        <IncomeManagementPage />
      </FeedbackProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.getIncomeRecords.mockResolvedValue(records)
  mockedApi.saveIncomeRecords.mockResolvedValue({ records })
})

afterEach(() => cleanup())

describe('IncomeManagementPage', () => {
  it('renders the Univer income sheet with explicit batch save controls', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: '收入' })).toBeTruthy()
    expect(screen.getByTestId('income-sheet')).toBeTruthy()
    expect(screen.queryByRole('table', { name: '收入记录' })).toBeNull()
    expect(screen.queryByLabelText('开始日期')).toBeNull()
    expect(screen.getByText('2 条已保存')).toBeTruthy()
    expect((screen.getByRole('button', { name: '保存收入' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('submits edited rows through one atomic batch request', async () => {
    renderPage()
    await screen.findByTestId('income-sheet')

    fireEvent.click(screen.getByRole('button', { name: '模拟修改' }))
    expect(screen.getByText('1 项未保存')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    await waitFor(() => expect(mockedApi.saveIncomeRecords).toHaveBeenCalledWith({
      creates: [],
      updates: [{
        id: 'salary-1',
        occurredAt: '2026-07-01',
        category: 'salary',
        amount: 12000,
        sourceName: '公司',
      }],
      deletes: [],
    }))
    expect(mockedApi.saveIncomeRecords).toHaveBeenCalledTimes(1)
    expect(mockedApi.getIncomeRecords).toHaveBeenCalledTimes(2)
    expect(sheetHandle.setEditable).toHaveBeenNthCalledWith(1, false)
    expect(sheetHandle.setEditable).toHaveBeenLastCalledWith(true)
  })

  it('focuses the invalid cell and does not call the API', async () => {
    renderPage()
    await screen.findByTestId('income-sheet')

    fireEvent.click(screen.getByRole('button', { name: '模拟非法金额' }))
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    expect(await screen.findByText(/金额必须是大于等于 0 的数字/)).toBeTruthy()
    expect(sheetHandle.focusCell).toHaveBeenCalledWith(1, 'amount')
    expect(mockedApi.saveIncomeRecords).not.toHaveBeenCalled()
  })

  it('discards worksheet changes back to the saved baseline', async () => {
    renderPage()
    await screen.findByTestId('income-sheet')

    fireEvent.click(screen.getByRole('button', { name: '模拟修改' }))
    expect(screen.getByText('1 项未保存')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '放弃修改' }))

    expect(sheetHandle.reset).toHaveBeenCalledWith([records[1], records[0]])
    expect(screen.queryByText('1 项未保存')).toBeNull()
  })

  it('keeps dirty worksheet state when the batch save fails', async () => {
    mockedApi.saveIncomeRecords.mockRejectedValueOnce(new Error('网络错误'))
    renderPage()
    await screen.findByTestId('income-sheet')

    fireEvent.click(screen.getByRole('button', { name: '模拟修改' }))
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    expect(await screen.findByText(/保存收入失败: 网络错误/)).toBeTruthy()
    expect(screen.getByText('1 项未保存')).toBeTruthy()
    expect(mockedApi.getIncomeRecords).toHaveBeenCalledTimes(1)
  })

  it('ignores a stale initial load that resolves after the latest request', async () => {
    let resolveFirst!: (value: typeof records) => void
    let resolveSecond!: (value: typeof records) => void
    mockedApi.getIncomeRecords
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve }))

    render(
      <StrictMode>
        <MemoryRouter>
          <FeedbackProvider>
            <IncomeManagementPage />
          </FeedbackProvider>
        </MemoryRouter>
      </StrictMode>,
    )

    await act(async () => resolveSecond([records[0]]))
    expect(await screen.findByText('1 条已保存')).toBeTruthy()
    await act(async () => resolveFirst(records))

    expect(screen.getByText('1 条已保存')).toBeTruthy()
    expect(screen.queryByText('2 条已保存')).toBeNull()
  })
})
