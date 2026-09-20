'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { useEmpresa } from '@/providers/EmpresaProvider'

/**
 * Restringe o acesso a uma tela pelos módulos da empresa.
 *
 * Aceita um módulo (string) ou uma lista (string[]). Quando é lista, o acesso
 * é liberado se a empresa tiver QUALQUER um dos módulos — usado por telas
 * compartilhadas entre módulos (ex.: Hierarquia Mercadológica, que pertence a
 * Produtos/Compras e ao WMS).
 */
export function useModuloGuard(modulo: string | string[]) {
  const { modulos } = useEmpresa()
  const router = useRouter()

  useEffect(() => {
    if (modulos.length === 0) return
    const requeridos = Array.isArray(modulo) ? modulo : [modulo]
    const temAcesso = requeridos.some((m) => modulos.includes(m))
    if (!temAcesso) {
      notifications.show({
        title: 'Acesso negado',
        message: 'Acesso negado ao módulo',
        color: 'red',
      })
      router.replace('/modulos')
    }
  }, [modulo, modulos, router])
}
