import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface VendaConsignada {
  id: string
  numero: string
  cliente: string
  status: string
  dataRemessa?: string
  valorTotal: number
  criadoEm: string
}

export function useVendasConsignadas(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['vendas-consignadas', params],
    queryFn: async () => {
      const { data } = await api.get('/vendas-consignadas', { params })
      return data as { data: VendaConsignada[]; total: number; page: number; limit: number }
    },
  })
}

export function useCriarVendaConsignada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/vendas-consignadas', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendas-consignadas'] }),
  })
}

export function useEditarVendaConsignada() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.patch(`/vendas-consignadas/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendas-consignadas'] }),
  })
}
