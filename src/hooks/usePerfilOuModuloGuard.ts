'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { getAuthToken } from '@/lib/authStorage'
import { useEmpresa } from '@/providers/EmpresaProvider'

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

/**
 * Libera o acesso a uma tela quando o usuário TEM o perfil exigido OU possui o
 * módulo concedido (permissão por módulo na tela Configurador → Usuários).
 *
 * Usado por telas que historicamente eram só de ADMIN/SUPER_ADMIN (ex.: Portal
 * do Representante) mas que agora também podem ser delegadas a um usuário comum
 * via a permissão de módulo — sem precisar promovê-lo a administrador.
 *
 * SUPER_ADMIN e ADMIN sempre têm acesso.
 */
export function usePerfilOuModuloGuard(
  perfisPermitidos: string | string[],
  modulo: string,
) {
  const router = useRouter()
  const { modulos } = useEmpresa()

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
    // SUPER_ADMIN e ADMIN têm acesso a tudo.
    if (decoded.perfil === 'SUPER_ADMIN' || decoded.perfil === 'ADMIN') return

    const perfis = Array.isArray(perfisPermitidos) ? perfisPermitidos : [perfisPermitidos]
    const temPerfil = decoded.perfil ? perfis.includes(decoded.perfil) : false

    // A lista de módulos pode ainda não ter carregado — não bloquear nesse caso
    // (evita falso "acesso negado" durante o carregamento do EmpresaProvider).
    if (modulos.length === 0 && !temPerfil) return
    const temModulo = modulos.includes(modulo)

    if (!temPerfil && !temModulo) {
      notifications.show({
        title: 'Acesso negado',
        message: 'Acesso não autorizado',
        color: 'red',
      })
      router.replace('/dashboard')
    }
  }, [perfisPermitidos, modulo, modulos, router])
}
