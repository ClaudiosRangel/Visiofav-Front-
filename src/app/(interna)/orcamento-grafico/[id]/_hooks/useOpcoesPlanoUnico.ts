'use client'

/**
 * Listas de apoio do bloco de plano único (somente leitura), as mesmas rotas que o editor atual usa:
 * - `useProcessosImpressao`: nomes dos processos de impressão ativos.
 * - `useCoberturasTinta`: nomes das coberturas de tinta ativas.
 * Os campos aceitam texto livre; falha de carga deixa a lista vazia e informa o erro com
 * "Tentar novamente", sem bloquear a digitação.
 */

import { useMemo } from 'react'

import { useLeitura } from './useLeitura'

interface ItemComNome {
  nome?: string
}

type RespostaLista = ItemComNome[] | { data?: ItemComNome[] } | null

function nomesDe(dados: RespostaLista): string[] {
  const lista = Array.isArray(dados) ? dados : dados && Array.isArray(dados.data) ? dados.data : []
  const nomes = lista.map((i) => i?.nome).filter((n): n is string => typeof n === 'string' && n.length > 0)
  return Array.from(new Set(nomes))
}

export function useProcessosImpressao(habilitado = true) {
  const r = useLeitura<RespostaLista>(habilitado ? '/orcamento-grafico/processos-impressao?situacao=ativa' : null, {
    mensagemErro: 'Não foi possível carregar os processos de impressão.',
  })
  const nomes = useMemo(() => nomesDe(r.dados), [r.dados])
  return { nomes, carregando: r.carregando, erro: r.erro, tentarNovamente: r.recarregar }
}

export function useCoberturasTinta(habilitado = true) {
  const r = useLeitura<RespostaLista>(habilitado ? '/orcamento-grafico/coberturas-tinta?situacao=ativa' : null, {
    mensagemErro: 'Não foi possível carregar as coberturas de tinta.',
  })
  const nomes = useMemo(() => nomesDe(r.dados), [r.dados])
  return { nomes, carregando: r.carregando, erro: r.erro, tentarNovamente: r.recarregar }
}
