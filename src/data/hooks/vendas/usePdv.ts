import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Caixa operations
export function useCaixaAtual() {
  return useQuery({
    queryKey: ['pdv', 'caixa-atual'],
    queryFn: async () => { const { data } = await api.get('/pdv/caixa/atual'); return data },
    retry: false,
  })
}

export function useAbrirCaixa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { numero: number; valorAbertura: number }) => {
      const { data } = await api.post('/pdv/caixa/abrir', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdv'] }),
  })
}

export function useFecharCaixa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { valorFechamento: number; observacao?: string }) => {
      const { data } = await api.post('/pdv/caixa/fechar', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdv'] }),
  })
}

export function useMovimentacaoCaixa() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { tipo: 'SANGRIA' | 'SUPRIMENTO'; valor: number; motivo: string }) => {
      const { data } = await api.post('/pdv/caixa/movimentacao', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdv'] }),
  })
}

export function useResumoCaixa(caixaId: string) {
  return useQuery({
    queryKey: ['pdv', 'resumo', caixaId],
    queryFn: async () => { const { data } = await api.get(`/pdv/caixa/${caixaId}/resumo`); return data },
    enabled: !!caixaId,
  })
}

// Venda operations
export function useIniciarVenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => { const { data } = await api.post('/pdv/venda/iniciar'); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdv'] }),
  })
}

export function useAdicionarItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ vendaId, ...body }: { vendaId: string; produtoId?: string; codigoBarras?: string; quantidade?: number; desconto?: number }) => {
      const { data } = await api.post(`/pdv/venda/${vendaId}/item`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdv', 'venda'] }),
  })
}

export function useRemoverItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ vendaId, itemId }: { vendaId: string; itemId: string }) => {
      const { data } = await api.delete(`/pdv/venda/${vendaId}/item/${itemId}`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdv', 'venda'] }),
  })
}

export function useFinalizarVenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ vendaId, ...body }: { vendaId: string; pagamentos: Array<{ forma: string; valor: number }>; cpfCnpjConsumidor?: string; desconto?: number }) => {
      const { data } = await api.post(`/pdv/venda/${vendaId}/finalizar`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdv'] }),
  })
}

export function useCancelarVenda() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vendaId: string) => {
      const { data } = await api.post(`/pdv/venda/${vendaId}/cancelar`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pdv'] }),
  })
}

export function useDetalheVenda(vendaId: string) {
  return useQuery({
    queryKey: ['pdv', 'venda', vendaId],
    queryFn: async () => { const { data } = await api.get(`/pdv/venda/${vendaId}`); return data },
    enabled: !!vendaId,
    refetchInterval: 2000,
  })
}
