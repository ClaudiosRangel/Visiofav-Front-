import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PedidosVendaFilters, PedidosVendaResponse, PedidoVenda, FaturarParcialPayload } from './types'
import type { PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'

const QUERY_KEY = 'pedidos-venda'

export function usePedidosVenda(params?: PedidosVendaFilters) {
  return useQuery<PedidosVendaResponse>({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await api.get('/pedidos-venda', { params })
      return data
    },
    staleTime: 1000 * 60 * 2,
  })
}

export function usePedidoVenda(id: string) {
  return useQuery<PedidoVenda>({
    queryKey: [QUERY_KEY, id],
    queryFn: async () => {
      const { data } = await api.get(`/pedidos-venda/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCriarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: PedidoVendaFormValues) => {
      const { data } = await api.post('/pedidos-venda', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useEditarPedido(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<PedidoVendaFormValues>) => {
      const { data } = await api.put(`/pedidos-venda/${id}`, body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [QUERY_KEY, id] })
    },
  })
}

export function useConfirmarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/pedidos-venda/${id}/confirmar`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useCancelarPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data } = await api.patch(`/pedidos-venda/${id}/cancelar`, { motivo })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useFaturarParcial(pedidoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: FaturarParcialPayload) => {
      const { data } = await api.post(`/pedidos-venda/${pedidoId}/faturar`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
      qc.invalidateQueries({ queryKey: [QUERY_KEY, pedidoId] })
    },
  })
}
