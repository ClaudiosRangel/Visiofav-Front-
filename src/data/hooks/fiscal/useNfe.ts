import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FiscalFilters, PaginatedResponse, DocumentoFiscal, EmissaoNfePayload } from './types'

export function useNfe() {
  function useListar(params?: FiscalFilters) {
    return useQuery<PaginatedResponse<DocumentoFiscal>>({
      queryKey: ['fiscal', 'nfe', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/nfe', { params })
        return data
      },
      staleTime: 1000 * 60 * 2,
    })
  }

  function useDetalhe(id: string) {
    return useQuery<DocumentoFiscal>({
      queryKey: ['fiscal', 'nfe', id],
      queryFn: async () => {
        const { data } = await api.get(`/fiscal/nfe/${id}`)
        return data
      },
      enabled: !!id,
    })
  }

  function useEmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: EmissaoNfePayload) => {
        const { data } = await api.post('/fiscal/nfe/emitir', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] }),
    })
  }

  function useCancelar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, justificativa }: { id: string; justificativa: string }) => {
        const { data } = await api.post(`/fiscal/nfe/${id}/cancelar`, { justificativa })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] }),
    })
  }

  function useCartaCorrecao() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, textoCorrecao }: { id: string; textoCorrecao: string }) => {
        const { data } = await api.post(`/fiscal/nfe/${id}/cce`, { textoCorrecao })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] }),
    })
  }

  return { useListar, useDetalhe, useEmitir, useCancelar, useCartaCorrecao }
}
