/**
 * selecoes-por-plano-puro — funções PURAS (sem React, rede ou banco) do seletor de
 * material no modal de plano (spec orcamento-grafico-fase3-produto-embalagem, Req 8).
 *
 * - `deveExibirSeletorNoPlano`: o seletor só aparece em atividade marcada com ao menos
 *   um material; sem produto nada aparece e nenhuma consulta ao catálogo é necessária.
 * - `mesclarSelecoesPorPlano`: aplica ações (escolher, remover, desmarcar, salvar plano)
 *   sobre as seleções, com chave `acabamentoId|planoId`, preservando `origem` e `selecaoId`.
 */

import { chaveSelecao } from './catalogo-puro'

// ============================================================================
// Exibição do seletor
// ============================================================================

export interface EntradaSeletorNoPlano {
  /** O item tem Produto_Grafico (sem produto o modal fica idêntico ao atual). */
  temProduto: boolean
  /** A atividade está marcada no plano. */
  atividadeMarcada: boolean
  /** Materiais permitidos da atividade no catálogo do plano. */
  materiais: ReadonlyArray<unknown> | null | undefined
  /** Plano fixo do produto: continua com o seletor atual (não é tratado aqui). */
  planoFixo?: boolean
}

export function deveExibirSeletorNoPlano(entrada: EntradaSeletorNoPlano): boolean {
  if (!entrada.temProduto) return false
  if (entrada.planoFixo === true) return false
  if (entrada.atividadeMarcada !== true) return false
  return (entrada.materiais?.length ?? 0) > 0
}

// ============================================================================
// Seleções por plano
// ============================================================================

export interface SelecaoDoPlano {
  acabamentoId: string
  /** Plano da seleção; id temporário enquanto o plano ainda não foi salvo. */
  planoId: string | null
  materialId: string
  /** Presente nas seleções já gravadas (linha `SELECAO`). */
  selecaoId?: string
  origem?: string
  [extra: string]: unknown
}

export type AcaoSelecaoPlano =
  | { tipo: 'escolher'; selecao: SelecaoDoPlano }
  | { tipo: 'remover'; acabamentoId: string; planoId: string | null }
  | { tipo: 'desmarcar'; acabamentoId: string; planoId: string | null }
  | { tipo: 'salvarPlano'; planoIdTemporario: string; planoId: string }

/**
 * Aplica uma ação e devolve a nova lista (sem alterar a original). Uma seleção por
 * `acabamentoId|planoId`. Ao escolher outro material na mesma chave, `selecaoId` e
 * `origem` da seleção existente são mantidos. Salvar o plano troca o id temporário
 * pelo definitivo; se já houver seleção da mesma atividade no plano definitivo, a do
 * plano recém-salvo prevalece.
 */
export function mesclarSelecoesPorPlano(
  atuais: ReadonlyArray<SelecaoDoPlano> | null | undefined,
  acao: AcaoSelecaoPlano,
): SelecaoDoPlano[] {
  const lista = [...(atuais ?? [])]
  switch (acao.tipo) {
    case 'escolher': {
      const chave = chaveSelecao(acao.selecao.acabamentoId, acao.selecao.planoId)
      const idx = lista.findIndex((s) => chaveSelecao(s.acabamentoId, s.planoId) === chave)
      if (idx < 0) return [...lista, { ...acao.selecao }]
      const anterior = lista[idx]
      const proxima: SelecaoDoPlano = { ...anterior, ...acao.selecao }
      if (anterior.selecaoId !== undefined) proxima.selecaoId = anterior.selecaoId
      if (anterior.origem !== undefined) proxima.origem = anterior.origem
      lista[idx] = proxima
      return lista
    }
    case 'remover':
    case 'desmarcar': {
      const chave = chaveSelecao(acao.acabamentoId, acao.planoId)
      return lista.filter((s) => chaveSelecao(s.acabamentoId, s.planoId) !== chave)
    }
    case 'salvarPlano': {
      const migradas = lista.filter((s) => s.planoId === acao.planoIdTemporario)
      if (migradas.length === 0) return lista
      const chavesMigradas = new Set(migradas.map((s) => s.acabamentoId))
      const restantes = lista.filter(
        (s) => s.planoId !== acao.planoIdTemporario && !(s.planoId === acao.planoId && chavesMigradas.has(s.acabamentoId)),
      )
      return [...restantes, ...migradas.map((s) => ({ ...s, planoId: acao.planoId }))]
    }
    default:
      return lista
  }
}
