/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import AssetsPage from './AssetsPage'

vi.mock('../api/client', () => ({
  api: {
    getAssets: vi.fn(),
    getLatestSnapshot: vi.fn(),
    createAsset: vi.fn(),
    updateAsset: vi.fn(),
    deleteAsset: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api)

afterEach(() => {
  cleanup()
})

function renderAssetsPage() {
  return render(
    <MemoryRouter>
      <FeedbackProvider>
        <AssetsPage />
      </FeedbackProvider>
    </MemoryRouter>,
  )
}

describe('AssetsPage asset profile fields', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.getLatestSnapshot.mockResolvedValue(null)
  })

  it('renders the compact profile identifier column for assets', async () => {
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'stock-1',
        name: 'Apple',
        type: 'stock',
        currency: 'USD',
        isActive: true,
        profile: { exchange: 'NASDAQ', ticker: 'AAPL' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)

    renderAssetsPage()

    expect(await screen.findByText('标识')).toBeTruthy()
    expect(screen.getByText('NASDAQ AAPL')).toBeTruthy()
  })

  it('shows type-specific profile inputs in the asset form', async () => {
    mockedApi.getAssets.mockResolvedValue([])

    renderAssetsPage()

    await screen.findByText('资产管理')
    fireEvent.click(screen.getByRole('button', { name: '+ 新增资产' }))

    expect(screen.getByText('类型档案')).toBeTruthy()
    expect(screen.getByText('基金代码')).toBeTruthy()
    expect(screen.getByText('投资市场/主题')).toBeTruthy()
  })

  it('submits sanitized profile values when creating an asset', async () => {
    mockedApi.getAssets.mockResolvedValue([])
    mockedApi.createAsset.mockResolvedValue({
      id: 'fund-1',
      name: '纳指基金',
      type: 'fund',
      currency: 'CNY',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as any)

    const { container } = renderAssetsPage()

    await screen.findByText('资产管理')
    fireEvent.click(screen.getByRole('button', { name: '+ 新增资产' }))
    fireEvent.change(container.querySelector('input[required]') as HTMLInputElement, {
      target: { value: '纳指基金' },
    })
    fireEvent.change(screen.getByPlaceholderText('如：513100'), {
      target: { value: ' 513100 ' },
    })
    fireEvent.change(screen.getByPlaceholderText('如：美股/纳指100'), {
      target: { value: ' 美股 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockedApi.createAsset).toHaveBeenCalledWith(expect.objectContaining({
        name: '纳指基金',
        profile: {
          fundCode: '513100',
          marketTheme: '美股',
        },
      }))
    })
  })
})
