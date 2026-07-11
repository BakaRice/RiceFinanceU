/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { FeedbackProvider } from './components/Feedback/FeedbackContext'
import Layout from './components/Layout'

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

afterEach(() => {
  cleanup()
})

describe('authenticated application shell', () => {
  it('exposes a branded primary navigation with all business areas', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout onLogout={vi.fn()} />}>
            <Route index element={<div>页面内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: '主导航' })
    const shell = screen.getByTestId('financial-workbench')
    expect(shell.getAttribute('data-density')).toBe('dense')
    expect(screen.getByRole('main').classList.contains('content')).toBe(true)
    expect(navigation).toBeTruthy()
    expect(screen.getByText('Rice Finance')).toBeTruthy()
    expect(screen.getByRole('link', { name: '总览' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '资产管理' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '收入管理' }).getAttribute('href')).toBe('/income')
    expect(screen.getByRole('link', { name: '定投管理' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '快照录入' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '数据管理' })).toBeTruthy()
    expect(screen.getByRole('group', { name: '界面主题' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '退出登录' })).toBeTruthy()
  })
})
