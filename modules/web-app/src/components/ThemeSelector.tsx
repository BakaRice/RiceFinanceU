import { useEffect, useState } from 'react'
import {
  applyThemePreference,
  readThemePreference,
  subscribeToSystemTheme,
  type ThemePreference,
} from '../domain/theme'

interface ThemeSelectorProps {
  variant?: 'sidebar' | 'floating'
}

const OPTIONS: Array<{ value: ThemePreference; label: string; shortLabel: string }> = [
  { value: 'system', label: '跟随系统', shortLabel: '自动' },
  { value: 'light', label: '浅色', shortLabel: '浅色' },
  { value: 'dark', label: '深色', shortLabel: '深色' },
]

export default function ThemeSelector({ variant = 'sidebar' }: ThemeSelectorProps) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemePreference())

  useEffect(() => {
    applyThemePreference(preference)
    if (preference !== 'system') return undefined
    return subscribeToSystemTheme(() => applyThemePreference('system'))
  }, [preference])

  return (
    <div className={`theme-selector theme-selector-${variant}`} role="group" aria-label="界面主题">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={option.label}
          aria-pressed={preference === option.value}
          onClick={() => setPreference(option.value)}
        >
          {option.shortLabel}
        </button>
      ))}
    </div>
  )
}
