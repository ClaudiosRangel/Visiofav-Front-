import { useQuery } from '@tanstack/react-query'
import { portalRepApi } from './portal-rep-api'
import type { DashboardData, PedidoPipeline, ResumoComissao, StatusPedido } from './types'

const QUERY_KEY = 'portal-rep-dashboard'

export function usePortalRepDashboard() {
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const orcamentosQuery = useQuery<number>({
    queryKey: [QUERY_KEY, 'orcamentos-pendentes'],
    queryFn: async () => {
      const { data } = await portalRepApi.get(
        '/solicitacoes-orcamento',
        { params: { status: 'PENDENTE' } },
      )
      // A API retorna objeto paginado { dados: [...], total, ... }
      if (Array.isArray(data)) return data.length
      if (data && typeof data.total === 'number') return data.total
      if (data && Array.isArray(data.dados)) return data.dados.length
      return 0
    },
  })

  const pipelineQuery = useQuery<Record<StatusPedido, number>>({
    queryKey: [QUERY_KEY, 'pipeline'],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/pipeline')
      // A API retorna objeto paginado { data: [...], total, pagina, porPagina }
      const pedidos: PedidoPipeline[] = Array.isArray(data) ? data : (data?.data ?? [])
      const summary: Record<StatusPedido, number> = {
        ORCAMENTO: 0,
        PV: 0,
        OP: 0,
        PRODUCAO: 0,
        EXPEDICAO: 0,
        ENTREGUE: 0,
      }
      for (const pedido of pedidos) {
        const etapa = pedido.etapaAtual as StatusPedido
        if (etapa in summary) {
          summary[etapa]++
        }
      }
      return summary
    },
  })

  const comissaoQuery = useQuery<{ projetada: number; realizada: number }>({
    queryKey: [QUERY_KEY, 'comissao', mes, ano],
    queryFn: async () => {
      const { data } = await portalRepApi.get<ResumoComissao>('/comissoes', {
        params: { mes, ano },
      })
      return { projetada: data.projetada, realizada: data.realizada }
    },
  })

  const isLoading = orcamentosQuery.isLoading || pipelineQuery.isLoading || comissaoQuery.isLoading

  const dashboardData: DashboardData | undefined =
    orcamentosQuery.data !== undefined &&
    pipelineQuery.data !== undefined &&
    comissaoQuery.data !== undefined
      ? {
          orcamentosPendentes: orcamentosQuery.data,
          pipeline: pipelineQuery.data,
          comissaoMes: comissaoQuery.data,
        }
      : undefined

  return {
    data: dashboardData,
    orcamentosPendentes: orcamentosQuery.data,
    pipelineSummary: pipelineQuery.data,
    comissaoMes: comissaoQuery.data,
    isLoading,
    orcamentosQuery,
    pipelineQuery,
    comissaoQuery,
  }
}
