import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface MetaVendedor {
  id: string
  vendedor: { id: string; nome: string }
  periodo: string
  metaValor: number
  realizadoValor: number
  criadoEm: string
}

export function useMetasVendedor(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['forca-vendas', params],
    queryFn: async () => {
      const { data } = await api.get('/forca-vendas', { params })
      return data as { data: MetaVendedor[]; total: number; page: number; limit: number }
    },
  })
}

export function useCriarMetaVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/forca-vendas', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forca-vendas'] }),
  })
}

export function useEditarMetaVendedor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.put(`/forca-vendas/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forca-vendas'] }),
  })
}
