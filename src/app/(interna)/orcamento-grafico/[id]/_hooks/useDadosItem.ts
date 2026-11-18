'use client'

/**
 * useDadosItem — dados em texto do item selecionado (`GET /:id/itens/:itemId/dados-item`).
 *
 * - Sem `itemId` não faz chamada (o painel mostra a orientação de seleção).
 * - Trocar de item limpa os dados na hora e descarta a resposta de seleções antigas
 *   (AbortController + contador): nunca aparece conteúdo do item anterior (Req 3.4, 3.7).
 * - Em erro os dados ficam limpos.
 */

import type { DadosItemDTO } from './hierarquia.types'
import { useLeitura } from './useLeitura'

export interface UseDadosItemResultado {
  dados: DadosItemDTO | null
  carregando: boolean
  erro: string | null
  naoEncontrado: boolean
  recarregar: () => void
}

export function useDadosItem(
  orcamentoId: string | null | undefined,
  itemId: string | null | undefined,
): UseDadosItemResultado {
  const url = orcamentoId && itemId ? `/orcamento-grafico/${orcamentoId}/itens/${itemId}/dados-item` : null
  return useLeitura<DadosItemDTO>(url, {
    mensagemErro: 'Não foi possível carregar os dados do item.',
    limparAoRecarregar: true,
  })
}
