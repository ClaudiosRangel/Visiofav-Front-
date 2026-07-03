import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface FiltroRelatorio {
  dataInicio?: string
  dataFim?: string
  vendedorId?: string
  clienteId?: string
}

export function useResumoVendas(filtros: FiltroRelatorio) {
  return useQuery({
    queryKey: ['relatorios-vendas', 'resumo', filtros],
    queryFn: async () => {
      const { data } = await api.get('/relatorios/vendas/resumo', { params: filtros })
      return data as {
        totalPedidos: number
        faturamentoTotal: number
        ticketMedio: number
        pedidosCancelados: number
        taxaCancelamento: number
      }
    },
  })
}

export function useVendasPorPeriodo(filtros: FiltroRelatorio & { agrupamento?: string }) {
  return useQuery({
    queryKey: ['relatorios-vendas', 'por-periodo', filtros],
    queryFn: async () => {
      const { data } = await api.get('/relatorios/vendas/por-periodo', { params: filtros })
      return data as { periodo: string; total: number; quantidade: number; ticketMedio: number }[]
    },
  })
}

export function useVendasPorVendedor(filtros: FiltroRelatorio) {
  return useQuery({
    queryKey: ['relatorios-vendas', 'por-vendedor', filtros],
    queryFn: async () => {
      const { data } = await api.get('/relatorios/vendas/por-vendedor', { params: filtros })
      return data as { vendedorId: string; nome: string; totalVendas: number; quantidadePedidos: number; ticketMedio: number; comissaoEstimada: number }[]
    },
  })
}

export function useVendasPorCliente(filtros: FiltroRelatorio & { top?: number }) {
  return useQuery({
    queryKey: ['relatorios-vendas', 'por-cliente', filtros],
    queryFn: async () => {
      const { data } = await api.get('/relatorios/vendas/por-cliente', { params: filtros })
      return data as { clienteId: string; nome: string; totalCompras: number; quantidadePedidos: number; ticketMedio: number }[]
    },
  })
}

export function useCurvaABC(filtros: FiltroRelatorio) {
  return useQuery({
    queryKey: ['relatorios-vendas', 'curva-abc', filtros],
    queryFn: async () => {
      const { data } = await api.get('/relatorios/vendas/curva-abc', { params: filtros })
      return data as { produtoId: string; nome: string; codigo: string; faturamento: number; quantidade: number; percentualFaturamento: number; percentualAcumulado: number; classificacao: 'A' | 'B' | 'C' }[]
    },
  })
}
