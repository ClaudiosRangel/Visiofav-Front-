import { useQuery } from '@tanstack/react-query'
import { portalRepApi } from './portal-rep-api'
import type { DashboardData, SolicitacaoOrcamento, PedidoPipeline, ResumoComissao, StatusPedido } from './types'

const QUERY_KEY = 'portal-rep-dashboard'

export function usePortalRepDashboard() {
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const orcamentosQuery = useQuery<number>({
    queryKey: [QUERY_KEY, 'orcamentos-pendentes'],
    queryFn: async () => {
      const { data } = await portalRepApi.get<SolicitacaoOrcamento[]>(
        '/solicitacoes-orcamento',
        { params: { status: 'PENDENTE' } },
      )
      return data.length
    },
  })

  const pipelineQuery = useQuery<Record<StatusPedido, number>>({
    queryKey: [QUERY_KEY, 'pipeline'],
    queryFn: async () => {
      const { data } = await portalRepApi.get<PedidoPipeline[]>('/pipeline')
      const summary: Record<StatusPedido, number> = {
        ORCAMENTO: 0,
        PV: 0,
        OP: 0,
        PRODUCAO: 0,
        EXPEDICAO: 0,
        ENTREGUE: 0,
      }
      for (const pedido of data) {
        summary[pedido.statusAtual]++
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
