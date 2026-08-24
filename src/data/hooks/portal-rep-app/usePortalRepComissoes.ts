import { useQuery } from '@tanstack/react-query'
import { portalRepApi } from './portal-rep-api'
import type { ResumoComissao, DetalheComissao } from './types'

const QUERY_KEY_COMISSOES = 'portal-rep-comissoes'
const QUERY_KEY_DETALHE = 'portal-rep-comissoes-detalhe'

export function usePortalRepComissoes(params: { mes: number; ano: number }) {
  return useQuery<ResumoComissao>({
    queryKey: [QUERY_KEY_COMISSOES, params],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/comissoes', { params })
      return data
    },
  })
}

export function usePortalRepComissoesDetalhe(params?: Record<string, unknown>) {
  return useQuery<DetalheComissao[]>({
    queryKey: [QUERY_KEY_DETALHE, params],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/comissoes/detalhe', { params })
      // A API retorna objeto paginado { data: [...], total, page, limit }
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.data)) return data.data
      return []
    },
  })
}
