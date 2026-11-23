/**
 * Regras puras da edição das tiragens de um item no Fechamento (spec orcamento-grafico-tiragens-por-item,
 * tarefa 6). A tela só exibe o que o back grava; aqui ficam a leitura das linhas e a montagem do corpo
 * do `PUT /:id/itens/:itemId/tiragens/:quantidade`.
 */

export interface LinhaTiragemApi {
  ordem: number
  quantidade: number
  custoProducao?: string | number | null
  margemPerc?: string | number | null
  faixaMargem?: number | null
  valorTotal?: string | number | null
  valorInformado?: boolean
  cmValor?: string | number | null
  cmPerc?: string | number | null
}

export interface LinhaTiragemTela {
  quantidade: number
  referencia: boolean
  custoProducao: number | null
  margemPerc: number | null
  valorTotal: number | null
  valorUnitario: number | null
  cmPerc: number | null
  digitado: boolean
}

function num(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Linhas do back → linhas da tela, em ordem crescente de tiragem. */
export function linhasDaTela(linhas: readonly LinhaTiragemApi[] | null | undefined): LinhaTiragemTela[] {
  return [...(linhas ?? [])]
    .map((l) => {
      const valorTotal = num(l.valorTotal)
      return {
        quantidade: l.quantidade,
        referencia: l.ordem === 0,
        custoProducao: num(l.custoProducao),
        margemPerc: num(l.margemPerc),
        valorTotal,
        valorUnitario: valorTotal != null && l.quantidade > 0 ? valorTotal / l.quantidade : null,
        cmPerc: num(l.cmPerc),
        digitado: l.valorInformado === true,
      }
    })
    .sort((a, b) => a.quantidade - b.quantidade)
}

export type EdicaoTiragem =
  | { tipo: 'valor'; valor: number }
  | { tipo: 'margem'; margem: number }
  | { tipo: 'limpar' }

/** Corpo do PUT; `null` quando a entrada não serve (valor ≤ 0, margem fora da faixa, sem mudança). */
export function corpoDaEdicao(
  edicao: EdicaoTiragem,
  atual: Pick<LinhaTiragemTela, 'valorTotal' | 'margemPerc'>,
): Record<string, unknown> | null {
  if (edicao.tipo === 'limpar') return { limpar: true }
  if (edicao.tipo === 'valor') {
    if (!Number.isFinite(edicao.valor) || edicao.valor <= 0) return null
    if (atual.valorTotal != null && Math.abs(atual.valorTotal - edicao.valor) < 0.005) return null
    return { valorTotal: Math.round(edicao.valor * 100) / 100 }
  }
  if (!Number.isFinite(edicao.margem) || edicao.margem < -1000 || edicao.margem > 1000) return null
  if (atual.margemPerc != null && Math.abs(atual.margemPerc - edicao.margem) < 0.005) return null
  return { margemPerc: edicao.margem }
}
