import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type TipoExcecao = 'HOLD' | 'CCE' | 'SENHA'

export interface ItemFilaExcecoes {
  id: string
  origemId: string
  tipo: TipoExcecao
  notaEntradaId: string
  notaNumero: number
  fornecedor: string | null
  itemNotaEntradaId: string | null
  descricaoProduto: string
  motivo: string
  motivoDetalhe: string | null
  criadoEm: string
}

export interface FiltrosFilaExcecoes {
  fornecedor?: string
  notaId?: string
  tipo?: TipoExcecao
  dataInicio?: string
  dataFim?: string
}

const KEY = 'fila-excecoes'

export function useFilaExcecoes(filtros?: FiltrosFilaExcecoes) {
  return useQuery<{ data: ItemFilaExcecoes[]; total: number }>({
    queryKey: [KEY, filtros],
    queryFn: async () => {
      const { data } = await api.get('/fila-excecoes', { params: filtros })
      return data
    },
    staleTime: 1000 * 30,
  })
}

export function useResolverHold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemNotaEntradaId, acao }: { itemNotaEntradaId: string; acao: 'ACEITAR' | 'REJEITAR' | 'RETORNAR_SEGUNDA_CONFERENCIA' }) => {
      const { data } = await api.post(`/fila-excecoes/${itemNotaEntradaId}/resolver-hold`, { acao })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['conferencia-notas-pendentes'] })
    },
  })
}

export function useResolverCceNaFila() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ pendenciaId, status }: { pendenciaId: string; status: 'RESOLVIDA' | 'CANCELADA' }) => {
      const { data } = await api.post(`/fila-excecoes/${pendenciaId}/resolver-cce`, { status })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['pendencias-cce'] })
    },
  })
}
