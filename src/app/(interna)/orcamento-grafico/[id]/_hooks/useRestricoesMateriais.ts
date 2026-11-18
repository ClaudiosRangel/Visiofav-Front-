'use client'

/**
 * useRestricoesMateriais — Restrições e Materiais da atividade em foco (Req 11.1 a 11.3).
 *
 * - Atividade presente no catálogo do plano (`catalogoDoPlano`): usa o catálogo, sem rede.
 * - Caso contrário: `GET /cadastros/catalogo/atividade/:id`.
 * - Cache por atividade durante a vida do componente (um mesmo foco não consulta duas vezes).
 *   O cache fica no hook, não no módulo, para nunca atravessar empresa/sessão.
 * - Trocar a atividade em foco descarta a resposta da anterior (AbortController + flag).
 * - Erro: mensagem + `tentarNovamente`. Não mexe em nenhuma seleção do item/plano.
 * - Sem atividade em foco: nenhuma chamada de rede.
 * - Somente leitura.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'

import { catalogoApi } from '../../cadastros/_shared/cadastros-graficos.api'
import type {
  CatalogoPlano,
  MaterialAtividade,
  RestricaoAtividade,
} from '../../cadastros/_shared/cadastros-graficos.types'
import {
  MENSAGEM_ERRO_RESTRICOES,
  daRespostaDaAtividade,
  doCatalogoDoPlano,
  type OrigemRestricoesMateriais,
  type RestricoesMateriais,
} from './restricoes-materiais-puro'

export interface UseRestricoesMateriaisResultado {
  restricoes: RestricaoAtividade[]
  materiais: MaterialAtividade[]
  /** De onde vieram os dados (null enquanto não há dados). */
  origem: OrigemRestricoesMateriais | null
  carregando: boolean
  erro: string | null
  /** Consulta de novo a atividade em foco (botão "Tentar novamente"). */
  tentarNovamente: () => void
}

const VAZIO: RestricoesMateriais = { restricoes: [], materiais: [] }

export function useRestricoesMateriais(
  atividadeId: string | null | undefined,
  catalogoDoPlano?: Pick<CatalogoPlano, 'atividades'> | null,
): UseRestricoesMateriaisResultado {
  const [cache, setCache] = useState<Record<string, RestricoesMateriais>>({})
  const cacheRef = useRef(cache)
  cacheRef.current = cache

  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  const doPlano = useMemo(() => doCatalogoDoPlano(catalogoDoPlano, atividadeId), [catalogoDoPlano, atividadeId])

  useEffect(() => {
    setErro(null)

    if (!atividadeId || doPlano || cacheRef.current[atividadeId]) {
      setCarregando(false)
      return
    }

    let cancelado = false
    const controle = new AbortController()
    setCarregando(true)

    catalogoApi
      .atividade(atividadeId, controle.signal)
      .then((resposta) => {
        if (cancelado) return
        setCache((atual) => ({ ...atual, [atividadeId]: daRespostaDaAtividade(resposta) }))
      })
      .catch((err: unknown) => {
        if (cancelado || axios.isCancel(err)) return
        setErro(MENSAGEM_ERRO_RESTRICOES)
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
      controle.abort()
    }
  }, [atividadeId, doPlano, tentativa])

  const tentarNovamente = useCallback(() => setTentativa((n) => n + 1), [])

  const dados = atividadeId ? (doPlano ?? cache[atividadeId] ?? null) : null
  const origem: OrigemRestricoesMateriais | null = !dados ? null : doPlano ? 'CATALOGO_PLANO' : 'ATIVIDADE'
  const { restricoes, materiais } = dados ?? VAZIO

  return { restricoes, materiais, origem, carregando, erro, tentarNovamente }
}
