/**
 * resolver-layout-item — função PURA que decide a estrutura do Item (plano único ×
 * multi-plano) e os campos visíveis somente a partir de atributos do cadastro.
 * Sem React, sem rede, sem Date/Math.random. A entrada NÃO contém nome nem código
 * de produto/tipo de plano, de propósito (design: "O cadastro manda, o nome não").
 *
 * Os mesmos vetores (`vetores-layout.json`) são testados no back e no front.
 */

import type { DefaultProdutoPlano, TipoPlanoGrafico } from '../../cadastros/_shared/cadastros-graficos.types'
import {
  aplicarDefaultsEmPlano,
  aplicarDefaultsEmVazios,
  idsPreMarcados,
  type CamposDefaultItem,
  type CamposDefaultPlano,
  type NomesDefault,
} from '../editor/catalogo/catalogo-puro'

export type ModoFormato = 'TRES_DIMENSOES' | 'DUAS_DIMENSOES' | 'ABERTO_FECHADO' | 'SANFONA_ABAS' | 'PAGINA'

export type CampoFormato =
  | 'comprimento'
  | 'largura'
  | 'altura'
  | 'abaCola'
  | 'abaFechamento'
  | 'alturaTampa'
  | 'formatoFinal'
  | 'formatoFechado'
  | 'formatoAberto'
  | 'numeroSanfonas'
  | 'aba'
  | 'numeroPaginas'

export type CampoPlanoUnico =
  | 'cores'
  | 'processoImpressao'
  | 'coberturaTinta'
  | 'fabricante'
  | 'suporte'
  | 'fornecido'
  | 'microondulado'
  | 'fibra'
  | 'montagem'
  | 'formatoCorte'
  | 'ajusteCorteMicro'

/** Tri-estado: true = o cadastro prevê; false = não prevê; null/undefined = não informa (mostrar). */
export interface PrevisaoBlocos {
  capaExterna?: boolean | null
  microondulado?: boolean | null
  capaInterna?: boolean | null
  fibra?: boolean | null
}

export interface EntradaLayoutItem {
  produto: {
    /** string, para aceitar valor inválido vindo do cadastro. */
    modoFormato: string | null | undefined
    formatoPadraoLargura: number | null
    formatoPadraoAltura: number | null
    exibeRestricoes: boolean
    exibeInformacoesComplementares: boolean
    semImpressao: boolean
    /** Tri-estado: a Alt Tampa só aparece com `true` (design R7.1); null/omitido = oculta. */
    possuiAlturaTampa?: boolean | null
  }
  /** Tipos de plano PERMITIDOS ao produto, na ordem do catálogo. */
  tiposPlano: ReadonlyArray<{
    id: string
    fixo: boolean
    fibraDefault?: string | null
    previsao?: PrevisaoBlocos | null
  }>
}

export interface LayoutItem {
  versao: 1
  cadastroCompleto: boolean
  motivoIncompleto: 'MODO_FORMATO_AUSENTE' | 'MODO_FORMATO_DESCONHECIDO' | null
  estrutura: 'PLANO_UNICO' | 'MULTI_PLANO'
  tipoPlanoFixoId: string | null
  gridPlanos: boolean
  formato: {
    campos: readonly CampoFormato[]
    padrao: { largura: number; altura: number } | null
    /** Mantido por compatibilidade com os vetores; hoje todos os modos têm campos definidos. */
    formatoPendenteDeWireframe: boolean
  }
  planoUnico: {
    campos: readonly CampoPlanoUnico[]
    somenteLeitura: readonly CampoPlanoUnico[]
  }
  impressaoVisivel: boolean
  informacoesComplementaresVisiveis: boolean
  restricoes: 'EXPANDIDA' | 'RECOLHIDA'
}

// ============================================================================
// Tabelas de decisão (dados, sem ramificação por nome)
// ============================================================================

const MODOS_FORMATO: Readonly<Record<ModoFormato, readonly CampoFormato[]>> = {
  TRES_DIMENSOES: ['comprimento', 'largura', 'altura', 'abaCola', 'abaFechamento'],
  DUAS_DIMENSOES: ['formatoFinal'],
  ABERTO_FECHADO: ['formatoFechado', 'formatoAberto'],
  SANFONA_ABAS: ['comprimento', 'largura', 'numeroSanfonas', 'aba'],
  PAGINA: ['formatoFechado', 'numeroPaginas'],
}

const CAMPOS_PLANO_UNICO: readonly CampoPlanoUnico[] = [
  'cores',
  'processoImpressao',
  'coberturaTinta',
  'fabricante',
  'suporte',
  'fornecido',
  'microondulado',
  'fibra',
  'montagem',
  'formatoCorte',
  'ajusteCorteMicro',
]

const SOMENTE_LEITURA: readonly CampoPlanoUnico[] = ['montagem', 'formatoCorte']
const CAMPOS_DE_IMPRESSAO: ReadonlySet<CampoPlanoUnico> = new Set(['cores', 'processoImpressao', 'coberturaTinta'])
const CAMPOS_DE_MICRO: ReadonlySet<CampoPlanoUnico> = new Set(['microondulado', 'ajusteCorteMicro'])

function ehModoFormato(v: unknown): v is ModoFormato {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(MODOS_FORMATO, v)
}

function positivo(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

// ============================================================================
// resolverLayoutItem
// ============================================================================

export function resolverLayoutItem(entrada: EntradaLayoutItem): LayoutItem {
  const { produto, tiposPlano } = entrada

  const modo = produto.modoFormato
  const ausente = modo === null || modo === undefined || modo === ''
  const cadastroCompleto = ehModoFormato(modo)
  const motivoIncompleto: LayoutItem['motivoIncompleto'] = cadastroCompleto
    ? null
    : ausente
      ? 'MODO_FORMATO_AUSENTE'
      : 'MODO_FORMATO_DESCONHECIDO'

  // R8.4: plano único somente se algum tipo permitido é `fixo`.
  const tipoFixo = tiposPlano.find((t) => t.fixo === true) ?? null
  const planoUnico = tipoFixo !== null

  // Formato
  let camposFormato: CampoFormato[] = cadastroCompleto ? [...MODOS_FORMATO[modo as ModoFormato]] : []
  if (modo === 'TRES_DIMENSOES' && produto.possuiAlturaTampa === true) {
    // Design R7.1 e vetores compartilhados: Alt Tampa só aparece com `true`
    // (null/omitido = não aparece, como no editor atual). Os blocos de plano, ao
    // contrário, tratam null como "mostrar".
    camposFormato = [...camposFormato, 'alturaTampa']
  }
  const padrao =
    positivo(produto.formatoPadraoLargura) && positivo(produto.formatoPadraoAltura)
      ? { largura: produto.formatoPadraoLargura, altura: produto.formatoPadraoAltura }
      : null

  // Campos do plano único
  let camposPlano: CampoPlanoUnico[] = []
  if (planoUnico) {
    const prev = tipoFixo?.previsao ?? null
    camposPlano = CAMPOS_PLANO_UNICO.filter((c) => {
      if (produto.semImpressao && CAMPOS_DE_IMPRESSAO.has(c)) return false
      if (prev?.microondulado === false && CAMPOS_DE_MICRO.has(c)) return false
      if (prev?.fibra === false && c === 'fibra') return false
      return true
    })
  }

  return {
    versao: 1,
    cadastroCompleto,
    motivoIncompleto,
    estrutura: planoUnico ? 'PLANO_UNICO' : 'MULTI_PLANO',
    tipoPlanoFixoId: tipoFixo ? tipoFixo.id : null,
    gridPlanos: !planoUnico,
    formato: { campos: camposFormato, padrao, formatoPendenteDeWireframe: false },
    planoUnico: {
      campos: camposPlano,
      somenteLeitura: planoUnico ? SOMENTE_LEITURA.filter((c) => camposPlano.includes(c)) : [],
    },
    impressaoVisivel: !produto.semImpressao,
    informacoesComplementaresVisiveis: produto.exibeInformacoesComplementares === true,
    restricoes: produto.exibeRestricoes === true ? 'EXPANDIDA' : 'RECOLHIDA',
  }
}

// ============================================================================
// resolverBlocosPlano (Tela_Plano)
// ============================================================================

/**
 * Flags de plano G2 aceitas em duas formas: objeto `previsao` (design) ou campos
 * planos `prevCapaExterna/prevMicroondulado/prevCapaInterna/prevFibra` (cadastro).
 */
export interface TipoPlanoComPrevisao {
  previsao?: PrevisaoBlocos | null
  prevCapaExterna?: boolean | null
  prevMicroondulado?: boolean | null
  prevCapaInterna?: boolean | null
  prevFibra?: boolean | null
}

export interface BlocosPlano {
  capaExterna: boolean
  microondulado: boolean
  capaInterna: boolean
  fibra: boolean
}

/** nulo/indefinido = mostrar (não-regressão); só `false` oculta. */
function mostrar(v: boolean | null | undefined): boolean {
  return v !== false
}

export function resolverBlocosPlano(tipo: TipoPlanoComPrevisao | null | undefined): BlocosPlano {
  const p = tipo?.previsao ?? null
  return {
    capaExterna: mostrar(p?.capaExterna ?? tipo?.prevCapaExterna),
    microondulado: mostrar(p?.microondulado ?? tipo?.prevMicroondulado),
    capaInterna: mostrar(p?.capaInterna ?? tipo?.prevCapaInterna),
    fibra: mostrar(p?.fibra ?? tipo?.prevFibra),
  }
}

// ============================================================================
// resolverPadroesIniciais
// ============================================================================

export interface PadroesIniciais {
  /** `NxM` (frente x verso) ou null quando o default não informa cores. */
  cores: string | null
  coresFrente: number
  coresVerso: number
  semImpressao: boolean
  processoImpressaoId: string | null
  coberturaTintaId: string | null
  fabricanteSuporte: string | null
  /** Ids a pré-marcar: pré-marcadas do catálogo + do default, sem repetir. */
  atividadesPreMarcadas: string[]
}

export function resolverPadroesIniciais(entrada: {
  default: DefaultProdutoPlano | null | undefined
  atividadesDoCatalogo?: ReadonlyArray<{ id: string; preMarcada?: boolean }> | null
}): PadroesIniciais {
  const d = entrada.default ?? null
  const frente = Math.max(0, Number(d?.coresFrente ?? 0) || 0)
  const verso = Math.max(0, Number(d?.coresVerso ?? 0) || 0)
  const semImpressao = d?.semImpressao === true
  return {
    cores: !semImpressao && frente + verso > 0 ? `${frente}x${verso}` : null,
    coresFrente: frente,
    coresVerso: verso,
    semImpressao,
    processoImpressaoId: d?.processoImpressaoId ?? null,
    coberturaTintaId: d?.coberturaTintaId ?? null,
    fabricanteSuporte: d?.fabricanteSuporte ?? null,
    atividadesPreMarcadas: idsPreMarcados({ atividades: entrada.atividadesDoCatalogo ?? [] }, d),
  }
}

/** Aplica os padrões só em campo vazio do item (delegando a `aplicarDefaultsEmVazios`). */
export function aplicarPadroesNoItem<T extends CamposDefaultItem>(
  form: T,
  padroes: Pick<PadroesIniciais, 'fabricanteSuporte'> | null | undefined,
  nomes: NomesDefault = {},
): T {
  return aplicarDefaultsEmVazios(form, padroes, nomes)
}

/** Aplica os padrões num plano novo (delegando a `aplicarDefaultsEmPlano`). */
export function aplicarPadroesNoPlano<T extends CamposDefaultPlano>(
  plano: T,
  tipo: Pick<TipoPlanoGrafico, 'nome' | 'suportePadraoId' | 'gramaturaPadrao'> | null | undefined,
  padroes: Pick<PadroesIniciais, 'coresFrente' | 'coresVerso'> | null | undefined,
  camposTocados: ReadonlySet<string> = new Set(),
): T {
  return aplicarDefaultsEmPlano(plano, tipo, padroes, camposTocados)
}
