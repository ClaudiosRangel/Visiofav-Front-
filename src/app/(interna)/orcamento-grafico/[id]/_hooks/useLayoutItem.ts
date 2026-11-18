'use client'

/**
 * useLayoutItem — layout do Item dirigido pelo cadastro do Produto Gráfico.
 *
 * - Lê o catálogo do produto (`catalogoApi.produto`, rota existente) e resolve o layout com a
 *   função pura `resolverLayoutItem`. Sem `produtoGraficoId` não há chamada de rede e `layout = null`.
 * - Memoizado por atributos: o `layout` só muda de referência quando algum atributo do cadastro
 *   que influencia a tela muda (recarregar o mesmo produto devolve o mesmo objeto).
 * - Ao trocar de produto o layout anterior é descartado na hora (nunca mistura campos de dois
 *   produtos) e a resposta de um produto antigo é ignorada.
 * - Erro: mensagem legível e `tentarNovamente`.
 * - Somente leitura: não grava nada.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { catalogoApi, mensagemErroApi } from '../../cadastros/_shared/cadastros-graficos.api'
import type { CatalogoProduto } from '../../cadastros/_shared/cadastros-graficos.types'
import { chaveDaEntradaLayout, entradaLayoutDoCatalogo } from '../_layout/entrada-layout'
import { resolverLayoutItem, type LayoutItem } from '../_layout/resolver-layout-item'

export interface UseLayoutItemResultado {
  /** Layout resolvido; `null` sem produto, durante a carga e em caso de erro. */
  layout: LayoutItem | null
  /** Catálogo do produto usado para resolver o layout (tipos de plano, atividades, defaults...). */
  produto: CatalogoProduto | null
  carregando: boolean
  /** Mensagem legível quando o cadastro do produto não pôde ser carregado. */
  erro: string | null
  /** Consulta o produto de novo (botão "Tentar novamente"). */
  tentarNovamente: () => void
}

export const MENSAGEM_ERRO_LAYOUT = 'Não foi possível carregar o cadastro do produto.'

export function useLayoutItem(produtoGraficoId: string | null | undefined): UseLayoutItemResultado {
  const [carregado, setCarregado] = useState<{ produtoId: string; catalogo: CatalogoProduto } | null>(null)
  const [carregando, setCarregando] = useState(!!produtoGraficoId)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    // Troca de produto: descarta o catálogo anterior imediatamente.
    setCarregado(null)
    setErro(null)

    if (!produtoGraficoId) {
      setCarregando(false)
      return
    }

    let cancelado = false
    setCarregando(true)

    catalogoApi
      .produto(produtoGraficoId)
      .then((catalogo) => {
        if (cancelado) return
        setCarregado({ produtoId: produtoGraficoId, catalogo })
      })
      .catch((err: unknown) => {
        if (cancelado) return
        setErro(mensagemErroApi(err, MENSAGEM_ERRO_LAYOUT))
      })
      .finally(() => {
        if (!cancelado) setCarregando(false)
      })

    return () => {
      cancelado = true
    }
  }, [produtoGraficoId, tentativa])

  // Só aceita o catálogo do produto vigente (defesa extra contra corrida de renderização).
  const catalogo = carregado && carregado.produtoId === produtoGraficoId ? carregado.catalogo : null

  const entrada = useMemo(() => (catalogo ? entradaLayoutDoCatalogo(catalogo) : null), [catalogo])
  const chave = entrada ? chaveDaEntradaLayout(entrada) : null

  // Memoiza pelos atributos (chave), não pela identidade do catálogo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => (entrada ? resolverLayoutItem(entrada) : null), [chave])

  const tentarNovamente = useCallback(() => setTentativa((n) => n + 1), [])

  return { layout, produto: catalogo, carregando, erro, tentarNovamente }
}
