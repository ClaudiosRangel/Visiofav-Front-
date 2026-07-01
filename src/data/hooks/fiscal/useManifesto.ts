import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PaginatedResponse, FiscalFilters } from './types'

// === Tipos Manifesto ===

export interface NfeRecebida {
  chaveAcesso: string
  emitente: string
  valor: number
  dataEmissao: string
  situacaoManifesto: 'SEM_MANIFESTO' | 'CIENCIA' | 'CONFIRMADA' | 'DESCONHECIDA' | 'NAO_REALIZADA'
}

export type EventoManifesto = 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao-realizada'

// === Hook useManifesto ===

export function useManifesto() {
  function useListar(params?: FiscalFilters & { situacao?: string }) {
    return useQuery<PaginatedResponse<NfeRecebida>>({
      queryKey: ['fiscal', 'manifesto', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/manifesto', { params })
        return data
      },
    })
  }

  function useManifestar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ chave, evento }: { chave: string; evento: EventoManifesto }) => {
        const { data } = await api.post(`/fiscal/manifesto/${chave}/${evento}`)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'manifesto'] }),
    })
  }

  return { useListar, useManifestar }
}
