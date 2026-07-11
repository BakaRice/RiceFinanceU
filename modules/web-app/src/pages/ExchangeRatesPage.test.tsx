/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { FeedbackProvider } from '../components/Feedback/FeedbackContext'
import ExchangeRatesPage from './ExchangeRatesPage'

vi.mock('../api/client', () => ({
  api: {
    getRates: vi.fn(),
    updateRates: vi.fn(),
  },
}))

const mockedApi = vi.mocked(api)

afterEach(() => cleanup())

describe('ExchangeRatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedApi.getRates.mockResolvedValue({
      USD: 7.2,
      HKD: 0.92,
      updatedAt: '2026-07-11T00:00:00.000Z',
    })
    mockedApi.updateRates.mockResolvedValue({
      USD: 7.25,
      HKD: 0.92,
      updatedAt: '2026-07-11T01:00:00.000Z',
    })
  })

  it('loads currencies as rows and saves edited rates', async () => {
    render(
      <FeedbackProvider>
        <ExchangeRatesPage />
      </FeedbackProvider>,
    )

    expect(await screen.findByRole('table', { name: '汇率表' })).toBeTruthy()
    expect(screen.getByText('USD')).toBeTruthy()
    expect(screen.getByText('HKD')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('USD 对人民币汇率'), {
      target: { value: '7.25' },
    })
    expect(screen.getByText('1 项未保存')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存汇率' }))

    await waitFor(() => {
      expect(mockedApi.updateRates).toHaveBeenCalledWith({ USD: 7.25, HKD: 0.92 })
    })
  })
})
