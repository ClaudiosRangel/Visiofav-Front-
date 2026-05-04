'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { useEmpresa } from '@/providers/EmpresaProvider'

export function useModuloGuard(modulo: string) {
  const { modulos } = useEmpresa()
  const router = useRouter()

  useEffect(() => {
    if (modulos.length > 0 && !modulos.includes(modulo)) {
      notifications.show({
        title: 'Acesso negado',
        message: 'Acesso negado ao módulo',
        color: 'red',
      })
      router.replace('/modulos')
    }
  }, [modulo, modulos, router])
}
