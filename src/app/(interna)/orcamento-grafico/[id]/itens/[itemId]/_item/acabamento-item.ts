/**
 * acabamento-item — lógica PURA do bloco Acabamento do Item de plano único (sem React, sem rede):
 * marcar/desmarcar atividades, pré-marcadas do cadastro, busca, restrição escolhida e a seleção de
 * material atual de uma atividade.
 *
 * As marcações ficam em `acabamentosRicos` (a estrutura que o item já usa). A restrição escolhida
 * fica na própria linha (`restricaoAcabamentoId`/`restricaoNome`, igual ao editor atual). A escolha
 * de material é da seleção de material (`selecao-material`), lida aqui só para exibição.
 */

import type { AcabamentoRicoSelecionado } from '../../../../novo/page'
import type { SelecaoMaterial } from '../../../../cadastros/_shared/cadastros-graficos.types'
import { normalizarTexto, preMarcarAtividades } from '../../../editor/catalogo/catalogo-puro'
import type { SelecaoPendente } from '../../../editor/catalogo/catalogo.types'

/** Atividade (acabamento) do cadastro, com o que o editor atual copia para a linha marcada. */
export interface AtividadeCadastro {
  id: string
  nome: string
  codigo?: string
  naturezaCusto: AcabamentoRicoSelecionado['naturezaCusto']
  custoHora?: unknown
  producaoHora?: unknown
  quantAcertos?: unknown
  tempoPorAcertoMin?: unknown
  tempoPrimeiroAcertoMin?: unknown
  unidadeBase?: string | null
  [outros: string]: unknown
}

/** O cadastro traz Decimal como texto; o back espera número. */
function numeroOuUndefined(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

/** Linha marcada com os padrões do cadastro (mesma regra do editor atual). */
export function novoAcabamentoRico(ac: AtividadeCadastro): AcabamentoRicoSelecionado {
  return {
    acabamentoId: ac.id,
    nome: ac.nome,
    naturezaCusto: ac.naturezaCusto,
    custoHora: numeroOuUndefined(ac.custoHora),
    producaoHora: numeroOuUndefined(ac.producaoHora),
    quantAcertos: numeroOuUndefined(ac.quantAcertos),
    tempoPorAcertoMin: numeroOuUndefined(ac.tempoPorAcertoMin),
    tempoPrimeiroAcertoMin: numeroOuUndefined(ac.tempoPrimeiroAcertoMin),
    unidadeBase: (ac.unidadeBase as 'FOLHA' | 'PRODUTO' | null | undefined) ?? 'FOLHA',
  }
}

type Selecionados = ReadonlyArray<AcabamentoRicoSelecionado> | null | undefined

/** Casa por id ou, em item salvo sem `acabamentoId`, pelo nome normalizado. */
function casa(s: AcabamentoRicoSelecionado, ac: Pick<AtividadeCadastro, 'id' | 'nome'>): boolean {
  return s.acabamentoId === ac.id || normalizarTexto(s.nome ?? '') === normalizarTexto(ac.nome)
}

export function estaMarcada(selecionados: Selecionados, ac: Pick<AtividadeCadastro, 'id' | 'nome'>): boolean {
  return (selecionados ?? []).some((s) => casa(s, ac))
}

/** Marca (se desmarcada) ou desmarca (se marcada). Nunca duplica. */
export function alternarAtividade(selecionados: Selecionados, ac: AtividadeCadastro): AcabamentoRicoSelecionado[] {
  const atuais = [...(selecionados ?? [])]
  if (estaMarcada(atuais, ac)) return atuais.filter((s) => !casa(s, ac))
  return [...atuais, novoAcabamentoRico(ac)]
}

/**
 * Pré-marcadas do cadastro do produto: só quando o item ainda não tem nenhuma marcação (item novo).
 * Devolve a nova lista e as atividades recém-marcadas (para escolher o material padrão de cada uma).
 */
export function aplicarPreMarcadas(
  selecionados: Selecionados,
  idsPreMarcados: ReadonlyArray<string> | null | undefined,
  cadastro: ReadonlyArray<AtividadeCadastro>,
): { acabamentosRicos: AcabamentoRicoSelecionado[]; marcadas: AtividadeCadastro[] } {
  const atuais = [...(selecionados ?? [])]
  const marcadas = preMarcarAtividades(atuais, idsPreMarcados, cadastro)
  if (marcadas.length === 0) return { acabamentosRicos: atuais, marcadas: [] }
  return { acabamentosRicos: marcadas.map(novoAcabamentoRico), marcadas }
}

/** Busca por nome ou código, sem acento nem diferença de caixa. Vazio devolve tudo. */
export function filtrarAtividades<T extends { nome: string; codigo?: string }>(
  lista: ReadonlyArray<T>,
  busca: string,
): T[] {
  const termo = normalizarTexto(busca)
  if (termo === '') return [...lista]
  return lista.filter((a) => normalizarTexto(a.nome).includes(termo) || normalizarTexto(a.codigo ?? '').includes(termo))
}

// ============================================================================
// Restrição escolhida
// ============================================================================

export interface RestricaoEscolhida {
  id: string
  nome: string
}

export function restricaoDaAtividade(
  selecionados: Selecionados,
  ac: Pick<AtividadeCadastro, 'id' | 'nome'>,
): RestricaoEscolhida | null {
  const linha = (selecionados ?? []).find((s) => casa(s, ac))
  if (!linha?.restricaoAcabamentoId) return null
  return { id: linha.restricaoAcabamentoId, nome: linha.restricaoNome ?? '' }
}

/** Grava (ou limpa, com `null`) a restrição da linha da atividade; atividade desmarcada não muda nada. */
export function definirRestricao(
  selecionados: Selecionados,
  ac: Pick<AtividadeCadastro, 'id' | 'nome'>,
  restricao: RestricaoEscolhida | null,
): AcabamentoRicoSelecionado[] {
  return (selecionados ?? []).map((s) => {
    if (!casa(s, ac)) return s
    const { restricaoAcabamentoId: _id, restricaoNome: _nome, ...resto } = s
    return restricao ? { ...resto, restricaoAcabamentoId: restricao.id, restricaoNome: restricao.nome } : resto
  })
}

// ============================================================================
// Seleção de material atual
// ============================================================================

export interface EscolhaAtual {
  materialId: string
  restricaoId: string | null
  tipoParam: number
  param1: number | null
  param2: number | null
  gramaturaKgM2: number | null
  pecasPorCaixa: number | null
  /** Escolha ainda não gravada (item novo ou gravação que falhou). */
  pendente: boolean
}

/** Seleção gravada da atividade (item sem plano) ou, na falta, a pendente que não é remoção. */
export function selecaoDaAtividade(
  gravadas: ReadonlyArray<SelecaoMaterial> | null | undefined,
  pendentes: ReadonlyArray<SelecaoPendente> | null | undefined,
  acabamentoId: string,
  planoId: string | null = null,
): EscolhaAtual | null {
  const gravada = (gravadas ?? []).find((s) => s.acabamentoId === acabamentoId && (s.planoId ?? null) === planoId)
  if (gravada) {
    return {
      materialId: gravada.materialId,
      restricaoId: gravada.restricaoId ?? null,
      tipoParam: gravada.tipoParam,
      param1: gravada.param1 ?? null,
      param2: gravada.param2 ?? null,
      gramaturaKgM2: null,
      pecasPorCaixa: null,
      pendente: false,
    }
  }
  const pendente = (pendentes ?? []).find(
    (p) => p.acabamentoId === acabamentoId && (p.planoId ?? null) === planoId && !p.remover,
  )
  if (!pendente) return null
  return {
    materialId: pendente.materialId,
    restricaoId: pendente.restricaoId ?? null,
    tipoParam: pendente.tipoParam ?? 2,
    param1: pendente.param1 ?? null,
    param2: pendente.param2 ?? null,
    gramaturaKgM2: pendente.gramaturaKgM2 ?? null,
    pecasPorCaixa: pendente.pecasPorCaixa ?? null,
    pendente: true,
  }
}
