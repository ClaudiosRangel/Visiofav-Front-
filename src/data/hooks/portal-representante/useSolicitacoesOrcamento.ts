import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SolicitacoesFilters, PaginatedResponse, SolicitacaoOrcamento } from './types'

const QUERY_KEY = 'portal-rep-solicitacoes'

export function useSolicitacoesOrcamento(params: SolicitacoesFilters) {
  return useQuery<PaginatedResponse<SolicitacaoOrcamento>>({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get('/portal-rep/admin/solicitacoes-orcamento', { params })
      return data
    },
  })
}

export function useCalcularOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/portal-rep/admin/solicitacoes-orcamento/${id}/calcular`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useConverterEmPedido() {
  const qc = useQueryClient()
  return useMutation<{ message: string; pedido: { id: string; numero: number } }, Error, string>({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/portal-rep/admin/solicitacoes-orcamento/${id}/converter-pedido`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useEnviarParaOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/portal-rep/admin/solicitacoes-orcamento/${id}/enviar-orcamento`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useLiberarParaPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/portal-rep/admin/solicitacoes-orcamento/${id}/liberar-pedido`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useRecusarSolicitacao() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, { id: string; motivoRecusa: string }>({
    mutationFn: async ({ id, motivoRecusa }) => {
      const { data } = await api.post(`/portal-rep/admin/solicitacoes-orcamento/${id}/recusar`, { motivoRecusa })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
