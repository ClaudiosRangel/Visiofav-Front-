import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDevolucoesVenda(params: { page?: number; limit?: number; vendaEfetivadaId?: string }) {
  return useQuery({
    queryKey: ['devolucoes-venda', params],
    queryFn: async () => {
      const { data } = await api.get('/devolucoes-venda', { params })
      return data as { data: any[]; total: number; page: number; limit: number }
    },
  })
}

export function useDevolucaoVenda(id: string) {
  return useQuery({
    queryKey: ['devolucoes-venda', id],
    queryFn: async () => {
      const { data } = await api.get(`/devolucoes-venda/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCriarDevolucaoVenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { vendaEfetivadaId: string; motivo: string; itens: { produtoId: string; quantidade: number; motivoItem?: string }[] }) => {
      const { data } = await api.post('/devolucoes-venda', body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devolucoes-venda'] })
      qc.invalidateQueries({ queryKey: ['pedidos-venda'] })
    },
  })
}
