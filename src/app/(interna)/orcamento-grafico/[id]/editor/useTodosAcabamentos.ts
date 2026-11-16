'use client'

/**
 * useTodosAcabamentos — carrega TODOS os acabamentos da empresa (páginas de 100)
 * e, com produto escolhido, garante as atividades do catálogo ausentes por
 * `GET /orcamento-grafico/acabamentos/por-ids` (até 50 ids por requisição).
 *
 * Feature: orcamento-grafico-fase3-produto-embalagem (Req 11).
 * Falha de página ou de busca: mantém o já carregado, expõe `erro` (mensagem da
 * API) e `tentarNovamente`. Não envia `empresaId` (vem da sessão).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import {
  carregarTodasPaginas,
  completarPorIds,
  deduplicarPorId,
  type EstadoCarga,
} from './acabamentos-paginacao'

export const AVISO_LISTA_INCOMPLETA = 'A lista de acabamentos pode estar incompleta.'

/** Acabamento já com os campos numéricos convertidos (a API devolve Decimal como texto). */
export interface AcabamentoCarregado {
  id: string
  [campo: string]: any
}

const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))

/** Mesma conversão do StepAcabamentos, para a lista ser intercambiável. */
export function normalizarAcabamento(a: any): AcabamentoCarregado {
  return {
    ...a,
    precoUnitario: num(a.precoUnitario),
    custoHora: num(a.custoHora),
    producaoHora: num(a.producaoHora),
    quantAcertos: num(a.quantAcertos),
    tempoPorAcertoMin: num(a.tempoPorAcertoMin),
    tempoPrimeiroAcertoMin: num(a.tempoPrimeiroAcertoMin),
    exigeRestricao: !!a.exigeRestricao,
    materiais: Array.isArray(a.materiais) ? a.materiais : [],
    restricoes: Array.isArray(a.restricoes) ? a.restricoes : [],
  }
}

export interface UseTodosAcabamentos {
  acabamentos: AcabamentoCarregado[]
  carregando: boolean
  /** Mensagem da API quando alguma página/busca falhou; null caso contrário. */
  erro: string | null
  tentarNovamente: () => void
}

/**
 * @param idsCatalogo ids das atividades do catálogo do produto escolhido
 *   (vazio/undefined = sem produto: nenhuma busca por id).
 */
export function useTodosAcabamentos(idsCatalogo?: readonly string[]): UseTodosAcabamentos {
  const [acabamentos, setAcabamentos] = useState<AcabamentoCarregado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)

  const estadoRef = useRef<EstadoCarga<AcabamentoCarregado> | null>(null)
  const listaRef = useRef<AcabamentoCarregado[]>([])
  const chaveIds = (idsCatalogo ?? []).join(',')

  useEffect(() => {
    let cancelado = false
    const ids = chaveIds ? chaveIds.split(',') : []

    async function carregar() {
      setCarregando(true)
      const estado = await carregarTodasPaginas<AcabamentoCarregado>(async (pagina, limite) => {
        const { data } = await api.get('/orcamento-grafico/acabamentos', { params: { page: pagina, limit: limite } })
        const lista = (data?.data ?? data ?? []) as any[]
        return { data: lista.map(normalizarAcabamento), total: typeof data?.total === 'number' ? data.total : null }
      }, estadoRef.current ?? undefined)
      if (cancelado) return
      estadoRef.current = estado

      let itens = estado.itens
      let mensagem = estado.erro
      if (ids.length > 0) {
        const busca = await completarPorIds<AcabamentoCarregado>(
          // Itens já buscados antes (falha parcial anterior) continuam na lista.
          deduplicarPorId([...itens, ...listaRef.current]),
          ids,
          async (lote) => {
            const { data } = await api.get('/orcamento-grafico/acabamentos/por-ids', { params: { ids: lote.join(',') } })
            return ((data?.data ?? data ?? []) as any[]).map(normalizarAcabamento)
          },
        )
        if (cancelado) return
        itens = busca.itens
        mensagem = mensagem ?? busca.erro
      }
      listaRef.current = itens
      setAcabamentos(itens)
      setErro(mensagem)
      setCarregando(false)
    }

    void carregar()
    return () => {
      cancelado = true
    }
  }, [chaveIds, tentativa])

  const tentarNovamente = useCallback(() => {
    setErro(null)
    setTentativa((t) => t + 1)
  }, [])

  return { acabamentos, carregando, erro, tentarNovamente }
}
