/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { FeedbackProvider } from './Feedback/FeedbackContext'
import SnapshotForm from './SnapshotForm'

vi.mock('../api/client', () => ({
  api: {
    getAssets: vi.fn(),
    getLatestSnapshot: vi.fn(),
    createSnapshot: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api)

afterEach(() => {
  cleanup()
})

describe('SnapshotForm imported profit rate precision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'fund-1',
        name: '指数基金',
        type: 'fund',
        currency: 'CNY',
        isActive: true,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ] as any)
    mockedApi.getLatestSnapshot.mockResolvedValue({
      snapshot: {
        id: 'snapshot-1',
        recordedAt: '2026-07-01T00:00:00.000Z',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
      values: [
        {
          id: 'value-1',
          snapshotId: 'snapshot-1',
          assetId: 'fund-1',
          amount: 1000,
          profit: 200,
          profitRate: 0.3076923076923077,
        },
      ],
    } as any)
  })

  it('truncates an imported stored ratio before the user saves', async () => {
    render(
      <FeedbackProvider>
        <SnapshotForm onSuccess={vi.fn()} onManageAssets={vi.fn()} />
      </FeedbackProvider>,
    )

    expect(await screen.findByDisplayValue('30.76')).toBeTruthy()
    expect(screen.getByRole('button', { name: '管理资产' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '保存快照' }))

    expect(await screen.findByRole('heading', { name: '确认保存快照' })).toBeTruthy()
    expect(screen.queryByText(/收益率无效/)).toBeNull()
  })
})
