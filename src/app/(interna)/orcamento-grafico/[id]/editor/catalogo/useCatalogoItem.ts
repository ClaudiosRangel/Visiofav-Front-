'use client'

/**
 * useCatalogoItem — carrega o catálogo do Produto Gráfico escolhido no item
 * (Fase 2, spec orcamento-grafico-catalogo-no-editor, tarefa 4.1).
 *
 * - Consulta `GET /catalogo/produto/:id` uma única vez por produto.
 * - Descobre o plano fixo (`planoFixoDoCatalogo`) e consulta `GET /catalogo/plano/:id?produtoId=`.
 * - Tipos de plano não fixos: sob demanda (`carregarPlano`), com cache por sessão do editor.
 * - Sem produto: `catalogo = null` e nenhuma chamada de rede (comportamento atual preservado).
 * - Falha: `erro` legível; as seções voltam à lista geral (o item nunca perde o que foi preenchido).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { catalogoApi, mensagemErroApi } from '../../../cadastros/_shared/cadastros-graficos.api'
import type { CatalogoPlano } from '../../../cadastros/_shared/cadastros-graficos.types'
import type { CatalogoDoItem } from './catalogo.types'
import { planoFixoDoCatalogo } from './catalogo-puro'

export interface UseCatalogoItemResultado {
  /** Catálogo carregado; `null` sem produto, durante a carga e em caso de erro. */
  catalogo: CatalogoDoItem | null
  carregando: boolean
  /** Mensagem legível quando o catálogo não pôde ser carregado. */
  erro: string | null
  /** Produto carregado, mas sem tipos de plano nem atividades cadastrados. */
  vazio: boolean
  /**
   * Catálogo de um tipo de plano (cache por tipo). Devolve `null` sem produto ou em erro.
   * Atualiza `catalogo.porTipoPlano` na primeira consulta de cada tipo.
   */
  carregarPlano: (tipoPlanoId: string) => Promise<CatalogoPlano | null>
  /** Descarta o cache e consulta de novo. */
  recarregar: () => void
}

export function useCatalogoItem(produtoGraficoId: string | null | undefined): UseCatalogoItemResultado {
  const [catalogo, setCatalogo] = useState<CatalogoDoItem | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  // Produto vigente e cache fora do estado (evita refetch e corrida entre produtos).
  const produtoRef = useRef<string | null>(null)
  const cacheRef = useRef<Map<string, CatalogoPlano>>(new Map())
  const pendentesRef = useRef<Map<string, Promise<CatalogoPlano | null>>>(new Map())

  useEffect(() => {
    produtoRef.current = produtoGraficoId ?? null
    cacheRef.current = new Map()
    pendentesRef.current = new Map()

    if (!produtoGraficoId) {
      setCatalogo(null)
      setErro(null)
      setCarregando(false)
      return
    }

    let cancelado = false
    setCarregando(true)
    setErro(null)

    ;(async () => {
      try {
        const produto = await catalogoApi.produto(produtoGraficoId)
        const planoFixoId = planoFixoDoCatalogo(produto)
        let planoFixo: CatalogoPlano | null = null
        if (planoFixoId) {
          planoFixo = await catalogoApi.plano(planoFixoId, produtoGraficoId)
          cacheRef.current.set(planoFixoId, planoFixo)
        }
        if (cancelado) return
        const porTipoPlano: Record<string, CatalogoPlano> = planoFixoId && planoFixo ? { [planoFixoId]: planoFixo } : {}
        setCatalogo({ produto, planoFixoId, planoFixo, porTipoPlano })
      } catch (err) {
        if (cancelado) return
        setCatalogo(null)
        setErro(mensagemErroApi(err, 'Não foi possível carregar o catálogo do produto.'))
      } finally {
        if (!cancelado) setCarregando(false)
      }
    })()

    return () => {
      cancelado = true
    }
  }, [produtoGraficoId, tentativa])

  const carregarPlano = useCallback(async (tipoPlanoId: string): Promise<CatalogoPlano | null> => {
    const produtoId = produtoRef.current
    if (!produtoId) return null

    const emCache = cacheRef.current.get(tipoPlanoId)
    if (emCache) return emCache
    const pendente = pendentesRef.current.get(tipoPlanoId)
    if (pendente) return pendente

    const promessa = (async () => {
      try {
        const plano = await catalogoApi.plano(tipoPlanoId, produtoId)
        // Produto trocado durante a consulta: descarta a resposta.
        if (produtoRef.current !== produtoId) return null
        cacheRef.current.set(tipoPlanoId, plano)
        setCatalogo((atual) =>
          atual && atual.produto.produto.id === produtoId
            ? { ...atual, porTipoPlano: { ...atual.porTipoPlano, [tipoPlanoId]: plano } }
            : atual,
        )
        return plano
      } catch {
        return null
      } finally {
        pendentesRef.current.delete(tipoPlanoId)
      }
    })()
    pendentesRef.current.set(tipoPlanoId, promessa)
    return promessa
  }, [])

  const recarregar = useCallback(() => setTentativa((n) => n + 1), [])

  const vazio =
    !!catalogo &&
    catalogo.produto.planos.length === 0 &&
    catalogo.produto.atividades.length === 0 &&
    catalogo.produto.acondicionamento.length === 0

  return { catalogo, carregando, erro, vazio, carregarPlano, recarregar }
}
