/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
        isActive: false,
        entryStatus: 'paused',
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
    const assetPanel = screen.getByTestId('asset-trend-panel')

    expect(within(assetPanel).getByRole('button', { name: '日' })).toBeTruthy()
    expect(within(assetPanel).getByRole('button', { name: '周' })).toBeTruthy()
    expect(within(assetPanel).getByRole('button', { name: '月' })).toBeTruthy()
    expect(within(assetPanel).getByRole('button', { name: '季' })).toBeTruthy()
    expect(within(assetPanel).getByRole('button', { name: '年' })).toBeTruthy()
    expect(within(assetPanel).getByRole('button', { name: '日' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(assetPanel).getByTestId('x-axis').textContent).toBe('periodLabel')
  })

  it('keeps paused-entry assets in the current total', async () => {
    renderDashboard()

    const totalLabel = await screen.findByText('总资产 (CNY)')
    expect(totalLabel.parentElement?.textContent).toContain('350.00')
  })

  it('switches chart data to the selected scale without reloading api data', async () => {
    renderDashboard()

    await screen.findByText('总资产走势')
    const assetPanel = screen.getByTestId('asset-trend-panel')

    expect(within(assetPanel).getByTestId('line-chart').getAttribute('data-point-count')).toBe('3')
    expect(within(assetPanel).getByTestId('line-chart').getAttribute('data-point-labels')).toBe(
      '2026-07-05|2026-07-08|2026-10-02',
    )

    fireEvent.click(within(assetPanel).getByRole('button', { name: '月' }))

    await waitFor(() => {
      expect(within(assetPanel).getByTestId('line-chart').getAttribute('data-point-count')).toBe('2')
    })
    expect(within(assetPanel).getByTestId('line-chart').getAttribute('data-point-labels')).toBe('2026-07|2026-10')
    expect(within(assetPanel).getByRole('button', { name: '月' }).getAttribute('aria-pressed')).toBe('true')
    expect(mockedApi.getSnapshots).toHaveBeenCalledTimes(1)
    expect(mockedApi.getSnapshotValues).toHaveBeenCalledTimes(1)
  })

  it('shows asset and income trends side by side with independent scales', async () => {
    renderDashboard()

    await screen.findByText('总资产走势')
    const trendRow = screen.getByTestId('dashboard-trend-row')
    const assetPanel = within(trendRow).getByTestId('asset-trend-panel')
    const incomePanel = within(trendRow).getByTestId('income-trend-panel')

    expect(within(assetPanel).queryByTestId('line-incomeAmount')).toBeNull()
    expect(within(incomePanel).getByTestId('line-incomeAmount').textContent).toBe('月收入')
    expect(within(incomePanel).getByRole('button', { name: '月' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(incomePanel).getByRole('button', { name: '日' })).toBeTruthy()
    expect(within(incomePanel).getByRole('button', { name: '周' })).toBeTruthy()
    expect(within(incomePanel).getByRole('button', { name: '季' })).toBeTruthy()
    expect(within(incomePanel).getByRole('button', { name: '年' })).toBeTruthy()
  })

  it('keeps dashboard income read-only and links to the income sheet', async () => {
    const { container } = renderDashboard()

    await screen.findByText('收入流入')
    expect(screen.getByRole('link', { name: '查看收入明细' }).getAttribute('href')).toBe('/income')
    expect(screen.getByText('最近月可支配')).toBeTruthy()
    expect(container.textContent).toContain('10,000.00')
    expect(screen.getByText('受限流入')).toBeTruthy()
    expect(container.textContent).toContain('2,500.00')
    expect(screen.getByText('不可支配')).toBeTruthy()

    expect(screen.queryByRole('button', { name: '记录收入' })).toBeNull()
    expect(screen.queryByRole('button', { name: '编辑最近一笔' })).toBeNull()
    expect(screen.queryByRole('button', { name: '保存收入' })).toBeNull()
    expect(screen.queryByRole('button', { name: '删除收入' })).toBeNull()
    expect(mockedApi.createIncomeRecord).not.toHaveBeenCalled()
    expect(mockedApi.updateIncomeRecord).not.toHaveBeenCalled()
    expect(mockedApi.deleteIncomeRecord).not.toHaveBeenCalled()
  })

  it('groups related dashboard panels into two semantic rows', async () => {
    renderDashboard()

    await screen.findByText('总资产走势')

    const flowRow = screen.getByTestId('flow-structure-row')
    expect(flowRow.textContent).toContain('收入流入')
    expect(flowRow.textContent).toContain('资产结构')

    const activityRow = screen.getByTestId('snapshot-change-row')
    expect(activityRow.textContent).toContain('快照历史')
    expect(activityRow.textContent).toContain('最近变化')
  })

  it('keeps exchange rates read-only and links to the rate table', async () => {
    const { container } = renderDashboard()

    await screen.findByText('总资产走势')

    const header = container.querySelector('.dashboard-header')
    expect(header?.textContent).toContain('汇率')
    expect(header?.textContent).toContain('USD 7.20')
    expect(header?.textContent).toContain('HKD 0.92')
    expect(screen.getByRole('link', { name: /汇率 · USD 7\.20 · HKD 0\.92/ }).getAttribute('href')).toBe('/rates')
    expect(screen.queryByRole('button', { name: '保存' })).toBeNull()
    expect(mockedApi.updateRates).not.toHaveBeenCalled()
  })

  it('presents snapshot context and unambiguous history actions', async () => {
    const { container } = renderDashboard()

    expect(await screen.findByText(/截至最近快照/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '资产结构' })).toBeTruthy()

    const deleteButtons = screen.getAllByRole('button', { name: /删除.*快照/ })
    expect(deleteButtons.length).toBe(4)
    expect(deleteButtons[0].textContent).toContain('删除')
    expect(deleteButtons[0].textContent).not.toContain('✕')

    const historyHeader = container.querySelector('.history-item-header')
    expect(historyHeader?.children).toHaveLength(3)
    expect(historyHeader?.children[0].classList.contains('history-date')).toBe(true)
    expect(historyHeader?.children[1].classList.contains('history-note')).toBe(true)
    expect(historyHeader?.children[2].classList.contains('history-item-actions')).toBe(true)
  })
})
