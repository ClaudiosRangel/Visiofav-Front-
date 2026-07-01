import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FiscalFilters, PaginatedResponse, DocumentoFiscal } from './types'

export function useMdfe() {
  function useListar(params?: FiscalFilters) {
    return useQuery<PaginatedResponse<DocumentoFiscal>>({
      queryKey: ['fiscal', 'mdfe', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/mdfe', { params })
        return data
      },
      staleTime: 1000 * 60 * 2,
    })
  }

  function useEmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: any) => {
        const { data } = await api.post('/fiscal/mdfe/emitir', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'mdfe'] }),
    })
  }

  return { useListar, useEmitir }
}
