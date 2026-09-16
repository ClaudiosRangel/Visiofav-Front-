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

export function useEnviarParaOrcamento() {
  const qc = useQueryClient()
  return useMutation<
    { message: string; orcamentoGraficoId: string; numero: number },
    Error,
    { id: string; tipoEmbalagemId?: string }
  >({
    mutationFn: async ({ id, tipoEmbalagemId }) => {
      const { data } = await api.post(
        `/portal-rep/admin/solicitacoes-orcamento/${id}/enviar-orcamento`,
        tipoEmbalagemId ? { tipoEmbalagemId } : {},
      )
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

/** Lista tipos de embalagem (para o seletor de fallback ao enviar p/ orçamento). */
export function useTiposEmbalagem() {
  return useQuery<{ id: string; codigo: string; descricao: string }[]>({
    queryKey: ['tipos-embalagem-select'],
    queryFn: async () => {
      const { data } = await api.get('/orcamento-grafico/tipos-embalagem', { params: { limit: 100 } })
      return (data?.data ?? []).map((t: any) => ({ id: t.id, codigo: t.codigo, descricao: t.descricao }))
    },
  })
}
