'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { useTheme } from './ThemeProvider'

export interface UserPreferences {
  tema: 'light' | 'dark' | 'auto'
  idioma: string
  densidade: 'compacta' | 'normal' | 'espacosa'
  formatoData: 'DD/MM/YYYY' | 'YYYY-MM-DD'
  notifSons: boolean
  notifPush: boolean
  notifEmail: boolean
  moduloPadrao: string | null
  tamanhoFonte: 'pequeno' | 'medio' | 'grande'
}

const DEFAULT_PREFERENCES: UserPreferences = {
  tema: 'auto',
  idioma: 'pt-BR',
  densidade: 'normal',
  formatoData: 'DD/MM/YYYY',
  notifSons: true,
  notifPush: true,
  notifEmail: true,
  moduloPadrao: null,
  tamanhoFonte: 'medio',
}

const STORAGE_KEY = 'vizor-preferences'

interface PreferencesContextType {
  preferences: UserPreferences
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void
  loading: boolean
}

const PreferencesContext = createContext<PreferencesContextType | null>(null)

function getFontSize(size: UserPreferences['tamanhoFonte']): string {
  switch (size) {
    case 'pequeno': return '14px'
    case 'grande': return '18px'
    default: return '16px'
  }
}

function getDensityClass(density: UserPreferences['densidade']): string {
  switch (density) {
    case 'compacta': return 'density-compact'
    case 'espacosa': return 'density-spacious'
    default: return 'density-normal'
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { setTheme } = useTheme()
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)

  // Load preferences on mount
  useEffect(() => {
    let merged = DEFAULT_PREFERENCES

    // First try localStorage for instant application
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<UserPreferences>
        merged = { ...DEFAULT_PREFERENCES, ...parsed }
        setPreferences(merged)
      } catch {}
    }

    // Then try to load from API (takes precedence)
    const token = localStorage.getItem('visiofab-wms-token')
    if (token) {
      api.get('/usuarios/me/preferencias')
        .then(({ data }) => {
          if (data && typeof data === 'object') {
            merged = { ...DEFAULT_PREFERENCES, ...data }
            setPreferences(merged)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          }
        })
        .catch(() => {
          // API not available yet — use local
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync theme with ThemeProvider whenever preferences.tema changes
  useEffect(() => {
    setTheme(preferences.tema)
  }, [preferences.tema, setTheme])

  // Apply font size and density to document
  useEffect(() => {
    const html = document.documentElement
    html.style.fontSize = getFontSize(preferences.tamanhoFonte)

    // Remove all density classes and add the correct one
    html.classList.remove('density-compact', 'density-normal', 'density-spacious')
    html.classList.add(getDensityClass(preferences.densidade))
  }, [preferences.tamanhoFonte, preferences.densidade])

  const updatePreference = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPreferences(prev => {
      const updated = { ...prev, [key]: value }

      // Persist locally immediately
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

      // Persist to API asynchronously (don't block UI)
      api.put('/usuarios/me/preferencias', updated).catch(() => {
        // Silently fail — local preference is kept
      })

      return updated
    })
  }, [])

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, loading }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences deve ser usado dentro de um PreferencesProvider')
  }
  return context
}
