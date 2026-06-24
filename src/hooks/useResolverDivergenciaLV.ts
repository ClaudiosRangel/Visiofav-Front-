'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ResolverDivergenciaLVPayload {
  divergenciaId: string
  acao: 'ACEITAR' | 'REJEITAR'
  credenciaisSupervisor?: {
    usuario: string
    senha: string
  }
}

export interface RespostaResolucao {
  divergenciaId: string
  status: 'ACEITA' | 'PENDENTE' | 'PENDENTE_CCE' | 'REJEITADA'
  modo: string
  cce?: {
    sucesso: boolean
    protocolo?: string
    motivoRejeicao?: string
  }
  mensagem: string
}

export function useResolverDivergenciaLV() {
  const queryClient = useQueryClient()

  return useMutation<RespostaResolucao, Error, ResolverDivergenciaLVPayload>({
    mutationFn: async (body) => {
      const { data } = await api.post('/conferencia-entrada/resolver-divergencia-lv', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conferencia-entrada'] })
    },
  })
}

export type StatusDivergencia = 'PENDENTE' | 'ACEITA' | 'PENDENTE_CCE' | 'REJEITADA' | 'BLOQUEADA'

/**
 * Gate de finalização: retorna true se a finalização está habilitada
 * (nenhuma divergência com status PENDENTE).
 */
export function isFinalizacaoHabilitada(divergencias: { status: string }[]): boolean {
  return divergencias.every((d) => d.status !== 'PENDENTE')
}
