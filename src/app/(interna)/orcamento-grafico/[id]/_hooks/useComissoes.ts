'use client'

/**
 * useComissoes — comissões do orçamento, calculadas no back (`GET /:id/comissoes`, prazo de 10 s).
 *
 * `vazio` (sucesso sem linhas) é distinto de `erro` (falha de rede, servidor ou prazo esgotado).
 * Nenhum valor é calculado, arredondado ou derivado aqui (Req 5.3).
 */

import type { ComissoesDTO } from './hierarquia.types'
import { useLeitura } from './useLeitura'

export const PRAZO_COMISSOES_MS = 10000

export interface UseComissoesResultado {
  dados: ComissoesDTO | null
  carregando: boolean
  erro: string | null
  /** Resposta de sucesso com lista vazia. */
  vazio: boolean
  naoEncontrado: boolean
  recarregar: () => void
}

export function useComissoes(orcamentoId: string | null | undefined): UseComissoesResultado {
  const url = orcamentoId ? `/orcamento-grafico/${orcamentoId}/comissoes` : null
  const { dados, carregando, erro, naoEncontrado, recarregar } = useLeitura<ComissoesDTO>(url, {
    mensagemErro: 'Não foi possível carregar as comissões.',
    timeoutMs: PRAZO_COMISSOES_MS,
  })

  const vazio = !!dados && !erro && dados.linhas.length === 0
  return { dados, carregando, erro, vazio, naoEncontrado, recarregar }
}
