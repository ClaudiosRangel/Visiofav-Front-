/**
 * Tipos do catálogo no editor do item (Fase 2 — orcamento-grafico-catalogo-no-editor).
 * Sem React e sem rede: usados pela camada pura `catalogo-puro.ts` e pelos componentes.
 */

import type {
  AtividadeCatalogo,
  AtividadeCatalogoPlano,
  CatalogoPlano,
  CatalogoProduto,
} from '../../../cadastros/_shared/cadastros-graficos.types'

/** Catálogo carregado para o item: produto + plano fixo + tipos sob demanda (cache). */
export interface CatalogoDoItem {
  produto: CatalogoProduto
  /** Id do tipo de plano fixo (ou único tipo permitido); null quando há vários não fixos. */
  planoFixoId: string | null
  /** Catálogo do plano fixo (null quando não há plano fixo). */
  planoFixo: CatalogoPlano | null
  /** Cache de catálogos por tipo de plano já consultados. */
  porTipoPlano: Record<string, CatalogoPlano>
}

/** Seleção de material escolhida antes de o item existir (aplicada no passe de seleções). */
export interface SelecaoPendente {
  acabamentoId: string
  materialId: string
  planoId?: string | null
  restricaoId?: string | null
  tipoParam?: number
  param1?: number | null
  param2?: number | null
  gramaturaKgM2?: number | null
  pecasPorCaixa?: number | null
  /** Remoção pendente (atividade desmarcada / material limpo). */
  remover?: boolean
}

export type { AtividadeCatalogo, AtividadeCatalogoPlano }
