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
  it('exposes workbook tabs for review, tables, and data exchange', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<Layout onLogout={vi.fn()} />}>
            <Route index element={<div>页面内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: '工作簿标签' })
    const banner = screen.getByRole('banner')
    const shell = screen.getByTestId('financial-workbench')
    expect(shell.classList.contains('workbook-shell')).toBe(true)
    expect(screen.getByRole('main').classList.contains('workbook-content')).toBe(true)
    expect(navigation).toBeTruthy()
    expect(banner.contains(navigation)).toBe(true)
    expect(screen.getByText('RiceFinanceU')).toBeTruthy()
    expect(screen.queryByText('个人资产工作簿')).toBeNull()
    expect(screen.getByRole('link', { name: '大盘' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '资产' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '录入' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '收入' }).getAttribute('href')).toBe('/income')
    expect(screen.getByRole('link', { name: '汇率' }).getAttribute('href')).toBe('/rates')
    expect(screen.getByRole('link', { name: '数据' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '定投管理' })).toBeNull()
    expect(screen.getByRole('group', { name: '界面主题' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '退出登录' })).toBeTruthy()
  })
})
