import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'ap-codex-theme'

function readStored(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

function initialTheme(): Theme {
  // Dark is the design's default; only an explicit user choice overrides it.
  return readStored() ?? 'dark'
}

function apply(theme: Theme): void {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  root.dataset.theme = theme
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* storage unavailable (private mode / file://) — theme still applies for this session */
  }
}

/** Applies the persisted theme as early as possible (called from main.tsx). */
export function bootstrapTheme(): void {
  apply(initialTheme())
}

export function useTheme(): { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'dark' : (document.documentElement.dataset.theme as Theme) || 'dark',
  )

  useEffect(() => {
    apply(theme)
  }, [theme])

  return {
    theme,
    setTheme: setThemeState,
    toggle: () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
  }
}
