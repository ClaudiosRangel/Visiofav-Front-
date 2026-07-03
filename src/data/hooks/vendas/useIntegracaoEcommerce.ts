import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface IntegracaoEcommerce {
  id: string
  plataforma: string
  storeId: string
  ativo: boolean
  ultimaSync?: string
  criadoEm: string
}

export interface PedidoEcommerce {
  id: string
  integracaoId: string
  pedidoExterno: string
  status: string
  valorTotal: number
  criadoEm: string
}

export function useIntegracoesEcommerce(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['integracao-ecommerce', params],
    queryFn: async () => {
      const { data } = await api.get('/integracao-ecommerce', { params })
      return data as { data: IntegracaoEcommerce[]; total: number; page: number; limit: number }
    },
  })
}

export function usePedidosEcommerce(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['integracao-ecommerce-pedidos', params],
    queryFn: async () => {
      const { data } = await api.get('/integracao-ecommerce/pedidos', { params })
      return data as { data: PedidoEcommerce[]; total: number; page: number; limit: number }
    },
  })
}

export function useCriarIntegracaoEcommerce() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/integracao-ecommerce', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integracao-ecommerce'] }),
  })
}

export function useEditarIntegracaoEcommerce() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.put(`/integracao-ecommerce/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integracao-ecommerce'] }),
  })
}
