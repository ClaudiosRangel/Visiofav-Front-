'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'

function decodeToken(): { perfil?: string } | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem('visiofab-wms-token')
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export function usePerfilGuard(perfil: string) {
  const router = useRouter()

  useEffect(() => {
    const decoded = decodeToken()
    if (decoded && decoded.perfil !== perfil) {
      notifications.show({
        title: 'Acesso negado',
        message: 'Acesso não autorizado',
        color: 'red',
      })
      router.replace('/dashboard')
    }
  }, [perfil, router])
}

export function getUserPerfil(): string | null {
  const decoded = decodeToken()
  return decoded?.perfil || null
}
