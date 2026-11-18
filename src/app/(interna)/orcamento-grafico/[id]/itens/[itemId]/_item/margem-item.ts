/**
 * margem-item — lógica PURA do resumo compacto da margem do item (sem React, sem rede).
 *
 * Reaproveita `previewFaixaMargem` (gross-up do editor atual). É só leitura/simulação: não grava,
 * não chama o motor e não altera o valor consolidado nem a ancoragem do custo.
 */

import { previewFaixaMargem } from '../../../editor/previa-margem'

export interface EntradaResumoMargem {
  /** Custo de produção consolidado do item. */
  baseCusto: number | null | undefined
  /** CEV (%) do consolidado. */
  cevPct?: number | null
  /** Margem (%) selecionada no consolidado. */
  margemAtualPct?: number | null
  /** Tiragem do item. */
  quantidade?: number | null
  /** Contribuição marginal (%) já calculada pelo consolidado, quando houver. */
  contribuicaoMarginalPerc?: number | null
}

export interface ResumoMargem {
  custo: number
  /** Preço de venda pela margem atual; null quando a margem não é conhecida ou o divisor não fecha. */
  preco: number | null
  /** Preço unitário (4 casas); null quando não há preço. */
  precoUnitario: number | null
  /** Margem (%) usada; null quando desconhecida. */
  margemPct: number | null
  /** Contribuição marginal (%); null quando o consolidado não informa. */
  cmPerc: number | null
}

function finito(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Resumo "custo · preço · CM%"; sem custo de produção positivo não há o que resumir (null). */
export function resumoMargem(entrada: EntradaResumoMargem): ResumoMargem | null {
  if (!finito(entrada.baseCusto) || entrada.baseCusto <= 0) return null

  const margemPct = finito(entrada.margemAtualPct) && entrada.margemAtualPct > 0 ? entrada.margemAtualPct : null
  const cmPerc = finito(entrada.contribuicaoMarginalPerc) ? entrada.contribuicaoMarginalPerc : null

  if (margemPct === null) {
    return { custo: entrada.baseCusto, preco: null, precoUnitario: null, margemPct: null, cmPerc }
  }

  const previa = previewFaixaMargem({
    base: entrada.baseCusto,
    margemPct,
    cevPct: finito(entrada.cevPct) ? entrada.cevPct : 0,
    quantidade: finito(entrada.quantidade) ? entrada.quantidade : 0,
  })
  const precoValido = previa.valorTotal > 0
  return {
    custo: entrada.baseCusto,
    preco: precoValido ? previa.valorTotal : null,
    precoUnitario: precoValido && previa.valorUnitario > 0 ? previa.valorUnitario : null,
    margemPct,
    cmPerc,
  }
}
