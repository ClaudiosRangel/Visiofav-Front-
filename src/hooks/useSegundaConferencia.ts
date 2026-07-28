'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ItemSegundaConferenciaPayload {
  itemNotaEntradaId: string
  quantidadeConferida: number
  lote?: string
  validade?: string
  /** Operador clicou "Aceitar com divergência" para a quantidade desta rodada */
  aceitarDivergenciaQuantidade?: boolean
}

export type StatusResultadoSegundaConferencia =
  | 'resolvido'
  | 'divergenciaQuantidade'
  // Divergência de lote/validade confirmada e registrada — a notificação
  // fiscal (pendência CC-e ou e-mail) só é disparada quando a nota for
  // aprovada (ver campo `notificacaoFiscal` na resposta de /confirmar).
  | 'divergenciaRegistrada'
  | 'requerSenha'
  | 'bloqueado'
  | 'ignorado'
  | 'hold'

export interface ResultadoItemSegundaConferencia {
  itemNotaEntradaId: string
  resultado: {
    status: StatusResultadoSegundaConferencia
    divergenciaId?: string
    motivo?: string
    quantidadeNota?: number
    quantidadeConferida?: number
  }
}

export interface RespostaSegundaConferencia {
  divergenciaResolvida: boolean
  divergenciaQuantidade: boolean
  divergenciaRegistrada: boolean
  requerSenha: boolean
  bloqueado: boolean
  itens: ResultadoItemSegundaConferencia[]
}

/**
 * Submete a segunda conferência obrigatória de itens com divergência de
 * lote/validade detectada na 1ª conferência. Se os valores coincidem com a
 * NF-e, o item é auto-resolvido. Caso contrário, o backend decide entre
 * senha de supervisor, pendência CC-e ou e-mail fiscal.
 */
export function useSubmeterSegundaConferencia() {
  const queryClient = useQueryClient()
  return useMutation<RespostaSegundaConferencia, Error, { notaId: string; itens: ItemSegundaConferenciaPayload[] }>({
    mutationFn: async ({ notaId, itens }) => {
      const { data } = await api.post(`/conferencia-entrada/segunda-conferencia/${notaId}`, { itens })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conferencia-notas-pendentes'] })
    },
  })
}

/**
 * Rejeita (não recebe) um item com divergência de quantidade confirmada na
 * segunda conferência.
 */
export function useRejeitarItemSegundaConferencia() {
  const queryClient = useQueryClient()
  return useMutation<
    { itemNotaEntradaId: string; status: string; mensagem: string },
    Error,
    { notaId: string; itemNotaEntradaId: string; observacao?: string }
  >({
    mutationFn: async ({ notaId, itemNotaEntradaId, observacao }) => {
      const { data } = await api.post(`/conferencia-entrada/segunda-conferencia/${notaId}/rejeitar-item`, {
        itemNotaEntradaId,
        observacao,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conferencia-notas-pendentes'] })
    },
  })
}

/**
 * Libera um item marcado "requerSenha" na segunda conferência mediante
 * credenciais de supervisor.
 */
export function useAutorizarSenhaSegundaConferencia() {
  return useMutation<
    { itemNotaEntradaId: string; status: string; mensagem: string },
    Error,
    { notaId: string; itemNotaEntradaId: string; credenciaisSupervisor: { usuario: string; senha: string } }
  >({
    mutationFn: async ({ notaId, itemNotaEntradaId, credenciaisSupervisor }) => {
      const { data } = await api.post(`/conferencia-entrada/segunda-conferencia/${notaId}/autorizar-senha`, {
        itemNotaEntradaId,
        credenciaisSupervisor,
      })
      return data
    },
  })
}
