/**
 * Regras puras da edição das tiragens de um item no Fechamento (spec orcamento-grafico-tiragens-por-item,
 * tarefa 6; spec orcamento-prazos-cliente-margem R5). A tela só exibe o que o back grava; aqui ficam a
 * leitura das linhas e a montagem do corpo do `PUT /:id/itens/:itemId/tiragens/:quantidade`.
 */

export type SituacaoMargem = 'DENTRO' | 'ABAIXO' | 'SEM_REFERENCIA'

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
  /** Margem entre custo e preço: (preço − custo) ÷ preço. */
  margemSobrePreco?: number | null
  margemMinima?: number | null
  situacaoMargem?: SituacaoMargem
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
  margemSobrePreco: number | null
  margemMinima: number | null
  situacaoMargem: SituacaoMargem
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
        margemSobrePreco: num(l.margemSobrePreco),
        margemMinima: num(l.margemMinima),
        situacaoMargem: l.situacaoMargem ?? 'SEM_REFERENCIA',
      }
    })
    .sort((a, b) => a.quantidade - b.quantidade)
}

export type EdicaoTiragem =
  | { tipo: 'valor'; valor: number }
  | { tipo: 'unitario'; valor: number }
  | { tipo: 'margem'; margem: number }
  | { tipo: 'limpar' }

/** Corpo do PUT; `null` quando a entrada não serve (valor ≤ 0, margem fora da faixa, sem mudança). */
export function corpoDaEdicao(
  edicao: EdicaoTiragem,
  atual: Pick<LinhaTiragemTela, 'valorTotal' | 'margemPerc'> & Partial<Pick<LinhaTiragemTela, 'valorUnitario'>>,
): Record<string, unknown> | null {
  if (edicao.tipo === 'limpar') return { limpar: true }
  if (edicao.tipo === 'valor') {
    if (!Number.isFinite(edicao.valor) || edicao.valor <= 0) return null
    if (atual.valorTotal != null && Math.abs(atual.valorTotal - edicao.valor) < 0.005) return null
    return { valorTotal: Math.round(edicao.valor * 100) / 100 }
  }
  if (edicao.tipo === 'unitario') {
    if (!Number.isFinite(edicao.valor) || edicao.valor <= 0) return null
    if (atual.valorUnitario != null && Math.abs(atual.valorUnitario - edicao.valor) < 0.00005) return null
    return { valorUnitario: Math.round(edicao.valor * 10000) / 10000 }
  }
  if (!Number.isFinite(edicao.margem) || edicao.margem < -1000 || edicao.margem > 1000) return null
  if (atual.margemPerc != null && Math.abs(atual.margemPerc - edicao.margem) < 0.005) return null
  return { margemPerc: edicao.margem }
}

/** Texto da situação da margem frente à mínima. */
export function rotuloSituacaoMargem(l: Pick<LinhaTiragemTela, 'situacaoMargem' | 'margemMinima'>): string {
  const min = l.margemMinima != null ? ` (mín. ${String(l.margemMinima).replace('.', ',')}%)` : ''
  if (l.situacaoMargem === 'DENTRO') return `Dentro da margem${min}`
  if (l.situacaoMargem === 'ABAIXO') return `Abaixo da margem${min}`
  return 'Sem referência'
}
