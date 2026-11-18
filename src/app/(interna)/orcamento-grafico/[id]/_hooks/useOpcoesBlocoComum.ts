'use client'

/**
 * Listas de apoio do BlocoComum (somente leitura):
 * - `useTiposProduto`: tipos de produto (tipos de embalagem) para o seletor "Tipo de Produto".
 * - `useSiglasAcabado`: nomes de acabados do cadastro, sugeridos na busca da "Sigla Acabado"
 *   (o campo continua aceitando texto livre).
 * Falha de carga não bloqueia a tela: as listas ficam vazias e o erro é informado.
 */

import { useMemo } from 'react'

import { useLeitura } from './useLeitura'

export interface TipoProduto {
  id: string
  codigo: string
  descricao: string
}

type RespostaLista<T> = T[] | { data?: T[] } | null

function listaDe<T>(dados: RespostaLista<T>): T[] {
  if (Array.isArray(dados)) return dados
  if (dados && Array.isArray(dados.data)) return dados.data
  return []
}

export function useTiposProduto(habilitado = true) {
  const r = useLeitura<RespostaLista<TipoProduto>>(habilitado ? '/orcamento-grafico/tipos-embalagem' : null, {
    mensagemErro: 'Não foi possível carregar os tipos de produto.',
  })
  const tipos = useMemo(() => listaDe(r.dados), [r.dados])
  return { tipos, carregando: r.carregando, erro: r.erro, tentarNovamente: r.recarregar }
}

interface AcabadoCadastro {
  nome?: string
  ativo?: boolean
}

export function useSiglasAcabado(habilitado = true) {
  const r = useLeitura<RespostaLista<AcabadoCadastro>>(
    habilitado ? '/orcamento-grafico/acabamentos?limit=100' : null,
    { mensagemErro: 'Não foi possível carregar as siglas de acabado.' },
  )
  const siglas = useMemo(() => {
    const nomes = listaDe(r.dados)
      .filter((a) => a?.ativo !== false)
      .map((a) => a?.nome)
      .filter((n): n is string => typeof n === 'string' && n.length > 0)
    return Array.from(new Set(nomes))
  }, [r.dados])
  return { siglas, carregando: r.carregando, erro: r.erro, tentarNovamente: r.recarregar }
}
