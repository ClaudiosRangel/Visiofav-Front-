'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

export interface OrdenarItem {
  id: string
  posicao: number
}

interface OrdenarResponse {
  message: string
  count: number
}

export function useCentrosOrdenacao() {
  const queryClient = useQueryClient()

  return useMutation<OrdenarResponse, any, OrdenarItem[]>({
    mutationFn: async (itens: OrdenarItem[]) => {
      const { data } = await api.patch('/centros-producao/ordenar', { itens })
      return data
    },
    onMutate: async (itens) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['centros-producao'] })

      // Snapshot previous value for rollback
      const previous = queryClient.getQueryData(['centros-producao'])

      // Optimistic update: apply new positions to cached data
      queryClient.setQueryData(['centros-producao'], (old: any) => {
        if (!old) return old
        const data = Array.isArray(old) ? old : old.data
        if (!Array.isArray(data)) return old

        const updated = data.map((centro: any) => {
          const item = itens.find((i) => i.id === centro.id)
          if (item) return { ...centro, posicao: item.posicao }
          return centro
        })

        // Sort by posicao ASC, then codigo ASC
        updated.sort((a: any, b: any) => {
          if (a.posicao !== b.posicao) return a.posicao - b.posicao
          return (a.codigo || '').localeCompare(b.codigo || '')
        })

        return Array.isArray(old) ? updated : { ...old, data: updated }
      })

      return { previous }
    },
    onError: (err, _variables, context) => {
      // Rollback to snapshot on error
      if (context?.previous) {
        queryClient.setQueryData(['centros-producao'], context.previous)
      }
      notifications.show({
        title: 'Erro ao reordenar',
        message: err?.response?.data?.message || 'Falha ao salvar a nova ordem',
        color: 'red',
      })
    },
    onSettled: () => {
      // Always refetch after mutation settles to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['centros-producao'] })
    },
  })
}
