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

  return { useListar, useEmitir }
}
