import { describe, expect, it, vi } from 'vitest'
import {
  applyThemePreference,
  parseThemePreference,
  readThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
} from './theme'

describe('theme preferences', () => {
  it('parses supported preferences and falls back to system', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
    expect(parseThemePreference('purple')).toBe('system')
    expect(parseThemePreference(null)).toBe('system')
  })

  it('resolves system and manual preferences', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('reads a stored preference and ignores invalid values', () => {
    const storage = { getItem: vi.fn(() => 'dark') }
    expect(readThemePreference(storage)).toBe('dark')
    storage.getItem.mockReturnValue('violet')
    expect(readThemePreference(storage)).toBe('system')
  })

  it('persists and applies a preference to the root element', () => {
    const storage = { setItem: vi.fn() }
    const root = { dataset: {} as DOMStringMap }

    expect(applyThemePreference('dark', { storage, root, systemDark: false })).toBe('dark')
    expect(storage.setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'dark')
    expect(root.dataset.theme).toBe('dark')
    expect(root.dataset.themePreference).toBe('dark')
  })
})
