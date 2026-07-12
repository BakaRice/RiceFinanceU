/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import IncomeManagementPage from './IncomeManagementPage'

vi.mock('../api/client', () => ({
  api: {
    getIncomeRecords: vi.fn(),
    createIncomeRecord: vi.fn(),
    updateIncomeRecord: vi.fn(),
    deleteIncomeRecord: vi.fn(),
  },
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ data, children }: any) => (
    <div
      data-testid="income-line-chart"
      data-point-count={data.length}
      data-point-labels={data.map((point: any) => point.month).join('|')}
    >
      {children}
    </div>
  ),
  Line: ({ dataKey, name }: any) => <div data-testid={`line-${dataKey}`}>{name}</div>,
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis">{dataKey}</div>,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}))

const mockedApi = vi.mocked(api)

function renderIncomeManagementPage() {
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
  mockedApi.getIncomeRecords.mockResolvedValue([
    {
      id: 'salary-1',
      occurredAt: '2026-07-05',
      amount: 12000,
      category: 'salary',
      sourceName: '公司',
      note: '7月工资',
      createdAt: '2026-07-05T00:00:00.000Z',
      updatedAt: '2026-07-05T00:00:00.000Z',
    },
    {
      id: 'bonus-1',
      occurredAt: '2026-07-20',
      amount: 3000,
      category: 'bonus',
      sourceName: '季度奖金',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    },
    {
      id: 'fund-1',
      occurredAt: '2026-07-10',
      amount: 1800,
      category: 'housing_fund',
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    },
    {
      id: 'side-1',
      occurredAt: '2026-06-10',
      amount: 500,
      category: 'side_income',
      createdAt: '2026-06-10T00:00:00.000Z',
      updatedAt: '2026-06-10T00:00:00.000Z',
    },
    {
      id: 'old-income-1',
      occurredAt: '2025-06-10',
      amount: 9000,
      category: 'other',
      createdAt: '2025-06-10T00:00:00.000Z',
      updatedAt: '2025-06-10T00:00:00.000Z',
    },
  ] as any)
  mockedApi.createIncomeRecord.mockResolvedValue({
    id: 'new-income',
    occurredAt: '2026-07-25',
    amount: 500,
    category: 'side_income',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
  } as any)
  mockedApi.updateIncomeRecord.mockResolvedValue({
    id: 'salary-1',
    occurredAt: '2026-07-05',
    amount: 12500,
    category: 'salary',
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
  } as any)
  mockedApi.deleteIncomeRecord.mockResolvedValue({ success: true })
})

afterEach(() => {
  cleanup()
})

describe('IncomeManagementPage', () => {
  it('renders income records as one editable workbook table', async () => {
    renderIncomeManagementPage()

    expect(await screen.findByRole('heading', { name: '收入' })).toBeTruthy()
    expect(screen.getByText(/收入事件表/)).toBeTruthy()
    expect(screen.queryByText('月度收入趋势')).toBeNull()
    expect(screen.queryByText('近 12 个月可支配收入')).toBeNull()
    expect(screen.getByRole('table', { name: '收入记录' })).toBeTruthy()
    expect((screen.getByLabelText('2026-07-05 工资 金额') as HTMLInputElement).value).toBe('12000')
    expect((screen.getByRole('button', { name: '保存收入' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('accepts typed date formats and normalizes them on blur', async () => {
    renderIncomeManagementPage()

    await screen.findByRole('heading', { name: '收入' })
    const dateInput = screen.getByLabelText('2026-07-05 工资 日期') as HTMLInputElement
    expect(dateInput.type).toBe('text')
    fireEvent.change(dateInput, { target: { value: '2026年7月6日' } })
    fireEvent.blur(dateInput)

    expect(dateInput.value).toBe('2026-07-06')
    expect(dateInput.getAttribute('aria-invalid')).toBe('false')
  })

  it('marks impossible typed dates and blocks saving', async () => {
    renderIncomeManagementPage()

    await screen.findByRole('heading', { name: '收入' })
    const dateInput = screen.getByLabelText('2026-07-05 工资 日期') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2026-02-30' } })
    fireEvent.blur(dateInput)

    expect(dateInput.getAttribute('aria-invalid')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))
    expect(await screen.findByText(/发生日期格式无效/)).toBeTruthy()
    expect(mockedApi.updateIncomeRecord).not.toHaveBeenCalled()
  })

  it('filters visible rows by date range, category, and source without changing drafts', async () => {
    renderIncomeManagementPage()

    await screen.findByRole('heading', { name: '收入' })
    const table = screen.getByRole('table', { name: '收入记录' })
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026/7/10' } })
    fireEvent.blur(screen.getByLabelText('开始日期'))
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2026/7/20' } })
    fireEvent.blur(screen.getByLabelText('结束日期'))

    expect(screen.getByText('显示 2 / 5 条')).toBeTruthy()
    expect(within(table).getByLabelText('2026-07-20 奖金 金额')).toBeTruthy()
    expect(within(table).getByLabelText('2026-07-10 公积金 金额')).toBeTruthy()
    expect(within(table).queryByLabelText('2026-07-05 工资 金额')).toBeNull()

    fireEvent.change(screen.getByLabelText('收入分类'), { target: { value: 'housing_fund' } })
    expect(screen.getByText('显示 1 / 5 条')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }))
    fireEvent.change(screen.getByLabelText('来源关键词'), { target: { value: '公司' } })
    expect(screen.getByText('显示 1 / 5 条')).toBeTruthy()
    expect(within(table).getByLabelText('2026-07-05 工资 金额')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '清除筛选' }))
    expect(screen.getByText('显示 5 / 5 条')).toBeTruthy()
    expect(screen.queryByText(/项未保存/)).toBeNull()
  })

  it('edits a row inline and saves the changed income record', async () => {
    renderIncomeManagementPage()

    await screen.findByRole('heading', { name: '收入' })
    fireEvent.change(screen.getByLabelText('2026-07-05 工资 金额'), {
      target: { value: '12500' },
    })
    expect(screen.getByText('1 项未保存')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    await waitFor(() => {
      expect(mockedApi.updateIncomeRecord).toHaveBeenCalledWith('salary-1', {
        occurredAt: '2026-07-05',
        category: 'salary',
        amount: 12500,
        sourceName: '公司',
        note: '7月工资',
      })
    })
  })

  it('adds multiple rows directly in the sheet and saves them together', async () => {
    renderIncomeManagementPage()

    await screen.findByRole('heading', { name: '收入' })
    fireEvent.click(screen.getByRole('button', { name: '新增行' }))
    fireEvent.click(screen.getByRole('button', { name: '新增行' }))
    fireEvent.change(screen.getByLabelText('新增收入 1 日期'), { target: { value: '2026-07-25' } })
    fireEvent.change(screen.getByLabelText('新增收入 1 分类'), { target: { value: 'side_income' } })
    fireEvent.change(screen.getByLabelText('新增收入 1 金额'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('新增收入 1 来源'), { target: { value: '顾问费' } })
    fireEvent.change(screen.getByLabelText('新增收入 2 日期'), { target: { value: '2026-07-26' } })
    fireEvent.change(screen.getByLabelText('新增收入 2 分类'), { target: { value: 'housing_fund' } })
    fireEvent.change(screen.getByLabelText('新增收入 2 金额'), { target: { value: '1800' } })
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    await waitFor(() => {
      expect(mockedApi.createIncomeRecord).toHaveBeenCalledTimes(2)
    })
    expect(mockedApi.createIncomeRecord).toHaveBeenNthCalledWith(1, {
      occurredAt: '2026-07-25',
      category: 'side_income',
      amount: 500,
      sourceName: '顾问费',
    })
    expect(mockedApi.createIncomeRecord).toHaveBeenNthCalledWith(2, {
      occurredAt: '2026-07-26',
      category: 'housing_fund',
      amount: 1800,
    })
  })

  it('marks existing rows for deletion and can discard all changes', async () => {
    renderIncomeManagementPage()

    await screen.findByRole('heading', { name: '收入' })
    fireEvent.click(screen.getByRole('button', { name: '标记删除 2026-07-05 工资' }))
    expect(screen.getByText('待删除')).toBeTruthy()
    expect(screen.getByText('1 项未保存')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '放弃修改' }))
    expect(screen.queryByText('待删除')).toBeNull()
    expect(screen.queryByText('1 项未保存')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '标记删除 2026-07-05 工资' }))
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    await waitFor(() => {
      expect(mockedApi.deleteIncomeRecord).toHaveBeenCalledWith('salary-1')
    })
  })
})
