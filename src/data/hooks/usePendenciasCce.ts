import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface PendenciaCce {
  id: string
  fornecedor: string
  notaFiscal: string
  criadoEm: string
  codigoProduto: string
  descricaoProduto: string
  motivo: string
  status: 'AGUARDANDO_CCE' | 'RESOLVIDA' | 'CANCELADA'
}

export interface FiltrosPendencia {
  fornecedor?: string
  dataInicial?: string
  dataFinal?: string
  status?: string
}

const KEY = 'pendencias-cce'

export function usePendenciasCce(filtros?: FiltrosPendencia) {
  return useQuery<PendenciaCce[]>({
    queryKey: [KEY, filtros],
    queryFn: async () => {
      const { data } = await api.get('/pendencias-cce', { params: filtros })
      return data.data ?? data
    },
    staleTime: 1000 * 30,
  })
}

export function useResolverPendencia() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'RESOLVIDA' | 'CANCELADA' }) => {
      const { data } = await api.patch(`/pendencias-cce/${id}/resolver`, { status })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
