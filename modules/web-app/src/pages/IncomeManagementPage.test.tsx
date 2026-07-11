/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  it('summarizes income records and renders monthly trend plus history table', async () => {
    const { container } = renderIncomeManagementPage()

    expect(await screen.findByRole('heading', { name: '收入管理' })).toBeTruthy()
    expect(screen.getByText('近 12 个月可支配收入')).toBeTruthy()
    expect(container.textContent).toContain('15,500.00')
    expect(screen.getByText('近 12 个月受限收入')).toBeTruthy()
    expect(container.textContent).toContain('1,800.00')
    expect(screen.getByText('近 12 个月总流入')).toBeTruthy()
    expect(container.textContent).toContain('17,300.00')
    expect(screen.getByText('有记录月均')).toBeTruthy()
    expect(container.textContent).toContain('8,650.00')
    expect(screen.getAllByText('不可支配').length).toBeGreaterThan(0)
    expect(screen.getByText('主要类别')).toBeTruthy()
    expect(screen.getAllByText('工资').length).toBeGreaterThan(0)
    expect(screen.getByTestId('income-line-chart').getAttribute('data-point-labels')).toBe('2026-06|2026-07')
    expect(screen.getByRole('button', { name: '编辑 2026-07-05 工资' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '删除 2026-07-05 工资' })).toBeTruthy()
  })

  it('creates a new income record', async () => {
    renderIncomeManagementPage()

    await screen.findByRole('heading', { name: '收入管理' })
    fireEvent.click(screen.getByRole('button', { name: '记录收入' }))
    fireEvent.change(screen.getByLabelText('发生日期'), { target: { value: '2026-07-25' } })
    fireEvent.change(screen.getByLabelText('分类'), { target: { value: 'side_income' } })
    fireEvent.change(screen.getByLabelText('金额'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('来源'), { target: { value: '顾问费' } })
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: '周末项目' } })
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    await waitFor(() => {
      expect(mockedApi.createIncomeRecord).toHaveBeenCalledWith(expect.objectContaining({
        occurredAt: '2026-07-25',
        category: 'side_income',
        amount: 500,
        sourceName: '顾问费',
        note: '周末项目',
      }))
    })
  })

  it('updates and deletes historical income records', async () => {
    renderIncomeManagementPage()

    await screen.findByRole('heading', { name: '收入管理' })
    fireEvent.click(screen.getByRole('button', { name: '编辑 2026-07-05 工资' }))
    fireEvent.change(screen.getByLabelText('金额'), { target: { value: '12500' } })
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    await waitFor(() => {
      expect(mockedApi.updateIncomeRecord).toHaveBeenCalledWith('salary-1', expect.objectContaining({
        amount: 12500,
        category: 'salary',
      }))
    })

    fireEvent.click(screen.getByRole('button', { name: '删除 2026-07-05 工资' }))
    fireEvent.click(await screen.findByRole('button', { name: '删除' }))

    await waitFor(() => {
      expect(mockedApi.deleteIncomeRecord).toHaveBeenCalledWith('salary-1')
    })
  })
})
