'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { theme } from '@/theme'

type ThemeMode = 'light' | 'dark' | 'auto'

interface ThemeContextType {
  mode: ThemeMode
  effectiveTheme: 'light' | 'dark'
  setTheme: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

const STORAGE_KEY = 'vizor-theme'

function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolveEffective(mode: ThemeMode, systemPref: 'light' | 'dark'): 'light' | 'dark' {
  if (mode === 'auto') return systemPref
  return mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('auto')
  const [systemPref, setSystemPref] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  // Initialize on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    const initial = saved && ['light', 'dark', 'auto'].includes(saved) ? saved : 'auto'
    setMode(initial)
    setSystemPref(getSystemPreference())
    setMounted(true)
  }, [])

  // Listen to OS theme changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      setSystemPref(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const effectiveTheme = resolveEffective(mode, systemPref)

  // Sync <html> class for TailwindCSS dark mode
  useEffect(() => {
    if (!mounted) return
    const html = document.documentElement
    if (effectiveTheme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }, [effectiveTheme, mounted])

  const handleSetTheme = useCallback((newMode: ThemeMode) => {
    setMode(newMode)
    localStorage.setItem(STORAGE_KEY, newMode)
  }, [])

  return (
    <ThemeContext.Provider value={{ mode, effectiveTheme, setTheme: handleSetTheme }}>
      <MantineProvider theme={theme} forceColorScheme={effectiveTheme}>
        {children}
      </MantineProvider>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de um ThemeProvider')
  }
  return context
}
