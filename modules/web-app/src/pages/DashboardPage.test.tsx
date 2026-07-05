/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    getRates: vi.fn(),
    deleteSnapshot: vi.fn(),
    updateRates: vi.fn(),
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
  Line: ({ dataKey, name }: any) => <div data-testid={`line-${dataKey}`}>{name}</div>,
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
    <FeedbackProvider>
      <DashboardPage />
    </FeedbackProvider>,
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
    mockedApi.getRates.mockResolvedValue({ USD: 7.2, HKD: 0.92, updatedAt: '2026-07-05T00:00:00' })
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
})
