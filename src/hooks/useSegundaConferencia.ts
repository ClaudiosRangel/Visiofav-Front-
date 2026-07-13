'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ItemSegundaConferenciaPayload {
  itemNotaEntradaId: string
  quantidadeConferida: number
  lote?: string
  validade?: string
}

export type StatusResultadoSegundaConferencia =
  | 'resolvido'
  | 'pendenciaCriada'
  | 'emailEnviado'
  | 'emailFalhou'
  | 'requerSenha'
  | 'bloqueado'
  | 'ignorado'

export interface ResultadoItemSegundaConferencia {
  itemNotaEntradaId: string
  resultado: { status: StatusResultadoSegundaConferencia; pendenciaId?: string; motivo?: string }
}

export interface RespostaSegundaConferencia {
  divergenciaResolvida: boolean
  pendenciaCriada: boolean
  emailEnviado: boolean
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
