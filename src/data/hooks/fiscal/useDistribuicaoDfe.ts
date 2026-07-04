import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PaginatedResponse } from './types'

// === Tipos ===

export type StatusDistribuicaoDfe = 'PENDENTE' | 'PROCESSADO' | 'ENTRADA_GERADA'

export interface DocumentoDistribuicaoDfe {
  id: string
  chaveAcesso: string
  tipo: 'NFE' | 'CTE'
  emitenteCnpj: string
  emitenteRazao: string
  valorTotal: number
  dataEmissao: string
  manifestacao: string | null
  documentoEntradaId: string | null
  criadoEm: string
  status: StatusDistribuicaoDfe
}

export interface DistribuicaoDfeFilters {
  status?: StatusDistribuicaoDfe
  dataInicio?: string
  dataFim?: string
  page?: number
  limit?: number
}

export interface ResultadoConsulta {
  documentosProcessados: number
  chavesAcesso: string[]
  ultimoNsu: string
  hasMaisDocumentos: boolean
  erros: Array<{ nsu: string; erro: string }>
  mensagem: string
}

export interface StatusDfe {
  ultimoNsu: string
  documentosPendentesLancamento: number
}

// === Hook ===

export function useDistribuicaoDfe() {
  const qc = useQueryClient()

  function useListar(params?: DistribuicaoDfeFilters) {
    return useQuery<PaginatedResponse<DocumentoDistribuicaoDfe>>({
      queryKey: ['fiscal', 'distribuicao-dfe', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/distribuicao-dfe', { params })
        return data
      },
    })
  }

  function useStatus() {
    return useQuery<StatusDfe>({
      queryKey: ['fiscal', 'distribuicao-dfe', 'status'],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/distribuicao-dfe/status')
        return data
      },
    })
  }

  function useConsultar() {
    return useMutation<ResultadoConsulta>({
      mutationFn: async () => {
        const { data } = await api.post('/fiscal/distribuicao-dfe/consultar')
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['fiscal', 'distribuicao-dfe'] })
      },
    })
  }

  function useGerarEntrada() {
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await api.post(`/fiscal/distribuicao-dfe/${id}/gerar-entrada`)
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['fiscal', 'distribuicao-dfe'] })
      },
    })
  }

  return { useListar, useStatus, useConsultar, useGerarEntrada }
}
