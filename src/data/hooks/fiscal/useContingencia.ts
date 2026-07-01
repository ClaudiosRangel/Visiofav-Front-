import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// === Tipos Contingência ===

export interface StatusContingencia {
  sefazOnline: boolean
  ultimaVerificacao: string
  totalPendentes: number
}

export interface ItemFilaContingencia {
  id: string
  tipoDocumento: string
  numero: number
  dataEnfileiramento: string
  tentativas: number
  status: 'PENDENTE' | 'TRANSMITIDO' | 'FALHA'
  erro: string | null
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// === Hook useContingencia ===

export function useContingencia() {
  function useStatus() {
    return useQuery<StatusContingencia>({
      queryKey: ['fiscal', 'contingencia', 'status'],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/contingencia/status')
        return data
      },
      refetchInterval: 30_000,
    })
  }

  function useFila(params?: { page?: number; limit?: number }) {
    return useQuery<PaginatedResponse<ItemFilaContingencia>>({
      queryKey: ['fiscal', 'contingencia', 'fila', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/contingencia', { params })
        return data
      },
      refetchInterval: 30_000,
    })
  }

  function useRetransmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await api.post(`/fiscal/contingencia/${id}/retransmitir`)
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['fiscal', 'contingencia'] })
        qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] })
      },
    })
  }

  function useRetransmitirTodos() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async () => {
        const { data } = await api.post('/fiscal/contingencia/retransmitir-todos')
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['fiscal', 'contingencia'] })
        qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] })
      },
    })
  }

  return { useStatus, useFila, useRetransmitir, useRetransmitirTodos }
}
