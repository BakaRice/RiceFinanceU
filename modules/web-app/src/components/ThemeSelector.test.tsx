/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY } from '../domain/theme'
import ThemeSelector from './ThemeSelector'

describe('ThemeSelector', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    })
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    delete document.documentElement.dataset.theme
    delete document.documentElement.dataset.themePreference
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders three accessible theme preferences', () => {
    render(<ThemeSelector variant="sidebar" />)

    expect(screen.getByRole('group', { name: '界面主题' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '跟随系统' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '浅色' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '深色' })).toBeTruthy()
  })

  it('persists and immediately applies a manual theme', () => {
    render(<ThemeSelector variant="sidebar" />)

    fireEvent.click(screen.getByRole('button', { name: '深色' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.themePreference).toBe('dark')
    expect(localStorage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark')
    expect(screen.getByRole('button', { name: '深色' }).getAttribute('aria-pressed')).toBe('true')
  })
})
