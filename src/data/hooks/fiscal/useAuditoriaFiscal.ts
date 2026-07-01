import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PaginatedResponse, FiscalFilters } from './types'

// === Tipos Auditoria ===

export interface LogAuditoria {
  id: string
  dataHora: string
  usuario: string
  operacao: string
  documento: string
  detalhes: Record<string, unknown>
}

// === Hook useAuditoriaFiscal ===

export function useAuditoriaFiscal() {
  function useListar(params?: FiscalFilters & { usuario?: string; operacao?: string }) {
    return useQuery<PaginatedResponse<LogAuditoria>>({
      queryKey: ['fiscal', 'auditoria', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/auditoria', { params })
        return data
      },
    })
  }

  return { useListar }
}
