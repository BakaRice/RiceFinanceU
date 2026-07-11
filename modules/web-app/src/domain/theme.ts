export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'ricefinanceu-theme'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>
type ThemeRoot = { dataset: DOMStringMap }

export interface ThemeEnvironment {
  storage?: WritableStorage | null
  root?: ThemeRoot | null
  systemDark?: boolean
}

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light'
  return preference
}

function browserStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function browserRoot(): HTMLElement | undefined {
  return typeof document === 'undefined' ? undefined : document.documentElement
}

export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function readThemePreference(storage: ReadableStorage | undefined = browserStorage()): ThemePreference {
  try {
    return parseThemePreference(storage?.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function applyThemePreference(
  preference: ThemePreference,
  options: ThemeEnvironment = {},
): ResolvedTheme {
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const root = options.root === undefined ? browserRoot() : options.root
  const systemDark = options.systemDark ?? systemPrefersDark()
  const resolvedTheme = resolveTheme(preference, systemDark)

  try {
    storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // A blocked storage API must not prevent the app from applying a theme.
  }

  if (root) {
    root.dataset.theme = resolvedTheme
    root.dataset.themePreference = preference
  }

  return resolvedTheme
}

export function initializeTheme(): ThemePreference {
  const preference = readThemePreference()
  applyThemePreference(preference)
  return preference
}

export function subscribeToSystemTheme(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => undefined

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => callback()

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }

  media.addListener?.(listener)
  return () => media.removeListener?.(listener)
}
