'use client'

/**
 * useFechamentoTotalizador — totalizador por tiragem (`GET /:id/fechamento-totalizador`).
 *
 * - Em erro mantém o último valor bom (`dados`) e expõe `erro`, para a aba avisar que os totais
 *   podem estar desatualizados (Req 4.7).
 * - `notificarAlteracaoItem()` deve ser chamado depois que o salvamento de um item for confirmado;
 *   reexecuta a leitura de imediato (dentro do prazo de 2 s do Req 4.4). Chamadas em sequência
 *   rápida colapsam numa só (a resposta da anterior é descartada).
 */

import { useCallback } from 'react'

import type { FechamentoTotalizadorDTO } from './hierarquia.types'
import { useLeitura } from './useLeitura'

export interface UseFechamentoTotalizadorResultado {
  dados: FechamentoTotalizadorDTO | null
  carregando: boolean
  erro: string | null
  naoEncontrado: boolean
  recarregar: () => void
  /** Chamar após salvar (e confirmar) a alteração de margem/lançamentos de um item. */
  notificarAlteracaoItem: () => void
}

export function useFechamentoTotalizador(orcamentoId: string | null | undefined): UseFechamentoTotalizadorResultado {
  const url = orcamentoId ? `/orcamento-grafico/${orcamentoId}/fechamento-totalizador` : null
  const { dados, carregando, erro, naoEncontrado, recarregar } = useLeitura<FechamentoTotalizadorDTO>(url, {
    mensagemErro: 'Não foi possível atualizar os totais do fechamento.',
    manterDadosEmErro: true,
  })

  const notificarAlteracaoItem = useCallback(() => recarregar(), [recarregar])

  return { dados, carregando, erro, naoEncontrado, recarregar, notificarAlteracaoItem }
}
