import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FiscalFilters, PaginatedResponse, DocumentoFiscal } from './types'

export function useCte() {
  function useListar(params?: FiscalFilters) {
    return useQuery<PaginatedResponse<DocumentoFiscal>>({
      queryKey: ['fiscal', 'cte', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/cte', { params })
        return data
      },
      staleTime: 1000 * 60 * 2,
    })
  }

  function useDetalhe(id: string | null) {
    return useQuery({
      queryKey: ['fiscal', 'cte', id],
      queryFn: async () => {
        const { data } = await api.get(`/fiscal/cte/${id}`)
        return data
      },
      enabled: !!id,
    })
  }

  function useEmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: any) => {
        const { data } = await api.post('/fiscal/cte/emitir', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useCancelar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, justificativa }: { id: string; justificativa: string }) => {
        const { data } = await api.post(`/fiscal/cte/${id}/cancelar`, { justificativa })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useCartaCorrecao() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, textoCorrecao, grupoAlterado, campoAlterado }: {
        id: string; textoCorrecao: string; grupoAlterado?: string; campoAlterado?: string
      }) => {
        const { data } = await api.post(`/fiscal/cte/${id}/carta-correcao`, {
          textoCorrecao, grupoAlterado, campoAlterado,
        })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useInutilizar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: {
        serie: number; numeroInicial: number; numeroFinal: number; justificativa: string
      }) => {
        const { data } = await api.post('/fiscal/cte/inutilizar', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useDuplicar() {
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await api.post(`/fiscal/cte/${id}/duplicar`)
        return data
      },
    })
  }

  function baixarDacte(id: string) {
    return api.get(`/fiscal/cte/${id}/dacte`, { responseType: 'blob' })
  }

  function baixarXml(id: string) {
    return api.get(`/fiscal/cte/${id}/xml`, { responseType: 'blob' })
  }

  return {
    useListar,
    useDetalhe,
    useEmitir,
    useCancelar,
    useCartaCorrecao,
    useInutilizar,
    useDuplicar,
    baixarDacte,
    baixarXml,
  }
}
