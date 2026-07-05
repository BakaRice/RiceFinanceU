/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FeedbackProvider } from './components/Feedback/FeedbackContext'

function installLocalStorageMock() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
  })
}

describe('App authentication gate', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    installLocalStorageMock()
  })

  it('未登录时显示登录页', () => {
    render(
      <MemoryRouter>
        <FeedbackProvider>
          <App />
        </FeedbackProvider>
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('邮箱')).toBeTruthy()
    expect(screen.getByLabelText('密码')).toBeTruthy()
  })
})
