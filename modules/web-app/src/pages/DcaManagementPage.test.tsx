/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import DcaManagementPage from './DcaManagementPage'

vi.mock('../api/client', () => ({
  api: {
    getAssets: vi.fn(),
    getRates: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api)

function renderDcaManagementPage() {
  return render(
    <MemoryRouter>
      <FeedbackProvider>
        <DcaManagementPage />
      </FeedbackProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApi.getRates.mockResolvedValue({ USD: 7.2, HKD: 0.92, updatedAt: '' })
})

afterEach(() => {
  cleanup()
})

describe('DcaManagementPage', () => {
  it('summarizes enabled investment DCA plans and renders the plan table', async () => {
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'fund-1',
        name: '沪深300',
        type: 'fund',
        currency: 'CNY',
        institution: '支付宝',
        isActive: true,
        dcaPlan: {
          enabled: true,
          frequency: 'monthly',
          plannedContribution: 1000,
          targetAmount: 80000,
          targetDate: '2026-12-31',
          note: '工资到账后投入',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'stock-1',
        name: '纳指100',
        type: 'stock',
        currency: 'USD',
        institution: '券商',
        isActive: true,
        dcaPlan: {
          enabled: true,
          frequency: 'weekly',
          plannedContribution: 100,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'cash-1',
        name: '现金',
        type: 'cash',
        currency: 'CNY',
        isActive: true,
        dcaPlan: {
          enabled: true,
          frequency: 'monthly',
          plannedContribution: 9999,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'paused-fund',
        name: '暂停定投基金',
        type: 'fund',
        currency: 'CNY',
        entryStatus: 'paused',
        isActive: true,
        dcaPlan: {
          enabled: true,
          frequency: 'monthly',
          plannedContribution: 500,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)

    const { container } = renderDcaManagementPage()

    expect(await screen.findByRole('heading', { name: '定投管理' })).toBeTruthy()
    expect(screen.getByText('本月计划投入')).toBeTruthy()
    expect(container.textContent).toContain('4,600.00')
    expect(screen.getByText('启用计划数')).toBeTruthy()
    expect(container.textContent).toContain('2')
    expect(screen.getByText('沪深300')).toBeTruthy()
    expect(screen.getByText('纳指100')).toBeTruthy()
    expect(screen.queryByText('现金')).toBeNull()
    expect(screen.queryByText('暂停定投基金')).toBeNull()
    expect(screen.getByText('工资到账后投入')).toBeTruthy()
  })

  it('filters table rows by frequency without changing the global summary', async () => {
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'fund-1',
        name: '沪深300',
        type: 'fund',
        currency: 'CNY',
        isActive: true,
        dcaPlan: { enabled: true, frequency: 'monthly', plannedContribution: 1000 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'stock-1',
        name: '纳指100',
        type: 'stock',
        currency: 'USD',
        isActive: true,
        dcaPlan: { enabled: true, frequency: 'weekly', plannedContribution: 100 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)

    const { container } = renderDcaManagementPage()

    await screen.findByText('沪深300')
    fireEvent.click(screen.getByRole('button', { name: '每周' }))

    expect(screen.queryByText('沪深300')).toBeNull()
    expect(screen.getByText('纳指100')).toBeTruthy()
    expect(container.textContent).toContain('4,600.00')
  })

  it('renders a small empty state when no active investment DCA plan exists', async () => {
    mockedApi.getAssets.mockResolvedValue([])

    renderDcaManagementPage()

    expect(await screen.findByText('还没有启用定投计划')).toBeTruthy()
    expect(screen.getByRole('button', { name: '去资产管理' })).toBeTruthy()
  })
})
