/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import DashboardPage from './DashboardPage'

vi.mock('../api/client', () => ({
  api: {
    getAssets: vi.fn(),
    getLatestSnapshot: vi.fn(),
    getSnapshots: vi.fn(),
    getSnapshotValues: vi.fn(),
    getIncomeRecords: vi.fn(),
    getMonthlyIncomes: vi.fn(),
    getRates: vi.fn(),
    deleteSnapshot: vi.fn(),
    updateRates: vi.fn(),
    createIncomeRecord: vi.fn(),
    updateIncomeRecord: vi.fn(),
    deleteIncomeRecord: vi.fn(),
    createMonthlyIncome: vi.fn(),
    updateMonthlyIncome: vi.fn(),
    deleteMonthlyIncome: vi.fn(),
  },
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ data, children }: any) => (
    <div
      data-testid="line-chart"
      data-point-count={data.length}
      data-point-labels={data.map((point: any) => point.periodLabel).join('|')}
    >
      {children}
    </div>
  ),
  Line: ({ dataKey, name, yAxisId }: any) => (
    <div data-testid={`line-${dataKey}`} data-y-axis-id={yAxisId || ''}>{name}</div>
  ),
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis">{dataKey}</div>,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}))

const mockedApi = vi.mocked(api)

afterEach(() => {
  cleanup()
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <FeedbackProvider>
        <DashboardPage />
      </FeedbackProvider>
    </MemoryRouter>,
  )
}

describe('DashboardPage trend scale controls', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const assets = [
      {
        id: 'fund',
        name: '指数基金',
        type: 'fund',
        currency: 'CNY',
        isActive: true,
        createdAt: '2026-01-01T00:00:00',
        updatedAt: '2026-01-01T00:00:00',
      },
      {
        id: 'cash',
        name: '现金',
        type: 'cash',
        currency: 'CNY',
        isActive: true,
        createdAt: '2026-01-01T00:00:00',
        updatedAt: '2026-01-01T00:00:00',
      },
    ]
    const snapshots = [
      { id: 's1', recordedAt: '2026-07-05T09:00:00', createdAt: '2026-07-05T09:00:00' },
      { id: 's2', recordedAt: '2026-07-05T21:00:00', createdAt: '2026-07-05T21:00:00' },
      { id: 's3', recordedAt: '2026-07-08T10:00:00', createdAt: '2026-07-08T10:00:00' },
      { id: 's4', recordedAt: '2026-10-02T10:00:00', createdAt: '2026-10-02T10:00:00' },
    ]
    const snapshotValues = [
      { id: 'v1', snapshotId: 's1', assetId: 'fund', amount: 100 },
      { id: 'v2', snapshotId: 's1', assetId: 'cash', amount: 50 },
      { id: 'v3', snapshotId: 's2', assetId: 'fund', amount: 120 },
      { id: 'v4', snapshotId: 's2', assetId: 'cash', amount: 50 },
      { id: 'v5', snapshotId: 's3', assetId: 'fund', amount: 200 },
      { id: 'v6', snapshotId: 's3', assetId: 'cash', amount: 50 },
      { id: 'v7', snapshotId: 's4', assetId: 'fund', amount: 300 },
      { id: 'v8', snapshotId: 's4', assetId: 'cash', amount: 50 },
    ]

    mockedApi.getAssets.mockResolvedValue(assets as any)
    mockedApi.getLatestSnapshot.mockResolvedValue({
      snapshot: snapshots[3],
      values: snapshotValues.filter((value) => value.snapshotId === 's4'),
    } as any)
    mockedApi.getSnapshots.mockResolvedValue(snapshots as any)
    mockedApi.getSnapshotValues.mockResolvedValue(snapshotValues as any)
    const currentMonth = new Date().toISOString().slice(0, 7)
    const chartIncomeMonth = currentMonth === '2026-07' ? '2026-10' : '2026-07'

    mockedApi.getIncomeRecords.mockResolvedValue([
      {
        id: 'record-1',
        occurredAt: `${chartIncomeMonth}-05`,
        amount: 10000,
        category: 'salary',
        sourceName: '公司',
        createdAt: `${chartIncomeMonth}-05T00:00:00`,
        updatedAt: `${chartIncomeMonth}-05T00:00:00`,
      },
      {
        id: 'record-2',
        occurredAt: `${chartIncomeMonth}-20`,
        amount: 2500,
        category: 'housing_fund',
        createdAt: `${chartIncomeMonth}-20T00:00:00`,
        updatedAt: `${chartIncomeMonth}-20T00:00:00`,
      },
    ] as any)
    mockedApi.getMonthlyIncomes.mockResolvedValue([])
    mockedApi.getRates.mockResolvedValue({ USD: 7.2, HKD: 0.92, updatedAt: '2026-07-05T00:00:00' })
    mockedApi.createIncomeRecord.mockResolvedValue({
      id: 'record-current',
      occurredAt: '2026-11-05',
      amount: 100,
      category: 'bonus',
      sourceName: '奖金',
      note: '本月补录',
      createdAt: '2026-11-05T00:00:00',
      updatedAt: '2026-11-05T00:00:00',
    } as any)
  })

  it('renders day, week, month, quarter, and year trend controls', async () => {
    renderDashboard()

    await screen.findByText('总资产走势')

    expect(screen.getByRole('button', { name: '日' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '周' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '月' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '季' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '年' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '日' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('x-axis').textContent).toBe('periodLabel')
  })

  it('switches chart data to the selected scale without reloading api data', async () => {
    renderDashboard()

    await screen.findByText('总资产走势')

    expect(screen.getByTestId('line-chart').getAttribute('data-point-count')).toBe('3')
    expect(screen.getByTestId('line-chart').getAttribute('data-point-labels')).toBe(
      '2026-07-05|2026-07-08|2026-10-02',
    )

    fireEvent.click(screen.getByRole('button', { name: '月' }))

    await waitFor(() => {
      expect(screen.getByTestId('line-chart').getAttribute('data-point-count')).toBe('2')
    })
    expect(screen.getByTestId('line-chart').getAttribute('data-point-labels')).toBe('2026-07|2026-10')
    expect(screen.getByRole('button', { name: '月' }).getAttribute('aria-pressed')).toBe('true')
    expect(mockedApi.getSnapshots).toHaveBeenCalledTimes(1)
    expect(mockedApi.getSnapshotValues).toHaveBeenCalledTimes(1)
  })

  it('shows the income line on monthly scale with a separate y axis', async () => {
    renderDashboard()

    await screen.findByText('总资产走势')

    expect(screen.queryByTestId('line-incomeAmount')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '月' }))

    await waitFor(() => {
      expect(screen.getByTestId('line-incomeAmount').textContent).toBe('月收入')
    })
    expect(screen.getByTestId('line-incomeAmount').getAttribute('data-y-axis-id')).toBe('income')
  })

  it('creates an income record from the dashboard panel', async () => {
    const { container } = renderDashboard()

    await screen.findByText('收入流入')
    expect(screen.getByRole('link', { name: '收入管理' }).getAttribute('href')).toBe('/income')
    expect(screen.getByText('最近月可支配')).toBeTruthy()
    expect(container.textContent).toContain('10,000.00')
    expect(screen.getByText('受限流入')).toBeTruthy()
    expect(container.textContent).toContain('2,500.00')
    expect(screen.getByText('不可支配')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '记录收入' }))
    fireEvent.change(screen.getByLabelText('发生日期'), { target: { value: '2026-11-05' } })
    fireEvent.change(screen.getByLabelText('分类'), { target: { value: 'bonus' } })
    fireEvent.change(screen.getByLabelText('金额'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('来源'), { target: { value: '奖金' } })
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: '本月补录' } })
    fireEvent.click(screen.getByRole('button', { name: '保存收入' }))

    await waitFor(() => {
      expect(mockedApi.createIncomeRecord).toHaveBeenCalledWith(expect.objectContaining({
        occurredAt: '2026-11-05',
        category: 'bonus',
        amount: 100,
        sourceName: '奖金',
        note: '本月补录',
      }))
    })
  })

  it('presents snapshot context and unambiguous history actions', async () => {
    renderDashboard()

    expect(await screen.findByText(/截至最近快照/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '资产结构' })).toBeTruthy()

    const deleteButtons = screen.getAllByRole('button', { name: /删除.*快照/ })
    expect(deleteButtons.length).toBe(4)
    expect(deleteButtons[0].textContent).toContain('删除')
    expect(deleteButtons[0].textContent).not.toContain('✕')
  })
})
