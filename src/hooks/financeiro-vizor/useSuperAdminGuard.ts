'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { getAuthToken } from '@/lib/authStorage'
import { getUserPerfil } from '@/hooks/usePerfilGuard'

/**
 * Estado da verificação de acesso ao painel Financeiro Vizor.
 * - `verificando`: verificação ainda não concluída (montagem inicial).
 * - `permitido`: usuário é SUPER_ADMIN; a página pode renderizar os dados.
 * - `negado`: acesso recusado (sem token, token indecodificável ou perfil ≠
 *   SUPER_ADMIN). A página NÃO deve renderizar dados de cobrança.
 */
export type EstadoGuardSuperAdmin = 'verificando' | 'permitido' | 'negado'

/**
 * Guarda de rota EXCLUSIVA para o perfil `SUPER_ADMIN`, usada pelas páginas do
 * painel Financeiro Vizor.
 *
 * Diferente do `usePerfilGuard` genérico, que também libera `ADMIN`, este guard
 * verifica estritamente `getUserPerfil() === 'SUPER_ADMIN'` — o painel de
 * billing do Vizor é acessível apenas ao dono do SaaS (ver Decisão de design 1
 * do spec `financeiro-vizor-frontend`).
 *
 * Comportamento (Req 1.3, 1.4, 1.5):
 * - Se o token estiver ausente ou não puder ser decodificado, exibe uma
 *   notificação de erro de verificação de permissão e retorna `negado` (não
 *   redireciona, pois pode ser um estado transitório de sessão).
 * - Se o perfil for diferente de `SUPER_ADMIN`, exibe notificação de acesso
 *   negado, redireciona para `/dashboard` e retorna `negado`.
 * - Caso contrário, retorna `permitido`.
 *
 * O perfil e o token são lidos de `authStorage` (sessionStorage por aba), nunca
 * de `localStorage` diretamente.
 */
export function useSuperAdminGuard(): EstadoGuardSuperAdmin {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoGuardSuperAdmin>('verificando')

  useEffect(() => {
    const token = getAuthToken()
    const perfil = getUserPerfil()

    // Token ausente OU presente mas indecodificável (perfil não extraível):
    // não é possível verificar a permissão. Avisa e não libera, sem
    // redirecionar (pode ser estado transitório de sessão). (Req 1.5)
    if (!token || perfil === null) {
      notifications.show({
        title: 'Erro',
        message: 'Não foi possível verificar a permissão de acesso',
        color: 'red',
      })
      setEstado('negado')
      return
    }

    // Perfil válido, porém não é SUPER_ADMIN: acesso negado + redirect. (Req 1.3)
    if (perfil !== 'SUPER_ADMIN') {
      notifications.show({
        title: 'Acesso negado',
        message: 'Acesso não autorizado',
        color: 'red',
      })
      router.replace('/dashboard')
      setEstado('negado')
      return
    }

    setEstado('permitido')
  }, [router])

  return estado
}
