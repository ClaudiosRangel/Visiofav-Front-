/**
 * atividades-do-plano-puro — funções PURAS (sem React, rede ou banco) para marcar e desmarcar
 * atividades do catálogo no modal de plano (spec orcamento-grafico-fase3-produto-embalagem,
 * Req 8, tarefa 14.4).
 *
 * - `alternarAtividadeMarcada`: marca/desmarca sem repetir id e mantendo a ordem de marcação.
 * - `escolhaPadraoDaAtividade`: material padrão (ou único) da atividade com os parâmetros iniciais,
 *   pré-selecionado ao marcar.
 * - `montarAcabamentosRicosDoPlano`: lista `acabamentosRicos` do payload do plano (reaproveita a
 *   linha já gravada e não inventa campos novos além de `acabamentoId` e `nome`).
 */

import {
  materialPadraoDaAtividade,
  paramsPadraoMaterial,
  tipoParamDoMaterial,
} from './catalogo-puro'
import type { SelecaoPendente } from './catalogo.types'

export interface AtividadeMarcada {
  acabamentoId: string
  nome: string
}

export interface MaterialDaAtividade {
  id: string
  padrao?: boolean
  tipoParam?: number | null
  tipoMaterial?: string | null
}

export interface AtividadeParaMarcar {
  id: string
  nome?: string | null
  materiais?: ReadonlyArray<MaterialDaAtividade> | null
}

const NOME_PADRAO = 'Atividade'

/** Marca (`marcar = true`) ou desmarca a atividade. Idempotente; nunca duplica o id. */
export function alternarAtividadeMarcada(
  marcadas: ReadonlyArray<AtividadeMarcada> | null | undefined,
  atividade: Pick<AtividadeParaMarcar, 'id' | 'nome'>,
  marcar: boolean,
): AtividadeMarcada[] {
  const atuais = marcadas ?? []
  const semEla = atuais.filter((m) => m.acabamentoId !== atividade.id)
  if (!marcar) return semEla
  const existente = atuais.find((m) => m.acabamentoId === atividade.id)
  if (existente) return [...atuais]
  return [...semEla, { acabamentoId: atividade.id, nome: atividade.nome?.trim() || NOME_PADRAO }]
}

/**
 * Escolha inicial de material ao marcar a atividade: o material padrão ou o único permitido,
 * com os parâmetros padrão do `tipoParam`. Sem materiais (ou sem padrão entre vários) = null.
 */
export function escolhaPadraoDaAtividade(
  atividade: Pick<AtividadeParaMarcar, 'materiais'>,
): Omit<SelecaoPendente, 'acabamentoId'> | null {
  const material = materialPadraoDaAtividade(atividade.materiais ?? [])
  if (!material) return null
  const tipoParam = tipoParamDoMaterial(material)
  const params = paramsPadraoMaterial(tipoParam)
  return {
    materialId: material.id,
    tipoParam,
    param1: params.param1,
    param2: params.param2,
    gramaturaKgM2: null,
    pecasPorCaixa: null,
  }
}

/**
 * `acabamentosRicos` do plano: uma linha por atividade marcada, na ordem de marcação. Linhas já
 * gravadas são reaproveitadas como estão; as novas levam só `acabamentoId` e `nome`.
 */
export function montarAcabamentosRicosDoPlano<T extends { acabamentoId?: string }>(
  marcadas: ReadonlyArray<AtividadeMarcada>,
  gravadas: ReadonlyArray<T> | null | undefined,
): Array<T | AtividadeMarcada> {
  const porId = new Map<string, T>()
  for (const g of gravadas ?? []) {
    if (typeof g?.acabamentoId === 'string' && !porId.has(g.acabamentoId)) porId.set(g.acabamentoId, g)
  }
  const vistos = new Set<string>()
  const saida: Array<T | AtividadeMarcada> = []
  for (const m of marcadas) {
    if (vistos.has(m.acabamentoId)) continue
    vistos.add(m.acabamentoId)
    saida.push(porId.get(m.acabamentoId) ?? { acabamentoId: m.acabamentoId, nome: m.nome })
  }
  return saida
}
