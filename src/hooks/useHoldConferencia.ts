'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const MOTIVOS_DIVERGENCIA = [
  { value: 'ERRO_CONTAGEM_FORNECEDOR', label: 'Erro de contagem do fornecedor' },
  { value: 'AVARIA_TRANSPORTE', label: 'Avaria no transporte' },
  { value: 'ERRO_ETIQUETAGEM', label: 'Erro de etiquetagem' },
  { value: 'AGUARDANDO_CCE_FORNECEDOR', label: 'Aguardando CC-e do fornecedor' },
  { value: 'DIVERGENCIA_LOTE_FORNECEDOR', label: 'Divergência de lote do fornecedor' },
  { value: 'OUTRO', label: 'Outro (detalhar)' },
] as const

export type MotivoDivergencia = (typeof MOTIVOS_DIVERGENCIA)[number]['value']

export interface ColocarEmHoldPayload {
  notaId: string
  itemNotaEntradaId: string
  motivo: MotivoDivergencia
  motivoDetalhe?: string
}

/**
 * Coloca um item com divergência confirmada em espera (Hold), retirando-o da
 * tela de segunda conferência do operador. O item passa a ser resolvido de
 * forma assíncrona por um Supervisor na Fila de Exceções.
 */
export function useColocarEmHold() {
  const queryClient = useQueryClient()
  return useMutation<
    { itemNotaEntradaId: string; status: string; mensagem: string },
    Error,
    ColocarEmHoldPayload
  >({
    mutationFn: async ({ notaId, itemNotaEntradaId, motivo, motivoDetalhe }) => {
      const { data } = await api.post(`/conferencia-entrada/segunda-conferencia/${notaId}/hold`, {
        itemNotaEntradaId,
        motivo,
        motivoDetalhe,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conferencia-notas-pendentes'] })
      queryClient.invalidateQueries({ queryKey: ['fila-excecoes'] })
    },
  })
}
