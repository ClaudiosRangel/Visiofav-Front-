'use client'

/**
 * useOrcamentoHierarquia — itens do orçamento para o Grid_Itens (`GET /:id/itens-resumo`).
 * Devolve `{ dados, carregando, erro, naoEncontrado, recarregar }`; `dados` é a lista de itens
 * (ordem do back, por número do item). Em erro de recarga mantém a lista anterior, para o grid
 * continuar utilizável (Req 2.10).
 */

import { useMemo } from 'react'

import type { ItemResumoDTO, ItensResumoResposta } from './hierarquia.types'
import { useLeitura } from './useLeitura'

export interface UseOrcamentoHierarquiaResultado {
  dados: ItemResumoDTO[] | null
  carregando: boolean
  erro: string | null
  naoEncontrado: boolean
  recarregar: () => void
}

export function useOrcamentoHierarquia(orcamentoId: string | null | undefined): UseOrcamentoHierarquiaResultado {
  const url = orcamentoId ? `/orcamento-grafico/${orcamentoId}/itens-resumo` : null
  const { dados, carregando, erro, naoEncontrado, recarregar } = useLeitura<ItensResumoResposta>(url, {
    mensagemErro: 'Não foi possível carregar os itens do orçamento.',
    manterDadosEmErro: true,
  })

  const itens = useMemo(() => (dados ? dados.itens : null), [dados])
  return { dados: itens, carregando, erro, naoEncontrado, recarregar }
}
