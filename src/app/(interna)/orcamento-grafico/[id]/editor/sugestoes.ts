/**
 * sugestoes — funções PURAS (sem React, rede ou banco) das sugestões do editor do
 * item na Fase 3 (spec orcamento-grafico-fase3-produto-embalagem, Req 3 e 4).
 *
 * Regras centrais:
 *  - sugestão só vale para item NOVO (nunca para item puxado do acervo nem item salvo);
 *  - nunca sobrescreve campo preenchido (vazio = `null`, `undefined` ou `''`;
 *    gramatura vazia inclui `0`, e o preço por kg também, pois o formulário nasce com 0);
 *  - a aplicação é idempotente: `aplicarSugestoes(aplicarSugestoes(f)) = aplicarSugestoes(f)`.
 */

// ============================================================================
// Tipos
// ============================================================================

/** Situação do item no editor. Só `itemNovo` (e nem puxado nem salvo) recebe sugestão. */
export interface FlagsItem {
  itemNovo: boolean
  itemPuxado: boolean
  itemSalvo: boolean
}

export interface VinculoTipoEmbalagem {
  id: string
  ativo: boolean
}

export type SugestaoTipoEmbalagem =
  | { acao: 'APLICAR'; tipoEmbalagemId: string }
  | { acao: 'AVISO_INATIVO' }
  | { acao: 'NENHUM' }

export interface SugestaoSuporteGramatura {
  suporteId?: string
  gramatura?: number
}

export interface CandidatoPreco {
  id: string
  precoUnitario: number
}

export type MotivoAvisoPreco = 'SEM_PAPEL' | 'MAIS_DE_UM'

export type SugestaoPreco =
  | { acao: 'APLICAR'; precoKg: number }
  | { acao: 'AVISO'; motivo: MotivoAvisoPreco }
  | { acao: 'NENHUM' }

/** Papel do cadastro de preços (`precos-mp`, tipo PAPEL) usado para achar o preço por kg. */
export interface PapelComPreco {
  id: string
  suporteId?: string | null
  gramatura?: number | string | null
  precoUnitario?: number | string | null
}

// ============================================================================
// Utilitários
// ============================================================================

/** Campo vazio: `null`, `undefined` ou texto em branco. */
function vazio(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

/** Número finito maior que zero (aceita texto numérico); senão `null`. */
function positivo(v: unknown): number | null {
  if (vazio(v)) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Sugestão só vale para item novo, nem puxado, nem salvo. */
function podeSugerir(f: FlagsItem): boolean {
  return f.itemNovo && !f.itemPuxado && !f.itemSalvo
}

// ============================================================================
// 3 — Tipo de Embalagem
// ============================================================================

/**
 * Decide a sugestão do Tipo de Embalagem a partir do vínculo do produto (Req 3).
 *  - `NENHUM`: item puxado/salvo/não novo, sem produto, sem vínculo ou campo já preenchido;
 *  - `AVISO_INATIVO`: o tipo do vínculo está inativo (não preenche);
 *  - `APLICAR`: o tipo ativo do vínculo.
 */
export function sugerirTipoEmbalagem(
  i: {
    produtoEscolhidoId: string | null
    vinculo: VinculoTipoEmbalagem | null
    valorAtual: string | null
  } & FlagsItem,
): SugestaoTipoEmbalagem {
  if (!podeSugerir(i)) return { acao: 'NENHUM' }
  if (vazio(i.produtoEscolhidoId)) return { acao: 'NENHUM' }
  if (!i.vinculo) return { acao: 'NENHUM' }
  if (!vazio(i.valorAtual)) return { acao: 'NENHUM' }
  if (!i.vinculo.ativo) return { acao: 'AVISO_INATIVO' }
  return { acao: 'APLICAR', tipoEmbalagemId: i.vinculo.id }
}

/** Campos do formulário que a escolha do tipo reinicia (mesmo efeito do `StepTipo`). */
export interface CamposTipoEmbalagem {
  tipoEmbalagemId?: string | null
  tipoEmbalagem?: unknown
  medidas?: Record<string, number>
}

/**
 * Aplica o tipo exatamente como a escolha manual do `StepTipo`:
 * `updateForm({ tipoEmbalagemId, tipoEmbalagem, medidas: {} })`. Com `tipo` nulo
 * (limpar a escolha) devolve `tipoEmbalagemId`/`tipoEmbalagem` nulos e medidas vazias.
 */
export function aplicarTipoEmbalagem<F extends CamposTipoEmbalagem, T extends { id: string }>(
  form: F,
  tipo: T | null,
): F {
  return { ...form, tipoEmbalagemId: tipo ? tipo.id : null, tipoEmbalagem: tipo, medidas: {} }
}

// ============================================================================
// 4 — Suporte, gramatura e preço por kg
// ============================================================================

/**
 * Suporte e gramatura padrão do plano fixo, só nos campos vazios (Req 4.1, 4.2).
 * Gramatura vazia inclui `0`. Devolve só o que deve ser preenchido.
 */
export function sugerirSuporteGramatura(
  i: {
    planoFixo: { suportePadraoId: string | null; gramaturaPadrao: number | null } | null
    suporteAtual: string | null
    gramaturaAtual: number | null
  } & FlagsItem,
): SugestaoSuporteGramatura {
  if (!podeSugerir(i) || !i.planoFixo) return {}
  const saida: SugestaoSuporteGramatura = {}
  if (vazio(i.suporteAtual) && !vazio(i.planoFixo.suportePadraoId)) {
    saida.suporteId = i.planoFixo.suportePadraoId as string
  }
  const padraoG = positivo(i.planoFixo.gramaturaPadrao)
  if (positivo(i.gramaturaAtual) === null && padraoG !== null) {
    saida.gramatura = padraoG
  }
  return saida
}

/**
 * Preço por kg do papel casado por suporte + gramatura (Req 4.4, 4.5). Só aplica com
 * EXATAMENTE 1 candidato de preço maior que 0. Zero candidatos viram `SEM_PAPEL`; dois
 * ou mais, `MAIS_DE_UM` (duplicatas de papel do cadastro).
 */
export function sugerirPrecoKg(
  i: {
    suporteId: string | null
    gramatura: number | null
    precoKgAtual: number | null
    candidatos: ReadonlyArray<CandidatoPreco>
  } & FlagsItem,
): SugestaoPreco {
  if (!podeSugerir(i)) return { acao: 'NENHUM' }
  if (vazio(i.suporteId) || positivo(i.gramatura) === null) return { acao: 'NENHUM' }
  // Preço já informado (maior que 0) é Campo_Preenchido; o formulário nasce com 0.
  if (positivo(i.precoKgAtual) !== null) return { acao: 'NENHUM' }
  const comPreco = i.candidatos.filter((c) => positivo(c.precoUnitario) !== null)
  if (comPreco.length === 0) return { acao: 'AVISO', motivo: 'SEM_PAPEL' }
  if (comPreco.length > 1) return { acao: 'AVISO', motivo: 'MAIS_DE_UM' }
  return { acao: 'APLICAR', precoKg: Number(comPreco[0].precoUnitario) }
}

/** Papéis do cadastro de preços com o suporte e a gramatura informados e preço maior que 0. */
export function filtrarCandidatosPapel(
  papeis: ReadonlyArray<PapelComPreco> | null | undefined,
  suporteId: string | null | undefined,
  gramatura: number | null | undefined,
): CandidatoPreco[] {
  const g = positivo(gramatura)
  if (vazio(suporteId) || g === null) return []
  const saida: CandidatoPreco[] = []
  for (const p of papeis ?? []) {
    if (p.suporteId !== suporteId) continue
    if (positivo(p.gramatura) !== g) continue
    const preco = positivo(p.precoUnitario)
    if (preco === null) continue
    saida.push({ id: p.id, precoUnitario: preco })
  }
  return saida
}

// ============================================================================
// Aplicação conjunta (idempotente)
// ============================================================================

/** Campos do formulário do item que as sugestões podem preencher. */
export interface CamposSugestao extends CamposTipoEmbalagem {
  suporteId?: string | null
  gramatura?: number | string | null
  precoKg?: number | string | null
}

export interface EntradaSugestoes<T extends { id: string }> {
  flags: FlagsItem
  produtoEscolhidoId: string | null
  /** Vínculo do produto com o tipo (id + ativo); null quando não há vínculo. */
  vinculo: VinculoTipoEmbalagem | null
  /** Objeto do tipo do vínculo (o mesmo que a escolha manual guarda em `tipoEmbalagem`). */
  tipoDoVinculo: T | null
  planoFixo: { suportePadraoId: string | null; gramaturaPadrao: number | null } | null
  /** Papéis do cadastro de preços (tipo PAPEL). */
  papeis: ReadonlyArray<PapelComPreco> | null | undefined
}

export interface ResultadoSugestoes<F> {
  form: F
  tipoSugerido: boolean
  avisoTipoInativo: boolean
  /** `SEM_PAPEL` ou `MAIS_DE_UM` quando o preço não pôde ser sugerido. */
  avisoPreco: MotivoAvisoPreco | null
}

function numeroOuNulo(v: unknown): number | null {
  if (vazio(v)) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Aplica as sugestões na ordem tipo, suporte/gramatura e preço (o preço usa o suporte e
 * a gramatura já sugeridos). Nunca sobrescreve campo preenchido e é idempotente.
 */
export function aplicarSugestoes<F extends CamposSugestao, T extends { id: string }>(
  form: F,
  entrada: EntradaSugestoes<T>,
): ResultadoSugestoes<F> {
  let atual: F = form
  let tipoSugerido = false
  let avisoTipoInativo = false

  const sugTipo = sugerirTipoEmbalagem({
    ...entrada.flags,
    produtoEscolhidoId: entrada.produtoEscolhidoId,
    vinculo: entrada.vinculo,
    valorAtual: atual.tipoEmbalagemId ?? null,
  })
  if (sugTipo.acao === 'APLICAR' && entrada.tipoDoVinculo && entrada.tipoDoVinculo.id === sugTipo.tipoEmbalagemId) {
    atual = aplicarTipoEmbalagem(atual, entrada.tipoDoVinculo)
    tipoSugerido = true
  } else if (sugTipo.acao === 'AVISO_INATIVO') {
    avisoTipoInativo = true
  }

  const sugSG = sugerirSuporteGramatura({
    ...entrada.flags,
    planoFixo: entrada.planoFixo,
    suporteAtual: atual.suporteId ?? null,
    gramaturaAtual: numeroOuNulo(atual.gramatura),
  })
  if (sugSG.suporteId !== undefined || sugSG.gramatura !== undefined) {
    atual = {
      ...atual,
      ...(sugSG.suporteId !== undefined ? { suporteId: sugSG.suporteId } : {}),
      ...(sugSG.gramatura !== undefined ? { gramatura: sugSG.gramatura } : {}),
    }
  }

  const suporteFinal = atual.suporteId ?? null
  const gramaturaFinal = numeroOuNulo(atual.gramatura)
  const sugPreco = sugerirPrecoKg({
    ...entrada.flags,
    suporteId: suporteFinal,
    gramatura: gramaturaFinal,
    precoKgAtual: numeroOuNulo(atual.precoKg),
    candidatos: filtrarCandidatosPapel(entrada.papeis, suporteFinal, gramaturaFinal),
  })
  let avisoPreco: MotivoAvisoPreco | null = null
  if (sugPreco.acao === 'APLICAR') {
    atual = { ...atual, precoKg: sugPreco.precoKg }
  } else if (sugPreco.acao === 'AVISO') {
    avisoPreco = sugPreco.motivo
  }

  return { form: atual, tipoSugerido, avisoTipoInativo, avisoPreco }
}
