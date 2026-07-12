/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  localStorage.clear()
})

function renderAssetsPage(initialEntries: any[] = ['/assets']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
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
    expect(screen.getByRole('table', { name: '资产表' }).classList.contains('resizable-table')).toBe(true)
    expect(screen.getByRole('separator', { name: '调整名称列宽' })).toBeTruthy()
    expect(screen.getByText('NASDAQ AAPL')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Apple' }).getAttribute('href')).toBe('/assets/stock-1')
    expect(screen.getByRole('button', { name: '编辑 Apple' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '暂停录入 Apple' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '永久删除 Apple' })).toBeTruthy()
  })

  it('marks housing fund assets as restricted in the asset list', async () => {
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'housing-fund-1',
        name: '上海公积金',
        type: 'housing_fund',
        currency: 'CNY',
        isActive: true,
        profile: { contributionCity: '上海' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'cash-1',
        name: '微信零钱',
        type: 'cash',
        currency: 'CNY',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)

    renderAssetsPage()

    expect(await screen.findByRole('link', { name: '上海公积金' })).toBeTruthy()
    expect(screen.getByText('受限资产')).toBeTruthy()
    expect(screen.getByText('不可随意提取')).toBeTruthy()
    expect(screen.getByRole('link', { name: '微信零钱' })).toBeTruthy()
  })

  it('shows type-specific profile inputs in the asset form', async () => {
    mockedApi.getAssets.mockResolvedValue([])

    renderAssetsPage()

    fireEvent.click(await screen.findByRole('button', { name: '新增资产' }))

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

    fireEvent.click(await screen.findByRole('button', { name: '新增资产' }))
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

  it('submits a daily DCA plan for investment assets with weekends excluded by default', async () => {
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

    fireEvent.click(await screen.findByRole('button', { name: '新增资产' }))
    fireEvent.change(container.querySelector('input[required]') as HTMLInputElement, {
      target: { value: '纳指基金' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: '启用定投计划' }))
    fireEvent.change(screen.getByLabelText('定投周期'), {
      target: { value: 'daily' },
    })
    fireEvent.change(screen.getByLabelText('每期计划投入'), {
      target: { value: '100.50' },
    })
    fireEvent.change(screen.getByLabelText('目标金额'), {
      target: { value: '10000' },
    })
    fireEvent.change(screen.getByLabelText('目标日期'), {
      target: { value: '2026-12-31' },
    })
    fireEvent.change(screen.getByLabelText('容忍偏差 (%)'), {
      target: { value: '15' },
    })
    fireEvent.change(screen.getByLabelText('定投备注'), {
      target: { value: ' 长期定投 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => {
      expect(mockedApi.createAsset).toHaveBeenCalledWith(expect.objectContaining({
        name: '纳指基金',
        dcaPlan: {
          enabled: true,
          frequency: 'daily',
          excludeWeekends: true,
          plannedContribution: 100.5,
          targetAmount: 10000,
          targetDate: '2026-12-31',
          toleranceRate: 0.15,
          note: '长期定投',
        },
      }))
    })
  })

  it('opens the edit modal when route state contains an asset id', async () => {
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'fund-1',
        name: '沪深300',
        type: 'fund',
        currency: 'CNY',
        isActive: true,
        dcaPlan: {
          enabled: true,
          frequency: 'monthly',
          plannedContribution: 1000,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)

    renderAssetsPage([{ pathname: '/assets', state: { editId: 'fund-1' } }])

    expect(await screen.findByRole('heading', { name: '编辑资产' })).toBeTruthy()
    expect((screen.getAllByDisplayValue('沪深300') as HTMLInputElement[]).some((input) => input.required)).toBe(true)
    expect(screen.getByRole('checkbox', { name: '启用定投计划' })).toBeTruthy()
  })
})

describe('AssetsPage table editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.getLatestSnapshot.mockResolvedValue(null)
    mockedApi.updateAsset.mockResolvedValue({} as any)
    mockedApi.getAssets.mockResolvedValue([
      {
        id: 'asset-fund',
        name: '指数基金',
        type: 'fund',
        currency: 'CNY',
        institution: '基金平台',
        entryStatus: 'normal',
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'asset-cash',
        name: '暂停现金',
        type: 'cash',
        currency: 'CNY',
        entryStatus: 'paused',
        isActive: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any)
  })

  it('keeps normal and paused assets in one editable table', async () => {
    renderAssetsPage()

    expect(await screen.findByRole('table', { name: '资产表' })).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(screen.getByDisplayValue('指数基金')).toBeTruthy()
    expect(screen.getByDisplayValue('暂停现金')).toBeTruthy()
    expect((screen.getByLabelText('暂停现金 状态') as HTMLSelectElement).value).toBe('paused')

    fireEvent.change(screen.getByLabelText('指数基金 名称'), {
      target: { value: '沪深 300' },
    })
    expect(screen.getByText('1 项未保存')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存资产' }))

    await waitFor(() => {
      expect(mockedApi.updateAsset).toHaveBeenCalledWith(
        'asset-fund',
        expect.objectContaining({ name: '沪深 300' }),
      )
    })
  })

  it('saves entry participation instead of the legacy active flag', async () => {
    renderAssetsPage()

    await screen.findByRole('table', { name: '资产表' })
    fireEvent.change(screen.getByLabelText('指数基金 状态'), {
      target: { value: 'paused' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存资产' }))

    await waitFor(() => {
      expect(mockedApi.updateAsset).toHaveBeenCalledWith(
        'asset-fund',
        expect.objectContaining({ entryStatus: 'paused' }),
      )
    })
    expect(mockedApi.updateAsset).not.toHaveBeenCalledWith(
      'asset-fund',
      expect.objectContaining({ isActive: expect.anything() }),
    )
  })

  it('requires two confirmations and the exact asset name before permanent deletion', async () => {
    mockedApi.deleteAsset.mockResolvedValue({ success: true })
    renderAssetsPage()

    await screen.findByRole('table', { name: '资产表' })
    fireEvent.click(screen.getByRole('button', { name: '永久删除 指数基金' }))
    expect(screen.getByRole('heading', { name: '永久删除资产' })).toBeTruthy()
    expect(mockedApi.deleteAsset).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '继续删除' }))
    expect(await screen.findByRole('heading', { name: '输入资产名称确认' })).toBeTruthy()
    const deleteButton = screen.getByRole('button', { name: '永久删除' }) as HTMLButtonElement
    expect(deleteButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('输入资产名称'), { target: { value: '指数' } })
    expect(deleteButton.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('输入资产名称'), { target: { value: '指数基金' } })
    expect(deleteButton.disabled).toBe(false)
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockedApi.deleteAsset).toHaveBeenCalledWith('asset-fund', '指数基金')
    })
  })

  it('shows the history protection message when permanent deletion is rejected', async () => {
    mockedApi.deleteAsset.mockRejectedValue(new Error('该资产已有历史快照，只能暂停录入'))
    renderAssetsPage()

    await screen.findByRole('table', { name: '资产表' })
    fireEvent.click(screen.getByRole('button', { name: '永久删除 指数基金' }))
    fireEvent.click(screen.getByRole('button', { name: '继续删除' }))
    fireEvent.change(await screen.findByLabelText('输入资产名称'), {
      target: { value: '指数基金' },
    })
    fireEvent.click(screen.getByRole('button', { name: '永久删除' }))

    expect(await screen.findByText(/该资产已有历史快照，只能暂停录入/)).toBeTruthy()
  })

  it('keeps the asset toolbar compact without repeating the page title and description', async () => {
    renderAssetsPage()

    expect(await screen.findByRole('table', { name: '资产表' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '资产' })).toBeNull()
    expect(screen.queryByText('一行一个资产；金额、收益和收益率来自最新快照')).toBeNull()
    expect(screen.getByRole('button', { name: '新增资产' })).toBeTruthy()
  })

  it('uses spreadsheet-style left alignment across the asset table', async () => {
    renderAssetsPage()

    const table = await screen.findByRole('table', { name: '资产表' })
    expect(table.querySelectorAll('.align-right')).toHaveLength(0)
    expect(table.classList.contains('assets-table-excel')).toBe(true)
  })

  it('reorders and hides asset fields and persists the browser preference', async () => {
    const view = renderAssetsPage()

    const table = await screen.findByRole('table', { name: '资产表' })
    fireEvent.click(screen.getByRole('button', { name: '字段设置' }))
    expect(
      screen.getByRole('button', { name: '上移标识' }).querySelector('.asset-field-move-icon'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '上移标识' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '显示币种' }))

    const headers = within(table)
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.replace(/[▸▲▼]/g, '').trim())

    expect(headers.slice(0, 3)).toEqual(['名称', '标识', '类型'])
    expect(headers).not.toContain('币种')
    expect(JSON.parse(localStorage.getItem('ricefinanceu:asset-table-fields') || '{}')).toEqual({
      order: ['name', 'identifier', 'type', 'institution', 'currency', 'note'],
      hidden: ['currency'],
    })

    view.unmount()
    renderAssetsPage()
    const restoredHeaders = within(await screen.findByRole('table', { name: '资产表' }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent?.replace(/[▸▲▼]/g, '').trim())
    expect(restoredHeaders.slice(0, 3)).toEqual(['名称', '标识', '类型'])
    expect(restoredHeaders).not.toContain('币种')
  })
})
