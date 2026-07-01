import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// === Tipos SPED ===

export interface SpedGeracaoPayload {
  tipo: 'EFD_ICMS_IPI' | 'EFD_CONTRIBUICOES' | 'ECD' | 'ECF' | 'REINF'
  periodo: string // YYYY-MM
}

export interface SpedHistorico {
  id: string
  tipo: string
  periodo: string
  status: 'GERADO' | 'ERRO'
  nomeArquivo: string
  criadoEm: string
  erro: string | null
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// === Hook useSped ===

export function useSped() {
  function useHistorico(params?: Record<string, unknown>) {
    return useQuery<PaginatedResponse<SpedHistorico>>({
      queryKey: ['fiscal', 'sped', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/sped', { params })
        return data
      },
    })
  }

  function useGerar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: SpedGeracaoPayload) => {
        const { data } = await api.post(`/fiscal/sped/${payload.tipo}/gerar`, {
          periodo: payload.periodo,
        })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'sped'] }),
    })
  }

  return { useHistorico, useGerar }
}
