import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portalRepApi } from './portal-rep-api'
import type { Notificacao } from './types'

const QUERY_KEY = 'portal-rep-notificacoes'
const COUNT_QUERY_KEY = 'portal-rep-notificacoes-count'

interface NotificacoesPaginadas {
  notificacoes: Notificacao[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function usePortalRepNotificacoes(params?: Record<string, unknown>) {
  return useQuery<NotificacoesPaginadas>({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/notificacoes', { params })
      return data
    },
  })
}

export function useMarcarLida() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await portalRepApi.put(`/notificacoes/${id}/lida`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [COUNT_QUERY_KEY] })
    },
  })
}

export function useMarcarTodasLidas() {
  const qc = useQueryClient()
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await portalRepApi.put('/notificacoes/ler-todas')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [COUNT_QUERY_KEY] })
    },
  })
}

export function useCountNaoLidas() {
  return useQuery<number>({
    queryKey: [COUNT_QUERY_KEY],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/notificacoes/count-nao-lidas')
      return data.count
    },
    refetchInterval: 60000,
  })
}
