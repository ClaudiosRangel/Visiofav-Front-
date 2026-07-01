import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// === Tipos Dashboard Fiscal ===

export interface MetricasFiscais {
  nfeEmitidasMes: number
  nfePendentes: number
  valorFaturadoMes: number
  certificadosProximoVencimento: number
  documentosContingencia: number
}

// === Hook useDashboardFiscal ===

export function useDashboardFiscal() {
  return useQuery<MetricasFiscais>({
    queryKey: ['fiscal', 'dashboard', 'metricas'],
    queryFn: async () => {
      const { data } = await api.get('/fiscal/dashboard/metricas')
      return data
    },
    staleTime: 1000 * 60 * 5,
  })
}
