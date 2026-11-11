'use client'

/**
 * useCalculoAoVivo — recálculo em TEMPO REAL (com debounce) dos KPIs do item do
 * orçamento, consumindo as rotas de cálculo JÁ existentes (sem persistir nada).
 *
 * Feature: orcamento-editor-ux-redesign (Req 3)
 *
 * - item de repetição (tem `itemId`): usa `POST /:id/itens/:itemId/calcular`
 *   (ancora no valor real) — mesma escolha do StepRevisao.
 * - item novo (sem `itemId`): usa `POST /orcamento-grafico/calcular`.
 *
 * Mantém o último KPI válido quando o recálculo falha (Req 3.4) e cancela
 * requisições obsoletas por `requestId` (a última resposta vence). Erros de
 * validação são traduzidos por `traduzirErros` (Req 1).
 */

import { useEffect, useRef, useState } from 'react'
import { useDebouncedValue } from '@mantine/hooks'

import { api } from '@/lib/api'
import type { WizardFormData } from '../../novo/page'
import { montarPayloadCalculo } from '../itemFormShared'
import { traduzirErros, type ErrosAmigaveis } from './erros-amigaveis'

export interface KpisCalculo {
  custoTotal: number | null
  precoVenda: number | null
  margem: number | null
  precoUnitario: number | null
}

const KPIS_VAZIO: KpisCalculo = { custoTotal: null, precoVenda: null, margem: null, precoUnitario: null }

interface Opcoes {
  orcamentoId: string
  /** Id do item quando em edição (usa a rota ancorada). Null = item novo. */
  itemId?: string | null
  /** Debounce em ms (default 600). */
  debounceMs?: number
}

function derivarKpis(data: Record<string, unknown> | null): KpisCalculo {
  if (!data) return KPIS_VAZIO
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return {
    custoTotal: num(data.custoProducao) ?? num(data.custoTotal),
    precoVenda: num(data.precoVenda),
    margem: num(data.margemReal),
    precoUnitario: num(data.precoUnitario),
  }
}

export function useCalculoAoVivo(formData: WizardFormData, opcoes: Opcoes) {
  const { orcamentoId, itemId, debounceMs = 600 } = opcoes

  const [kpis, setKpis] = useState<KpisCalculo>(KPIS_VAZIO)
  const [loading, setLoading] = useState(false)
  const [erros, setErros] = useState<ErrosAmigaveis>({ geral: null, porCampo: {} })

  // Chave estável de dependências: só os campos que entram no payload de cálculo.
  // Evita recalcular por mudanças cosméticas (ex.: observação textual).
  const payload = montarPayloadCalculo(formData)
  const depsKey = JSON.stringify(payload)
  const [depsDebounced] = useDebouncedValue(depsKey, debounceMs)

  const reqIdRef = useRef(0)

  useEffect(() => {
    // Valida o PRÓPRIO payload que será enviado (depsDebounced), não o formData
    // atual — senão havia descompasso: a guarda via o formData já preenchido
    // enquanto o payload (debounced) ainda estava vazio, disparando o recálculo
    // com tipo/gramatura/preço nulos e exibindo "Complete os dados" indevidamente.
    const corpo = JSON.parse(depsDebounced) as {
      tipoEmbalagemId?: string | null
      quantidade?: number
      gramatura?: number
      precoKg?: number
    }
    const prontos =
      !!corpo.tipoEmbalagemId &&
      (corpo.quantidade ?? 0) > 0 &&
      (corpo.gramatura ?? 0) > 0 &&
      (corpo.precoKg ?? 0) > 0
    if (!prontos) {
      setLoading(false)
      setErros({ geral: null, porCampo: {} })
      return
    }

    const reqId = ++reqIdRef.current
    let cancelado = false
    setLoading(true)

    const rota =
      itemId
        ? `/orcamento-grafico/${orcamentoId}/itens/${itemId}/calcular`
        : `/orcamento-grafico/calcular`

    api
      .post(rota, corpo)
      .then((resp) => {
        if (cancelado || reqId !== reqIdRef.current) return
        const data = (resp.data?.resultado ?? resp.data) as Record<string, unknown>
        setKpis(derivarKpis(data))
        setErros({ geral: null, porCampo: {} })
      })
      .catch((err) => {
        if (cancelado || reqId !== reqIdRef.current) return
        // Mantém o último KPI válido (Req 3.4); só atualiza os erros amigáveis.
        setErros(traduzirErros(err?.response?.data))
      })
      .finally(() => {
        if (cancelado || reqId !== reqIdRef.current) return
        setLoading(false)
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsDebounced, orcamentoId, itemId])

  return { kpis, loading, erros }
}
