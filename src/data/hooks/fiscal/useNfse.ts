import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FiscalFilters, PaginatedResponse, DocumentoFiscal } from './types'

export function useNfse() {
  function useListar(params?: FiscalFilters) {
    return useQuery<PaginatedResponse<DocumentoFiscal>>({
      queryKey: ['fiscal', 'nfse', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/nfse', { params })
        return data
      },
      staleTime: 1000 * 60 * 2,
    })
  }

  function useEmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: any) => {
        const { data } = await api.post('/fiscal/nfse/emitir', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'nfse'] }),
    })
  }

  return { useListar, useEmitir }
}
