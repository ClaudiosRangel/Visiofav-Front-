'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { getAuthToken } from '@/lib/authStorage'

function decodeToken(): { perfil?: string } | null {
  if (typeof window === 'undefined') return null
  const token = getAuthToken()
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

export function usePerfilGuard(perfil: string | string[]) {
  const router = useRouter()

  useEffect(() => {
    const decoded = decodeToken()
    if (!decoded) {
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível verificar a permissão de acesso',
        color: 'red',
      })
      return
    }
    // SUPER_ADMIN and ADMIN have access to everything
    if (decoded.perfil === 'SUPER_ADMIN' || decoded.perfil === 'ADMIN') return
    const allowed = Array.isArray(perfil) ? perfil : [perfil]
    if (!allowed.includes(decoded.perfil!)) {
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

export function getEmpresaId(): string | null {
  const decoded = decodeToken() as { empresaId?: string } | null
  return decoded?.empresaId || null
}
