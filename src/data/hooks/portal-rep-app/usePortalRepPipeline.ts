import { useQuery } from '@tanstack/react-query'
import { portalRepApi } from './portal-rep-api'
import type { PedidoPipeline, DetalhePipeline } from './types'

const QUERY_KEY = 'portal-rep-pipeline'

export function usePortalRepPipeline(params?: Record<string, unknown>) {
  return useQuery<PedidoPipeline[]>({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/pipeline', { params })
      // A API retorna objeto paginado { data: [...], total, pagina, porPagina }
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.data)) return data.data
      return []
    },
  })
}

export function usePortalRepPipelineDetalhe(pedidoVendaId: string | undefined | null) {
  return useQuery<DetalhePipeline>({
    queryKey: [QUERY_KEY, pedidoVendaId],
    queryFn: async () => {
      const { data } = await portalRepApi.get(`/pipeline/${pedidoVendaId}`)
      return data
    },
    enabled: !!pedidoVendaId,
  })
}
