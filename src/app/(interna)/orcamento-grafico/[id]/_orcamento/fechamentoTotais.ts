/**
 * Totais do Fechamento (funções puras). O back já devolve uma linha por tiragem; aqui só
 * garantimos a soma de todos os itens por tiragem e o Valor Unitário com precisão de 5 casas
 * (o back arredonda em 4). Nenhum custo é recalculado: usa-se apenas o Valor Total persistido.
 */

import type { FechamentoLinhaDTO } from '../_hooks/hierarquia.types'

export interface LinhaFechamentoExibicao {
  tiragem: number
  margemPerc: number | null
  contribuicaoMarginalPerc: number | null
  valorUnitario: number
  valorTotal: number
  /** Σ custo de produção dos itens da tiragem. */
  custoProducao: number
}

export type SituacaoMargemFechamento = 'DENTRO' | 'ABAIXO' | 'SEM_REFERENCIA'

/** Margem entre custo e preço da linha ((preço − custo) ÷ preço) e a situação frente à mínima. */
export function margemDaLinha(
  l: Pick<LinhaFechamentoExibicao, 'valorTotal' | 'custoProducao'>,
  minima: number | null | undefined,
): { margem: number | null; situacao: SituacaoMargemFechamento } {
  if (!(l.valorTotal > 0) || !Number.isFinite(l.custoProducao)) return { margem: null, situacao: 'SEM_REFERENCIA' }
  const margem = Math.round(((l.valorTotal - l.custoProducao) / l.valorTotal) * 10000) / 100
  if (minima == null || !Number.isFinite(minima)) return { margem, situacao: 'SEM_REFERENCIA' }
  return { margem, situacao: margem + 1e-9 >= minima ? 'DENTRO' : 'ABAIXO' }
}

function arred(x: number, casas: number): number {
  const f = 10 ** casas
  return Math.round((x + Number.EPSILON) * f) / f
}

/** Valor Unitário = Valor Total / Tiragem, 5 casas; tiragem inválida ⇒ 0. */
export function valorUnitarioDe(valorTotal: number, tiragem: number): number {
  return tiragem > 0 && Number.isFinite(valorTotal) ? arred(valorTotal / tiragem, 5) : 0
}

/**
 * Uma linha por tiragem (ordem crescente), somando o Valor Total de todos os itens.
 * Linhas repetidas da mesma tiragem são somadas; margem/C.Marg. viram média ponderada pelo
 * Valor Total (nulo se alguma das linhas somadas não tiver o dado).
 */
export function totalizarPorTiragem(linhas: readonly FechamentoLinhaDTO[]): LinhaFechamentoExibicao[] {
  const grupos = new Map<number, FechamentoLinhaDTO[]>()
  for (const l of linhas) {
    const g = grupos.get(l.tiragem) ?? []
    g.push(l)
    grupos.set(l.tiragem, g)
  }

  return [...grupos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tiragem, g]) => {
      const valorTotal = arred(g.reduce((s, l) => s + (l.valorTotal ?? 0), 0), 2)
      const ponderar = (pick: (l: FechamentoLinhaDTO) => number | null): number | null => {
        if (g.length === 1) return pick(g[0])
        if (g.some((l) => pick(l) == null) || valorTotal <= 0) return null
        return arred(g.reduce((s, l) => s + (pick(l) as number) * (l.valorTotal ?? 0), 0) / valorTotal, 2)
      }
      return {
        tiragem,
        margemPerc: ponderar((l) => l.margemPerc),
        contribuicaoMarginalPerc: ponderar((l) => l.contribuicaoMarginalPerc),
        valorUnitario: valorUnitarioDe(valorTotal, tiragem),
        valorTotal,
        custoProducao: arred(g.reduce((s, l) => s + (Number(l.custoProducao) || 0), 0), 2),
      }
    })
}
