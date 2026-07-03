import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface VendaEncomenda {
  id: string
  pedido: string
  status: string
  ordemProducao?: string
  previsaoEntrega?: string
  criadoEm: string
}

export function useVendasEncomenda(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['vendas-encomenda', params],
    queryFn: async () => {
      const { data } = await api.get('/vendas-encomenda', { params })
      return data as { data: VendaEncomenda[]; total: number; page: number; limit: number }
    },
  })
}

export function useCriarVendaEncomenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/vendas-encomenda', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendas-encomenda'] }),
  })
}

export function useEditarVendaEncomenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.patch(`/vendas-encomenda/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendas-encomenda'] }),
  })
}
