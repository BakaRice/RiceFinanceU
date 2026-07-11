/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import AssetDetailPage from './AssetDetailPage'

vi.mock('../api/client', () => ({
  api: {
    getAssets: vi.fn(),
    getSnapshots: vi.fn(),
    getSnapshotValues: vi.fn(),
    deleteAsset: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api)

afterEach(() => {
  cleanup()
})

function renderAssetDetail(assetId = 'deposit-1') {
  return render(
    <MemoryRouter initialEntries={[`/assets/${assetId}`]}>
      <FeedbackProvider>
        <Routes>
          <Route path="/assets/:id" element={<AssetDetailPage />} />
        </Routes>
      </FeedbackProvider>
    </MemoryRouter>,
  )
}

describe('AssetDetailPage asset profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.getSnapshots.mockResolvedValue([])
    mockedApi.getSnapshotValues.mockResolvedValue([])
  })

  it('renders type-specific profile fields separately from snapshot history', async () => {
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'deposit-1',
        name: '招商定存',
        type: 'deposit',
        currency: 'CNY',
        institution: '招商银行',
        isActive: true,
        profile: {
          bank: '招商银行',
          depositType: '定期',
          maturityDate: '2027-01-01',
          annualRate: '2.10%',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)

    renderAssetDetail()

    expect(await screen.findByText('资产档案')).toBeTruthy()
    expect(screen.getByText('存款类型')).toBeTruthy()
    expect(screen.getByText('定期')).toBeTruthy()
    expect(screen.getByText('到期日')).toBeTruthy()
    expect(screen.getByText('2027-01-01')).toBeTruthy()
  })

  it('shows an empty profile state for old assets without profile data', async () => {
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'cash-1',
        name: '现金',
        type: 'cash',
        currency: 'CNY',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)

    renderAssetDetail('cash-1')

    expect(await screen.findByText('资产档案')).toBeTruthy()
    expect(screen.getByText('未补充档案信息')).toBeTruthy()
  })

  it('renders a DCA estimate for investment assets with saved plans', async () => {
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'fund-1',
        name: '指数基金',
        type: 'fund',
        currency: 'CNY',
        isActive: true,
        dcaPlan: {
          enabled: true,
          frequency: 'daily',
          excludeWeekends: true,
          plannedContribution: 100,
          targetAmount: 1500,
          targetDate: '2026-07-10',
          toleranceRate: 0.2,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)
    mockedApi.getSnapshots.mockResolvedValue([
      {
        id: 'snapshot-1',
        recordedAt: '2026-07-03T00:00:00.000Z',
        createdAt: '2026-07-03T00:00:00.000Z',
      },
    ] as any)
    mockedApi.getSnapshotValues.mockResolvedValue([
      {
        id: 'value-1',
        snapshotId: 'snapshot-1',
        assetId: 'fund-1',
        amount: 500,
      },
    ] as any)

    renderAssetDetail('fund-1')

    expect(await screen.findByText('定投计划')).toBeTruthy()
    expect(screen.getByText(/最近快照/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '编辑 指数基金' })).toBeTruthy()
    expect(screen.getByText('建议每期投入')).toBeTruthy()
    expect(screen.getByText('计划投入低于目标倒推金额，后续可能需要提高每期投入。')).toBeTruthy()
    expect(screen.getByText('剩余周期')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
  })
})
