import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portalRepApi } from './portal-rep-api'
import type { SolicitacaoOrcamento, CriarSolicitacaoPayload } from './types'

const QUERY_KEY = 'portal-rep-solicitacoes-orcamento'

export function usePortalRepOrcamentos(params?: Record<string, unknown>) {
  return useQuery<SolicitacaoOrcamento[]>({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/solicitacoes-orcamento', { params })
      // A API retorna objeto paginado { dados, total, page, limit, totalPages }
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.dados)) return data.dados
      return []
    },
  })
}

export function usePortalRepOrcamentoDetalhe(id: string | null | undefined) {
  return useQuery<SolicitacaoOrcamento>({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await portalRepApi.get(`/solicitacoes-orcamento/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCriarSolicitacao() {
  const qc = useQueryClient()
  return useMutation<SolicitacaoOrcamento, Error, CriarSolicitacaoPayload>({
    mutationFn: async (body) => {
      const { data } = await portalRepApi.post('/solicitacoes-orcamento', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useCancelarSolicitacao() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await portalRepApi.delete(`/solicitacoes-orcamento/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
