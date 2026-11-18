/**
 * pilha-desfazer — reducer PURO da pilha de "Desfazer" do Grid de Planos (R9.7).
 *
 * Cada ação do grid empilha a sua operação INVERSA:
 *  - Incluir / Copiar  → `EXCLUIR_PLANO` (apaga o plano criado);
 *  - Excluir           → `RECRIAR_PLANO` (recria com os mesmos valores, na mesma posição);
 *  - Trocar/Reordenar  → `RESTAURAR_ORDEM` (volta a ordem anterior).
 *
 * Limite de 20 operações: a mais antiga sai quando entra a 21ª. Desfazer usa a do topo (ordem
 * inversa). Recriar um plano gera id novo: `remapearId` troca o id antigo pelo novo em todas as
 * operações que ainda estão na pilha.
 */

import type { PlanoLeitura } from './plano.types'

export const LIMITE_DESFAZER = 20

export type OperacaoInversa =
  | { tipo: 'EXCLUIR_PLANO'; planoId: string }
  | {
      tipo: 'RECRIAR_PLANO'
      /** Plano como estava antes de ser excluído. */
      plano: PlanoLeitura
      /** Plano logo acima do excluído (null = era o primeiro). */
      posicaoApos: string | null
      /** Ordem completa dos ids antes da exclusão. */
      ordem: string[]
    }
  | { tipo: 'RESTAURAR_ORDEM'; ordem: string[] }

export interface PilhaDesfazer {
  /** Da mais antiga (índice 0) para a mais recente (topo). */
  itens: readonly OperacaoInversa[]
}

export const PILHA_VAZIA: PilhaDesfazer = { itens: [] }

export function empilhar(pilha: PilhaDesfazer, op: OperacaoInversa): PilhaDesfazer {
  const itens = [...pilha.itens, op]
  return { itens: itens.length > LIMITE_DESFAZER ? itens.slice(itens.length - LIMITE_DESFAZER) : itens }
}

export function topo(pilha: PilhaDesfazer): OperacaoInversa | null {
  return pilha.itens.length > 0 ? pilha.itens[pilha.itens.length - 1] : null
}

export function desempilhar(pilha: PilhaDesfazer): { pilha: PilhaDesfazer; op: OperacaoInversa | null } {
  if (pilha.itens.length === 0) return { pilha, op: null }
  return { pilha: { itens: pilha.itens.slice(0, -1) }, op: pilha.itens[pilha.itens.length - 1] }
}

function trocar(id: string, antigo: string, novo: string): string {
  return id === antigo ? novo : id
}

/** Troca `antigo` por `novo` em todas as operações. */
export function remapearId(pilha: PilhaDesfazer, antigo: string, novo: string): PilhaDesfazer {
  if (antigo === novo) return pilha
  return {
    itens: pilha.itens.map((op): OperacaoInversa => {
      switch (op.tipo) {
        case 'EXCLUIR_PLANO':
          return { ...op, planoId: trocar(op.planoId, antigo, novo) }
        case 'RESTAURAR_ORDEM':
          return { ...op, ordem: op.ordem.map((id) => trocar(id, antigo, novo)) }
        case 'RECRIAR_PLANO':
          return {
            ...op,
            plano: op.plano.id === antigo ? { ...op.plano, id: novo } : op.plano,
            posicaoApos: op.posicaoApos === null ? null : trocar(op.posicaoApos, antigo, novo),
            ordem: op.ordem.map((id) => trocar(id, antigo, novo)),
          }
      }
    }),
  }
}

export type AcaoPilha =
  | { tipo: 'EMPILHAR'; op: OperacaoInversa }
  | { tipo: 'DESEMPILHAR' }
  | { tipo: 'REMAPEAR'; antigo: string; novo: string }
  | { tipo: 'LIMPAR' }

export function reducerPilha(pilha: PilhaDesfazer, acao: AcaoPilha): PilhaDesfazer {
  switch (acao.tipo) {
    case 'EMPILHAR':
      return empilhar(pilha, acao.op)
    case 'DESEMPILHAR':
      return desempilhar(pilha).pilha
    case 'REMAPEAR':
      return remapearId(pilha, acao.antigo, acao.novo)
    case 'LIMPAR':
      return PILHA_VAZIA
  }
}
