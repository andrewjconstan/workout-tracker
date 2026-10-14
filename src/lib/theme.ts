export type Theme = 'auto' | 'light' | 'dark'

export const THEME_KEY = 'wt-theme'

export const THEME_LABEL: Record<Theme, string> = {
  auto: 'Match this device',
  light: 'Light',
  dark: 'Dark',
}

/** Force light or dark by setting data-theme on <html>; "auto" removes it so the device setting applies. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

/** The saved choice (stored by useLocalState as JSON), or "auto". Never throws. */
export function readStoredTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    const value = raw === null ? null : JSON.parse(raw)
    return value === 'light' || value === 'dark' ? value : 'auto'
  } catch {
    return 'auto'
  }
}
